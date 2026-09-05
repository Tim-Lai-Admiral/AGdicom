/**
 * 测量工具的纯计算层（CR-003 T-003 / R-010，Mock 模式）。
 *
 * 距离口径（R-010）：
 * - PixelSpacing 可用（[行间距, 列间距] 均为正有限值）→ 按像素间距确定性计算毫米值；
 *   行间距作用于纵向（y），列间距作用于横向（x），与 DICOM (0028,0030) 语义一致；
 * - 不可用 → Mock：直接取图像像素距离，标注“模拟”，不宣称毫米口径。
 *
 * 结果不持久化（切换素材/切片即清空），不构成任何临床结论。
 */

/** 测量端点（图像像素坐标，原点为图像左上角） */
export interface MeasurePoint {
  x: number
  y: number
}

/** 测量长度：mm = 按像素间距的确定性计算；mock = 画布（图像）像素比例的模拟值 */
export type MeasureLength = { kind: 'mm'; value: number } | { kind: 'mock'; value: number }

/** getBoundingClientRect 的最小结构（便于测试以普通对象替身） */
export interface DomRectLike {
  left: number
  top: number
  width: number
  height: number
}

/** 数值保留 1 位小数（四舍五入），标注展示与单测断言的统一口径 */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** PixelSpacing 是否可用：数组且前两项均为正有限数 */
function isUsablePixelSpacing(pixelSpacing?: readonly number[]): boolean {
  return (
    Array.isArray(pixelSpacing) &&
    pixelSpacing.length >= 2 &&
    Number.isFinite(pixelSpacing[0]) &&
    Number.isFinite(pixelSpacing[1]) &&
    (pixelSpacing[0] as number) > 0 &&
    (pixelSpacing[1] as number) > 0
  )
}

/**
 * 两端点距离：PixelSpacing 可用 → 确定性毫米值；否则 Mock（图像像素距离）。
 * @param a 起点（图像像素坐标）
 * @param b 终点（图像像素坐标）
 * @param pixelSpacing DicomMeta.pixelSpacing（[行间距, 列间距] mm），可缺省
 */
export function measureLength(a: MeasurePoint, b: MeasurePoint, pixelSpacing?: readonly number[]): MeasureLength {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (isUsablePixelSpacing(pixelSpacing)) {
    const rowSpacing = (pixelSpacing as number[])[0]
    const colSpacing = (pixelSpacing as number[])[1]
    return { kind: 'mm', value: round1(Math.hypot(dx * colSpacing, dy * rowSpacing)) }
  }
  return { kind: 'mock', value: round1(Math.hypot(dx, dy)) }
}

/** 距离标注文案：mm 值直接展示；mock 值以“≈/px/（模拟）”明示非临床口径 */
export function formatMeasureLength(length: MeasureLength): string {
  if (length.kind === 'mm') return `${length.value.toFixed(1)} mm`
  return `≈ ${length.value.toFixed(1)} px（模拟）`
}

/**
 * 指针坐标 → 图像像素坐标（canvas 以 object-fit: contain 等比缩放并居中）。
 * 缩放比 = min(盒宽/图宽, 盒高/图高)，内容在盒内水平/垂直居中，出界点收拢到图像边界。
 * 任何尺寸非法（0 或负数）时返回原点，保证不抛错。
 */
export function clientToImagePoint(
  clientX: number,
  clientY: number,
  rect: DomRectLike,
  imageWidth: number,
  imageHeight: number,
): MeasurePoint {
  if (imageWidth <= 0 || imageHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 }
  }
  const scale = Math.min(rect.width / imageWidth, rect.height / imageHeight)
  const contentWidth = imageWidth * scale
  const contentHeight = imageHeight * scale
  const originX = rect.left + (rect.width - contentWidth) / 2
  const originY = rect.top + (rect.height - contentHeight) / 2
  const x = (clientX - originX) / scale
  const y = (clientY - originY) / scale
  return {
    x: Math.min(Math.max(x, 0), imageWidth),
    y: Math.min(Math.max(y, 0), imageHeight),
  }
}
