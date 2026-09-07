/**
 * IndexedDB 二进制存储层单测（CR-006 T-003 / R-016）。
 *
 * jsdom 无 IndexedDB：用 fake-indexeddb（devDep）注入 IDBFactory；
 * 每个用例 new IDBFactory() 保证库隔离。失败路径用注入的坏工厂 / 摘除
 * globalThis.indexedDB 覆盖。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  BLOB_DB_NAME,
  BLOB_MAX_BYTES,
  BLOB_STORE_NAME,
  BlobStoreError,
  createIndexedDbBlobStore,
  defaultBlobStore,
} from './blobStore.ts'

function makeFile(name: string, size = 32, type = ''): File {
  return new File([new Uint8Array(size)], name, { type })
}

/** blob 键与去重键同构（importAssets.dedupKey 的格式，此处直接字面量构造） */
function keyFor(fileName: string, fileSize: number, kind = 'image'): string {
  return `${kind}\u0000${fileSize}\u0000${fileName}`
}

describe('blobStore（fake-indexeddb）', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory
  })
  afterEach(() => {
    delete (globalThis as { indexedDB?: unknown }).indexedDB
  })

  it('round-trips save → load preserving file metadata and content', async () => {
    const store = defaultBlobStore
    const file = makeFile('heart.png', 64, 'image/png')
    await store.saveBlob(keyFor('heart.png', 64), file)
    const loaded = await store.loadBlob(keyFor('heart.png', 64))
    expect(loaded).not.toBeNull()
    expect(loaded?.name).toBe('heart.png')
    expect(loaded?.type).toBe('image/png')
    expect(loaded?.size).toBe(64)
  })

  it('overwrites the blob under the same key', async () => {
    const store = defaultBlobStore
    await store.saveBlob(keyFor('heart.png', 64), makeFile('heart.png', 64, 'image/png'))
    await store.saveBlob(keyFor('heart.png', 64), makeFile('heart.png', 96, 'image/png'))
    const keys = await store.listBlobs()
    expect(keys).toEqual([keyFor('heart.png', 64)])
    const loaded = await store.loadBlob(keyFor('heart.png', 64))
    expect(loaded?.size).toBe(96)
  })

  it('returns null for missing keys and removes blobs on delete', async () => {
    const store = defaultBlobStore
    expect(await store.loadBlob(keyFor('missing.dcm', 8, 'dicom'))).toBeNull()
    await store.saveBlob(keyFor('heart.png', 64), makeFile('heart.png', 64))
    await store.saveBlob(keyFor('scan.dcm', 8, 'dicom'), makeFile('scan.dcm', 8))
    await store.deleteBlob(keyFor('heart.png', 64))
    expect(await store.loadBlob(keyFor('heart.png', 64))).toBeNull()
    expect(await store.loadBlob(keyFor('scan.dcm', 8, 'dicom'))).not.toBeNull()
    expect(await store.listBlobs()).toEqual([keyFor('scan.dcm', 8, 'dicom')])
    // 删除不存在的键：静默成功
    await expect(store.deleteBlob(keyFor('gone.stl', 4, 'model'))).resolves.toBeUndefined()
  })

  it('lists all keys after batched saves', async () => {
    const store = defaultBlobStore
    await store.saveBlob(keyFor('a.png', 1), makeFile('a.png', 1))
    await store.saveBlob(keyFor('b.dcm', 2, 'dicom'), makeFile('b.dcm', 2))
    await store.saveBlob(keyFor('c.stl', 3, 'model'), makeFile('c.stl', 3))
    const keys = await store.listBlobs()
    expect(keys).toHaveLength(3)
    expect(keys).toContain(keyFor('a.png', 1))
    expect(keys).toContain(keyFor('b.dcm', 2, 'dicom'))
    expect(keys).toContain(keyFor('c.stl', 3, 'model'))
  })

  it('exposes the 20MB threshold and default db/store names', () => {
    expect(BLOB_MAX_BYTES).toBe(20 * 1024 * 1024)
    expect(BLOB_DB_NAME).toBe('ag-review-workbench-blobs')
    expect(BLOB_STORE_NAME).toBe('blobs')
  })

  it('isolates stores by injected dbName/storeName', async () => {
    const isolated = createIndexedDbBlobStore({ dbName: 'other-db', storeName: 'other-store' })
    await isolated.saveBlob(keyFor('a.png', 1), makeFile('a.png', 1))
    await expect(defaultBlobStore.listBlobs()).resolves.toEqual([])
    await expect(isolated.listBlobs()).resolves.toEqual([keyFor('a.png', 1)])
  })

  it('rejects with a readable BlobStoreError when IndexedDB is unavailable', async () => {
    delete (globalThis as { indexedDB?: unknown }).indexedDB
    const store = defaultBlobStore
    await expect(store.saveBlob('k', makeFile('a.png'))).rejects.toThrow(BlobStoreError)
    await expect(store.saveBlob('k', makeFile('a.png'))).rejects.toThrow(/IndexedDB.*不可用/)
    await expect(store.loadBlob('k')).rejects.toThrow(BlobStoreError)
    await expect(store.deleteBlob('k')).rejects.toThrow(BlobStoreError)
    await expect(store.listBlobs()).rejects.toThrow(BlobStoreError)
  })

  it('wraps factory failures into readable BlobStoreError', async () => {
    const brokenFactory = {
      open: () => {
        throw new Error('boom')
      },
    } as unknown as IDBFactory
    const store = createIndexedDbBlobStore({ factory: brokenFactory })
    const error = await store.saveBlob('k', makeFile('a.png')).then(
      () => null,
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(BlobStoreError)
    expect((error as BlobStoreError).message).toContain('打开失败')
    expect((error as BlobStoreError).message).toContain('boom')
  })

  it('wraps unexpected save failures into readable BlobStoreError', async () => {
    // 伪 File（无 arrayBuffer 方法）：保存路径的意外异常须包装为可读 BlobStoreError
    const store = defaultBlobStore
    await expect(
      store.saveBlob('k', { notAFile: true } as unknown as File),
    ).rejects.toThrow(BlobStoreError)
    await expect(
      store.saveBlob('k', { notAFile: true } as unknown as File),
    ).rejects.toThrow(/写入失败/)
  })

  it('treats corrupt stored records as missing on load', async () => {
    // 直接写入非法记录（非包装对象），loadBlob 应返回 null 而非抛错
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(BLOB_DB_NAME)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(BLOB_STORE_NAME)) {
          request.result.createObjectStore(BLOB_STORE_NAME)
        }
      }
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
    const tx = db.transaction(BLOB_STORE_NAME, 'readwrite')
    tx.objectStore(BLOB_STORE_NAME).put('not-a-record', keyFor('weird.png', 1))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
    await expect(defaultBlobStore.loadBlob(keyFor('weird.png', 1))).resolves.toBeNull()
  })
})
