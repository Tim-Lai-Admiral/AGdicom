/**
 * 无压缩 DICOM 像素解码 + min-max 灰度归一化（CR-001 T-005 / R-003）。
 *
 * 仅支持无压缩 Little Endian（Explicit/Implicit VR）的 8/16-bit 灰度像素：
 * - 压缩传输语法（JPEG 等）、Big Endian、其他位深/彩色采样 → 抛 DicomPixelUnsupportedError，
 *   由上层走“仅元数据”降级（其余元数据仍展示，应用不崩溃）；
 * - 灰度值 = 原始采样 × RescaleSlope + RescaleIntercept（缺省 1/0）；
 * - min-max 归一化到 0..255（恒定图像输出中间灰度 128）；
 * - MONOCHROME1 按 PhotometricInterpretation 反转（MONOCHROME2 / 缺省不反转）。
 */
import type { DataSet } from 'dicom-parser'

/** Implicit VR Little Endian（无压缩） */
export const IMPLICIT_VR_LITTLE_ENDIAN_UID = '1.2.840.10008.1.2'
/** Explicit VR Little Endian（无压缩） */
export const EXPLICIT_VR_LITTLE_ENDIAN_UID = '1.2.840.10008.1.2.1'

/** “仅元数据”类降级：传输语法 / 像素编码不受支持（message 可直接展示） */
export class DicomPixelUnsupportedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DicomPixelUnsupportedError'
  }
}

/** 像素数据异常：缺失 / 长度不足等（同样走降级路径，message 可直接展示） */
export class DicomPixelDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DicomPixelDecodeError'
  }
}

/** 传输语法是否为浏览器内可解码的无压缩 Little Endian */
export function isUncompressedLittleEndian(transferSyntax: string | undefined): boolean {
  return (
    transferSyntax === IMPLICIT_VR_LITTLE_ENDIAN_UID ||
    transferSyntax === EXPLICIT_VR_LITTLE_ENDIAN_UID
  )
}

/** NumberOfFrames（IS）；缺失或非法时按单帧处理 */
function numberOfFrames(dataset: DataSet): number {
  const raw = dataset.intString('x00280008')
  return raw !== undefined && Number.isFinite(raw) && raw >= 1 ? raw : 1
}

/** RescaleSlope：缺省 1；DICOM 规定不应为 0，防御性回退为 1 */
function rescaleSlopeOf(dataset: DataSet): number {
  const slope = dataset.floatString('x00281053')
  return slope !== undefined && Number.isFinite(slope) && slope !== 0 ? slope : 1
}

/** 读取单个采样值（bitsAllocated 8/16，按需带符号；小端） */
function readSample(view: DataView, index: number, bitsAllocated: number, signed: boolean): number {
  if (bitsAllocated === 8) return signed ? view.getInt8(index) : view.getUint8(index)
  return signed ? view.getInt16(index * 2, true) : view.getUint16(index * 2, true)
}

/** ImageData 构造：浏览器用原生构造器；无 ImageData 的环境（jsdom）返回结构兼容对象 */
function createImageData(data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): ImageData {
  if (typeof ImageData === 'function') return new ImageData(data, width, height)
  return { data, width, height, colorSpace: 'srgb' } as ImageData
}

/**
 * 解码指定帧为灰度 ImageData（min-max 归一化）。
 * @param dataset parseDicomFile 产出的 dicom-parser 数据集
 * @param frameIndex 帧序号（0 起，多帧文件用；默认 0）
 * @throws DicomPixelUnsupportedError 压缩/不支持的传输语法或像素编码（“仅元数据”降级）
 * @throws DicomPixelDecodeError 像素数据缺失、长度不足或帧序号越界
 */
