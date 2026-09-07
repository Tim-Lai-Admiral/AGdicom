/**
 * 资产 ↔ IndexedDB blob 桥接助手（CR-006 T-003 / R-016）。
 *
 * - restoreAssetBlobs：App 启动时按去重键匹配资产与已入库 blob，重建会话
 *   objectUrl（幽灵资产有 blob → 复活，无需重导入）；单个资产失败仅跳过，
 *   存储不可用返回 error 由调用方决定是否提示。
 * - deleteAssetBlob：删除资产时按去重键级联删除 blob（R-015/R-016）；失败仅
 *   console.warn，不阻塞删除主流程。
 *
 * blob 键 = importAssets.dedupKey（kind\0fileSize\0fileName），与 T-002 水合
 * 索引一致；jsdom 无 createObjectURL 时跳过重建（与 useImport 同一守卫）。
 */
import type { Asset } from '../../domain/types.ts'
import { defaultBlobStore } from '../../store/blobStore.ts'
import type { BlobStore } from '../../store/blobStore.ts'
import { dedupKey } from './importAssets.ts'

/** 启动恢复结果：objectUrls 为 assetId → 重建的 objectUrl（仅成功恢复项） */
export interface BlobRestoreResult {
  objectUrls: Record<string, string>
  /** 存储不可用等基础设施失败消息；null 表示正常（含“无 blob 可恢复”） */
  error: string | null
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return String(error)
}

/** jsdom 未实现 URL.createObjectURL：缺失时跳过重建（素材记录与列表不依赖它） */
function createObjectUrlSafely(blob: Blob): string | undefined {
  if (typeof URL.createObjectURL !== 'function') return undefined
  return URL.createObjectURL(blob)
}

/**
 * 启动恢复（R-016）：列出已入库 blob 键，为“无 objectUrl 且键匹配”的资产重建
 * 会话 objectUrl。已有 objectUrl 的资产（会话内刚导入/已水合）跳过；
 * 单个 blob 读取失败或环境不支持 createObjectURL 时跳过该资产（保持幽灵态，
 * 重导入可走 R-014 水合兜底）。
 */
export async function restoreAssetBlobs(
  assets: Record<string, Asset>,
  store: BlobStore = defaultBlobStore,
): Promise<BlobRestoreResult> {
  let keys: string[]
  try {
    keys = await store.listBlobs()
  } catch (error) {
    return { objectUrls: {}, error: describeError(error) }
  }
  const keySet = new Set(keys)
  const objectUrls: Record<string, string> = {}
  for (const asset of Object.values(assets)) {
    if (asset.objectUrl !== undefined) continue
    const key = dedupKey(asset.file.fileName, asset.file.fileSize, asset.kind)
    if (!keySet.has(key)) continue
    try {
      const blob = await store.loadBlob(key)
      if (blob === null) continue
      const url = createObjectUrlSafely(blob)
      if (url === undefined) continue
      objectUrls[asset.id] = url
    } catch {
      // 单个 blob 读取失败：跳过该资产，不中断整体恢复
    }
  }
  return { objectUrls, error: null }
}

/**
 * 删除资产时级联删除其 blob（R-015 × R-016）。删除失败（如存储不可用）不抛出、
 * 不阻塞删除主流程：仅 console.warn（残留 blob 无害，同名文件重导入时覆盖写入）。
 */
export async function deleteAssetBlob(
  asset: Pick<Asset, 'file' | 'kind'>,
  store: BlobStore = defaultBlobStore,
): Promise<void> {
  const key = dedupKey(asset.file.fileName, asset.file.fileSize, asset.kind)
  try {
    await store.deleteBlob(key)
  } catch (error) {
    console.warn(`删除素材本地二进制失败（键 ${key}），不影响素材删除：`, error)
  }
}
