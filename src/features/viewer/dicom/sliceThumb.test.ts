/**
 * 会话级 DICOM 缩略图生成器单测（CR-007 T-002 / R-017）。
 *
 * 覆盖：成功（合成样本真实解析 + 首帧解码 → dataURL）、会话缓存（不再读取字节）、
 * 进行中并发生成去重、失败缓存（读取失败/坏字节不再重试）、压缩封装降级（→ null
 * 占位）、无会话 objectUrl（→ null 且不请求）、canvas 不可用（→ null 占位）。
 *
 * jsdom 无 canvas 环境：以 HTMLCanvasElement.prototype spy 注入最小 2D 上下文与
 * toDataURL 桩（不破坏其他用例；真实解码路径仍走 parseDicomFile + decodeDicomFrame）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  JPEG_BASELINE_TRANSFER_SYNTAX_UID,
  buildDicomFile,
  gradientPixels8,
} from './__fixtures__/buildDicomFile.ts'
import { generateSliceThumb, getCachedSliceThumb, resetSliceThumbs } from './sliceThumb.ts'

const FAKE_DATA_URL = 'data:image/png;base64,Q0pU'

afterEach(() => {
  resetSliceThumbs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 注入 fetch 桩：返回注册的文件字节；未注册 → 404。返回 fetch mock 供断言 */
function stubFetch(buffers: Record<string, ArrayBuffer>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    const buffer = buffers[url]
    if (buffer === undefined) return { ok: false, status: 404 }
    return { ok: true, status: 200, arrayBuffer: async () => buffer }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** 注入 canvas 桩：jsdom 原生 getContext 返回 null（无法绘制），这里提供最小 2D 上下文 */
function stubCanvas(): { putImageData: ReturnType<typeof vi.fn> } {
  const putImageData = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ putImageData }) as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => FAKE_DATA_URL)
  return { putImageData }
}

describe('generateSliceThumb', () => {
  it('解码合成样本首帧为 dataURL 并写入会话缓存（R-017 成功路径）', async () => {
    // 8×8 渐变像素（10..240）：真实 parse + decode 后必非全黑（存在 0 与 255 灰度）
    const buffer = buildDicomFile({ pixelData: gradientPixels8(8, 8, 10, 240) })
    const fetchMock = stubFetch({ 'blob:s1': buffer })
    const { putImageData } = stubCanvas()

    const first = await generateSliceThumb({ id: 'a1', objectUrl: 'blob:s1' })
    expect(first).toBe(FAKE_DATA_URL)
    expect(getCachedSliceThumb('a1')).toBe(FAKE_DATA_URL)
    // 真实解码：首帧 ImageData 8×8、RGBA、非全黑（灰度含极值）
    expect(putImageData).toHaveBeenCalledTimes(1)
    const image = putImageData.mock.calls[0]?.[0] as ImageData
    expect(image.width).toBe(8)
    expect(image.height).toBe(8)
    expect(image.data.length).toBe(8 * 8 * 4)
    expect(image.data[3]).toBe(255)
    expect(Array.from(image.data.slice(0, 8))).toContain(0)
    expect(Array.from(image.data.slice(0, 8))).toContain(255)

    // 会话缓存：再次生成不再读取字节
    const second = await generateSliceThumb({ id: 'a1', objectUrl: 'blob:s1' })
    expect(second).toBe(FAKE_DATA_URL)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('同一素材并发生成只读取一次字节（进行中去重）', async () => {
    const buffer = buildDicomFile({})
    const fetchMock = stubFetch({ 'blob:dup': buffer })
    stubCanvas()

    const [a, b] = await Promise.all([
      generateSliceThumb({ id: 'dup', objectUrl: 'blob:dup' }),
      generateSliceThumb({ id: 'dup', objectUrl: 'blob:dup' }),
    ])
    expect(a).toBe(FAKE_DATA_URL)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('读取失败/坏字节 → null，且失败后会话内不再重试', async () => {
    const fetchMock = stubFetch({ 'blob:junk': new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer })
    stubCanvas()

    // objectUrl 未注册（404）
    expect(await generateSliceThumb({ id: 'miss', objectUrl: 'blob:missing' })).toBeNull()
    // 非法 DICOM 字节（解析失败）
    expect(await generateSliceThumb({ id: 'junk', objectUrl: 'blob:junk' })).toBeNull()
    expect(getCachedSliceThumb('miss')).toBeUndefined()

    // 失败标记：重复调用不再发起请求
    await generateSliceThumb({ id: 'miss', objectUrl: 'blob:missing' })
    await generateSliceThumb({ id: 'junk', objectUrl: 'blob:junk' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('压缩封装像素（如 JPEG）→ null 占位，不崩溃（R-017 降级路径）', async () => {
    const buffer = buildDicomFile({
      transferSyntax: JPEG_BASELINE_TRANSFER_SYNTAX_UID,
      encapsulatedPixelData: true,
    })
    stubFetch({ 'blob:jpeg': buffer })
    stubCanvas()

    expect(await generateSliceThumb({ id: 'jpeg', objectUrl: 'blob:jpeg' })).toBeNull()
    expect(getCachedSliceThumb('jpeg')).toBeUndefined()
  })

  it('无会话 objectUrl（刷新后/未水合）→ null 且不请求，恢复后可重新生成', async () => {
    const fetchMock = stubFetch({})
    expect(await generateSliceThumb({ id: 'ghost', objectUrl: undefined })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    // blob 水合恢复 objectUrl 后：可成功生成（缺失字节是暂态，不缓存失败标记）
    stubFetch({ 'blob:revived': buildDicomFile({}) })
    stubCanvas()
    expect(await generateSliceThumb({ id: 'ghost', objectUrl: 'blob:revived' })).toBe(FAKE_DATA_URL)
  })

  it('canvas 不可用（jsdom 原生 getContext → null）→ null 占位', async () => {
    const buffer = buildDicomFile({})
    stubFetch({ 'blob:noCanvas': buffer })
    // jsdom 未安装 canvas 包：getContext 原生返回 null（spy 显式模拟，避免控制台噪音）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)

    expect(await generateSliceThumb({ id: 'noCanvas', objectUrl: 'blob:noCanvas' })).toBeNull()
    expect(getCachedSliceThumb('noCanvas')).toBeUndefined()
  })
})