export function decodeDicomFrame(dataset: DataSet, frameIndex = 0): ImageData {
  const transferSyntax = dataset.string('x00020010')
  if (!isUncompressedLittleEndian(transferSyntax)) {
    throw new DicomPixelUnsupportedError(
      `该文件的传输语法（${transferSyntax ?? '未知'}）不是无压缩 Little Endian，无法解码像素：仅元数据`,
    )
  }

  const pixelElement = dataset.elements.x7fe00010
  if (pixelElement === undefined || pixelElement.length === 0) {
    throw new DicomPixelDecodeError('该文件不含可用的像素数据（PixelData 缺失或为空）：仅元数据')
  }
  if (pixelElement.encapsulatedPixelData === true || pixelElement.hadUndefinedLength === true) {
    throw new DicomPixelUnsupportedError(
      '像素数据为压缩封装编码（如 JPEG）：仅元数据，不支持切片预览',
    )
  }

  const samplesPerPixel = dataset.uint16('x00280002') ?? 1
  if (samplesPerPixel !== 1) {
    throw new DicomPixelUnsupportedError(
      `仅支持单采样灰度像素（当前 SamplesPerPixel=${samplesPerPixel}）：仅元数据`,
    )
  }
  const photometric = dataset.string('x00280004')
  if (photometric !== undefined && photometric !== 'MONOCHROME1' && photometric !== 'MONOCHROME2') {
    throw new DicomPixelUnsupportedError(
      `仅支持 MONOCHROME1/2 灰度预览（当前 ${photometric}）：仅元数据`,
    )
  }
  const invert = photometric === 'MONOCHROME1'

  const rows = dataset.uint16('x00280010')
  const columns = dataset.uint16('x00280011')
  if (rows === undefined || columns === undefined || rows === 0 || columns === 0) {
    throw new DicomPixelDecodeError('缺少有效的 Rows/Columns，无法解码像素：仅元数据')
  }

  const bitsAllocated = dataset.uint16('x00280100')
  if (bitsAllocated !== 8 && bitsAllocated !== 16) {
    throw new DicomPixelUnsupportedError(
      `仅支持 8/16-bit 像素解码（当前 BitsAllocated=${bitsAllocated ?? '未知'}）：仅元数据`,
    )
  }

  const signed = dataset.uint16('x00280103') === 1
  const frames = numberOfFrames(dataset)
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= frames) {
    throw new DicomPixelDecodeError(`帧序号超出范围（0..${frames - 1}，请求 ${frameIndex}）`)
  }

  const bytesPerSample = bitsAllocated / 8
  const sampleCount = rows * columns
  const frameByteCount = sampleCount * bytesPerSample
  const frameByteOffset = frameIndex * frameByteCount
  if (pixelElement.length < frameByteOffset + frameByteCount) {
    throw new DicomPixelDecodeError('像素数据长度不足（文件可能被截断）：仅元数据')
  }

  const bytes = dataset.byteArray as Uint8Array
  const frameView = new DataView(
    bytes.buffer,
    bytes.byteOffset + pixelElement.dataOffset + frameByteOffset,
    frameByteCount,
  )

  const slope = rescaleSlopeOf(dataset)
  const intercept = dataset.floatString('x00281052') ?? 0

  // 第一遍：Rescale 后计算 min/max
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < sampleCount; i += 1) {
    const value = readSample(frameView, i, bitsAllocated, signed) * slope + intercept
    if (value < min) min = value
    if (value > max) max = value
  }

  // 第二遍：min-max 归一化 → 8-bit 灰度（恒定图像输出 128，避免“全黑预览”误导）
  const range = max - min
  const rgba = new Uint8ClampedArray(sampleCount * 4)
  for (let i = 0; i < sampleCount; i += 1) {
    const value = readSample(frameView, i, bitsAllocated, signed) * slope + intercept
    const normalized = range === 0 ? 128 : Math.round(((value - min) / range) * 255)
    const gray = invert ? 255 - normalized : normalized
    const offset = i * 4
    rgba[offset] = gray
    rgba[offset + 1] = gray
    rgba[offset + 2] = gray
    rgba[offset + 3] = 255
  }

  return createImageData(rgba, columns, rows)
}
