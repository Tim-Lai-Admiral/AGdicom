/**
 * 会话级 DICOM 缩略图生成（CR-007 T-002 / R-017）。
 *
 * 职责：素材会话字节（objectUrl）→ fetch → parseDicomFile → decodeDicomFrame 首帧
 * → canvas.toDataURL（PNG），供素材行缩略图（AssetGrid）与切片缩略图
 * （PatientGroupPanel）渲染真实首帧像素。
 *
 * 降级契约（R-017）：未解析 / 压缩传输语法 / 解码失败 / canvas 不可用 → 返回 null，
 * 调用方回退 SVG 占位，任何路径不崩溃。解析 / 像素解码复用查看器同一套实现
 * （parseDicom.ts / decodePixel.ts），与中央预览口径一致（自动 min-max）。
 *
 * 会话级缓存（不持久化、不入导出 JSON）：
 * - thumbCache：assetId → dataURL，仅成功结果；同一素材会话内只生成一次；
 * - failedThumbs：确定性失败（压缩 / 损坏 / canvas 不可用）标记，会话内不再重试；
 * - pendingThumbs：进行中去重，并发生成只执行一次。
 * 刷新页面后缓存随会话清空，blob 恢复重建 objectUrl 后按需重新生成（或保持占位）。
 */
import { parseDicomFile } from './parseDicom.ts'
import { decodeDicomFrame } from './decodePixel.ts'

/** 缩略图生成输入：素材 ID（缓存键）+ 会话 objectUrl（字节来源） */
export interface SliceThumbSource {
  id: string
  objectUrl?: string
}

/** 会话级缓存：assetId → 首帧 dataURL（仅成功结果） */
const thumbCache = new Map<string, string>()
/** 会话级失败标记：解析/解码/canvas 失败对同一字节是确定性结果，不重复尝试 */
const failedThumbs = new Set<string>()
/** 进行中去重：同一素材并发生成共享同一 Promise */
const pendingThumbs = new Map<string, Promise<string | null>>()

/** 已生成的缩略图；无条目 = 未生成（调用方渲染占位） */
export function getCachedSliceThumb(assetId: string): string | undefined {
  return thumbCache.get(assetId)
}

/** objectUrl → ArrayBuffer（与查看器解析共用同一读取口径） */
async function loadBytes(objectUrl: string): Promise<ArrayBuffer> {
  if (typeof fetch !== 'function') {
    throw new Error('当前环境不支持读取文件内容（fetch 不可用）')
  }
  const response = await fetch(objectUrl)
  if (!response.ok) throw new Error(`读取文件内容失败（HTTP ${response.status}）`)
  return await response.arrayBuffer()
}

/** 首帧 ImageData → PNG dataURL；无 document / canvas 不可用（jsdom 等）→ null */
function imageDataToDataUrl(image: ImageData): string | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * 生成某素材的首帧缩略图 dataURL（会话级缓存）。
 * @returns 成功 → PNG dataURL；未解析（无会话字节）/ 压缩 / 解码失败 /
 *          canvas 不可用 → null（调用方回退占位，不抛错、不崩溃）
 */
export async function generateSliceThumb(asset: SliceThumbSource): Promise<string | null> {
  const cached = thumbCache.get(asset.id)
  if (cached !== undefined) return cached
  if (failedThumbs.has(asset.id)) return null
  const pending = pendingThumbs.get(asset.id)
  if (pending !== undefined) return pending
  // 先登记 promise 再启动任务：保证同步完成的任务（如无 objectUrl 直接返回）
  // 也能在 finally 中正确清掉进行中标记（否则会残留已完成的 promise，后续调用
  // 永远拿到旧的 null 结果）。
  let settle!: (value: string | null) => void
  const task = new Promise<string | null>((resolve) => {
    settle = resolve
  })
  pendingThumbs.set(asset.id, task)
  void (async () => {
    try {
      if (asset.objectUrl === undefined) {
        // 无会话字节是暂态（刷新后 blob 未水合）：不标记失败，恢复后可重新生成
        settle(null)
        return
      }
      const buffer = await loadBytes(asset.objectUrl)
      const parsed = parseDicomFile(buffer)
      const image = decodeDicomFrame(parsed.dataset, 0)
      const dataUrl = imageDataToDataUrl(image)
      if (dataUrl === null) {
        failedThumbs.add(asset.id)
        settle(null)
        return
      }
      thumbCache.set(asset.id, dataUrl)
      settle(dataUrl)
    } catch {
      // 无法解析 / 压缩封装 / 像素解码失败等：确定性失败，会话内回退占位
      failedThumbs.add(asset.id)
      settle(null)
    } finally {
      pendingThumbs.delete(asset.id)
    }
  })()
  return task
}

/** 清空会话级缩略图缓存（仅测试使用：隔离用例间的缓存与失败标记） */
export function resetSliceThumbs(): void {
  thumbCache.clear()
  failedThumbs.clear()
  pendingThumbs.clear()
}
