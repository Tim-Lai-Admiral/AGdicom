/**
 * IndexedDB 二进制存储层（CR-006 T-003 / R-016）。
 *
 * 职责：文件 blob（≤ BLOB_MAX_BYTES）的持久化读写，键 = 资产去重键
 * （importAssets.dedupKey：kind\0fileSize\0fileName，与 T-002 水合索引一致），
 * 刷新后由 App 启动恢复（blobPersistence.restoreAssetBlobs）重建 objectUrl。
 *
 * 契约：
 * - saveBlob / loadBlob / deleteBlob / listBlobs 均为异步；
 * - 键不存在时 loadBlob 返回 null、deleteBlob 静默成功；
 * - 基础设施失败（IndexedDB 不可用 / 打开失败 / 事务失败）抛出带可读中文消息的
 *   BlobStoreError，由调用方（useImport / App）捕获降级，不阻塞导入或删除；
 * - 存储记录为 { key, fileName, fileType, lastModified, bytes } 包装：保存时读出
 *   字节（ArrayBuffer），读取时按元数据重建 File——规避各实现（真实浏览器克隆
 *   File 语义 / fake-indexeddb 将 Blob 克隆为空对象）的差异，行为跨环境一致。
 *
 * 可注入性：createIndexedDbBlobStore 支持注入 IDBFactory / 库名 / 表名；
 * 测试用 fake-indexeddb（devDep）提供 IDBFactory（jsdom 无 IndexedDB）。
 */

/** 单文件入库阈值：> 20MB 不入库（走会话态 + R-014 重导入水合兜底），界面提示 */
export const BLOB_MAX_BYTES = 20 * 1024 * 1024

/** IndexedDB 数据库名 */
export const BLOB_DB_NAME = 'ag-review-workbench-blobs'

/** 对象仓库名 */
export const BLOB_STORE_NAME = 'blobs'

/** 存储失败（不可用 / 打开失败 / 事务失败）：message 为可直接展示的中文提示 */
export class BlobStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'BlobStoreError'
  }
}

/** 二进制存储抽象：IndexedDB 实现（默认）或测试注入实现 */
export interface BlobStore {
  /** 保存文件 blob（同名键覆盖写入）；失败抛 BlobStoreError */
  saveBlob(key: string, file: File): Promise<void>
  /** 读取文件 blob；键不存在（或记录损坏）返回 null；基础设施失败抛 BlobStoreError */
  loadBlob(key: string): Promise<File | null>
  /** 删除文件 blob；键不存在视为已删除（静默成功）；基础设施失败抛 BlobStoreError */
  deleteBlob(key: string): Promise<void>
  /** 列出全部 blob 键；基础设施失败抛 BlobStoreError */
  listBlobs(): Promise<string[]>
}

/** IDB 存储记录：重建 File 所需元数据 + 文件字节 */
interface StoredBlobRecord {
  key: string
  fileName: string
  fileType: string
  lastModified: number
  bytes: ArrayBuffer | ArrayBufferView
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return String(error)
}

/** 字节数据鸭子类型判定（跨 realm 安全，不依赖 instanceof ArrayBuffer） */
function isBytesLike(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ArrayBufferView).byteLength === 'number'
  )
}

/** 记录损坏 / 非预期形状 → null（读取降级为“无该 blob”，不中断启动恢复） */
function toFile(value: unknown): File | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Partial<StoredBlobRecord>
  if (typeof record.fileName !== 'string' || !isBytesLike(record.bytes)) return null
  // bytes 按鸭子判定通过（ArrayBuffer 或视图）；BlobPart 的库类型比鸭子判定窄，需断言
  return new File([record.bytes as unknown as BlobPart], record.fileName, {
    type: typeof record.fileType === 'string' ? record.fileType : '',
    lastModified: typeof record.lastModified === 'number' ? record.lastModified : 0,
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB 请求失败'))
    }
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB 事务中止'))
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB 事务失败'))
    }
  })
}

export interface IndexedDbBlobStoreOptions {
  /** IDB 工厂（测试注入 fake-indexeddb）；缺省读 globalThis.indexedDB */
  factory?: IDBFactory
  dbName?: string
  storeName?: string
}

/**
 * 创建 IndexedDB 实现的 BlobStore。
 * 每次操作独立 open/close（简单可靠，无长连接泄漏问题）；20MB 内开销可忽略。
 */
export function createIndexedDbBlobStore(
  options: IndexedDbBlobStoreOptions = {},
): BlobStore {
  const dbName = options.dbName ?? BLOB_DB_NAME
  const storeName = options.storeName ?? BLOB_STORE_NAME

  function resolveFactory(): IDBFactory | null {
    if (options.factory !== undefined) return options.factory
    try {
      const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB
      return factory === undefined ? null : factory
    } catch {
      return null
    }
  }

  function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const factory = resolveFactory()
      if (factory === null) {
        reject(
          new BlobStoreError(
            '本地二进制存储（IndexedDB）不可用：素材仅在本次会话内可预览，刷新后需重新导入恢复预览',
          ),
        )
        return
      }
      let request: IDBOpenDBRequest
      try {
        request = factory.open(dbName)
      } catch (error) {
        reject(new BlobStoreError(`本地二进制存储打开失败（${describeError(error)}）`, { cause: error }))
        return
      }
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
      }
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(
          new BlobStoreError(
            `本地二进制存储打开失败（${describeError(request.error)}）`,
            { cause: request.error },
          ),
        )
      }
      request.onblocked = () => {
        reject(new BlobStoreError('本地二进制存储被其他页面占用，暂时无法访问'))
      }
    })
  }

  /** 统一包装：底层错误 → 可读 BlobStoreError（保留 cause） */
  function wrapOperationError(error: unknown, verb: string): BlobStoreError {
    if (error instanceof BlobStoreError) return error
    return new BlobStoreError(`本地二进制存储${verb}失败（${describeError(error)}）`, {
      cause: error,
    })
  }

  return {
    async saveBlob(key: string, file: File): Promise<void> {
      const db = await openDatabase()
      try {
        const bytes = await file.arrayBuffer() // 统一存字节，规避 File 克隆语义差异
        const transaction = db.transaction(storeName, 'readwrite')
        const objectStore = transaction.objectStore(storeName)
        const record: StoredBlobRecord = {
          key,
          fileName: file.name,
          fileType: file.type,
          lastModified: file.lastModified,
          bytes,
        }
        const done = transactionToPromise(transaction)
        objectStore.put(record, key)
        await done
      } catch (error) {
        throw wrapOperationError(error, '写入')
      } finally {
        db.close()
      }
    },

    async loadBlob(key: string): Promise<File | null> {
      const db = await openDatabase()
      try {
        const transaction = db.transaction(storeName, 'readonly')
        const objectStore = transaction.objectStore(storeName)
        const value: unknown = await requestToPromise(objectStore.get(key))
        return toFile(value)
      } catch (error) {
        throw wrapOperationError(error, '读取')
      } finally {
        db.close()
      }
    },

    async deleteBlob(key: string): Promise<void> {
      const db = await openDatabase()
      try {
        const transaction = db.transaction(storeName, 'readwrite')
        const objectStore = transaction.objectStore(storeName)
        const done = transactionToPromise(transaction)
        objectStore.delete(key)
        await done
      } catch (error) {
        throw wrapOperationError(error, '删除')
      } finally {
        db.close()
      }
    },

    async listBlobs(): Promise<string[]> {
      const db = await openDatabase()
      try {
        const transaction = db.transaction(storeName, 'readonly')
        const objectStore = transaction.objectStore(storeName)
        const keys = await requestToPromise(objectStore.getAllKeys())
        return keys.map((key) => String(key))
      } catch (error) {
        throw wrapOperationError(error, '读取')
      } finally {
        db.close()
      }
    },
  }
}

/** 默认单例：运行时读取 globalThis.indexedDB（测试可在渲染前替换为 fake-indexeddb） */
export const defaultBlobStore: BlobStore = createIndexedDbBlobStore()
