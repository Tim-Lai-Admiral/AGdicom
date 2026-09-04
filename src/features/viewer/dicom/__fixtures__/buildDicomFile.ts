/**
 * 测试 fixture：最小 DICOM Part 10 文件构造器（CR-001 T-005）。
 *
 * 背景：T-009 合成样本脚本尚未产出，测试需要可被 dicom-parser 真实解析的 DICOM 字节。
 * 方案：在代码内手工构造标准 Part 10 文件（128 字节 preamble + "DICM" + 显式 VR 小端
 * 文件元组 (0002,xxxx) + 数据集），数据集支持 Explicit / Implicit VR Little Endian 两种
 * 编码，像素数据支持 8/16-bit、多帧与压缩封装（未定义长度）结构，用于覆盖解析、
 * 像素解码与降级路径。文件体积仅几百字节。
 *
 * 仅测试使用，不进入应用构建产物（无应用模块导入本文件）。
 */

/** 数据集 VR 编码方式（文件元组 (0002,xxxx) 恒为 Explicit VR LE，与数据集编码无关） */
export type DicomFixtureEncoding = 'explicit' | 'implicit'

export interface DicomFixtureOptions {
  /** 数据集编码；默认 explicit（配 transferSyntax=Explicit VR LE） */
  encoding?: DicomFixtureEncoding
  /** (0002,0010) TransferSyntax UID；默认 Explicit VR Little Endian */
  transferSyntax?: string
  /** (0008,0060) Modality；默认 'CT'。null = 不写入该元素 */
  modality?: string | null
  /** (0008,0016) SOP Class UID；默认 CT Image Storage。null = 不写入 */
  sopClassUID?: string | null
  /** (0020,000E) SeriesInstanceUID；默认内置合成 UID。null = 不写入 */
  seriesInstanceUID?: string | null
  /** (0020,0013) InstanceNumber（IS 原文）；默认 '1'。null = 不写入 */
  instanceNumber?: string | null
  /** (0010,0010) PatientName；默认 'DOE^JOHN'。null = 不写入，'' = 空值 */
  patientName?: string | null
  /** (0010,0020) PatientID；默认 'PID-001'。null = 不写入，'' = 空值 */
  patientID?: string | null
  /** (0012,0062) PatientIdentityRemoved；默认不写入。'YES'/'NO'/null = 不写入 */
  patientIdentityRemoved?: string | null
  /** (0012,0063) DeidentificationMethod；默认不写入。null = 不写入 */
  deidentificationMethod?: string | null
  /** (0028,0010) Rows；默认 8 */
  rows?: number
  /** (0028,0011) Columns；默认 8 */
  columns?: number
  /** (0028,0100) BitsAllocated；默认 8 */
  bitsAllocated?: 8 | 16
  /** (0028,0103) PixelRepresentation：0=无符号（默认），1=有符号 */
  pixelRepresentation?: 0 | 1
  /** (0028,0004) PhotometricInterpretation；默认 'MONOCHROME2' */
  photometricInterpretation?: string
  /** (0028,0002) SamplesPerPixel；默认 1 */
  samplesPerPixel?: number
  /** (0028,0030) PixelSpacing（DS，反斜杠分隔原文）；默认 '0.5\\0.5'。null = 不写入 */
  pixelSpacing?: string | null
  /** (0028,1052) RescaleIntercept（DS 原文）；默认 '0' */
  rescaleIntercept?: string
  /** (0028,1053) RescaleSlope（DS 原文）；默认 '1' */
  rescaleSlope?: string
  /** (0028,0008) NumberOfFrames（IS 原文）；默认不写入（单帧）。null = 不写入 */
  numberOfFrames?: string | null
  /**
   * (7FE0,0010) 像素数据原始字节（调用方保证长度 = rows*columns*(bits/8)*帧数）。
   * 缺省为全零；new Uint8Array(0) 表示写入零长度元素（测试“不含可用像素”分支）。
   */
  pixelData?: Uint8Array
  /** 以未定义长度 + 项（item）序列封装 (7FE0,0010)，模拟压缩封装结构（编码固定为 explicit） */
  encapsulatedPixelData?: boolean
}

const textEncoder = new TextEncoder()

/** DICOM Part 10 默认 UID（与常见真实取值一致，便于可读性断言） */
export const CT_IMAGE_STORAGE_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.2'
export const EXPLICIT_VR_LITTLE_ENDIAN_UID = '1.2.840.10008.1.2.1'
export const IMPLICIT_VR_LITTLE_ENDIAN_UID = '1.2.840.10008.1.2'
export const JPEG_BASELINE_TRANSFER_SYNTAX_UID = '1.2.840.10008.1.2.4.50'
/** 内置合成 series UID（buildDicomSeriesBuffers 默认共用，保证同 series） */
export const FIXTURE_SERIES_INSTANCE_UID = '1.2.826.0.1.3680043.8.498.1000.2'

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff])
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >>> 24) & 0xff,
  ])
}

/** '7fe00010' → 小端 tag 字节（组 + 元素各 2 字节） */
function tagBytes(tag: string): Uint8Array {
  const group = Number.parseInt(tag.slice(0, 4), 16)
  const element = Number.parseInt(tag.slice(4, 8), 16)
  return new Uint8Array([
    group & 0xff,
    (group >> 8) & 0xff,
    element & 0xff,
    (element >> 8) & 0xff,
  ])
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0
  for (const part of parts) length += part.length
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** 使用 32 位长度字的 VR（PS3.5 表 6.2-1） */
const LONG_LENGTH_VRS = new Set(['OB', 'OW', 'OF', 'OD', 'OL', 'SQ', 'UN', 'UC', 'UR', 'UT'])

/** Explicit VR 元素：tag(4) + VR(2) + [保留(2)+长度(4) | 长度(2)] + 值 */
function explicitElement(tag: string, vr: string, value: Uint8Array): Uint8Array {
  const head = concat([tagBytes(tag), textEncoder.encode(vr)])
  if (LONG_LENGTH_VRS.has(vr)) return concat([head, u16(0), u32(value.length), value])
  return concat([head, u16(value.length), value])
}

/** Implicit VR 元素：tag(4) + 长度(4) + 值 */
function implicitElement(tag: string, value: Uint8Array): Uint8Array {
  return concat([tagBytes(tag), u32(value.length), value])
}

function ascii(text: string): Uint8Array {
  return textEncoder.encode(text)
}

/** 补齐到偶数字节（字符串 VR 用空格/NUL 填充，数值 VR 天然偶数） */
function padEven(bytes: Uint8Array, padCharCode: string): Uint8Array {
  if (bytes.length % 2 === 0) return bytes
  const out = new Uint8Array(bytes.length + 1)
  out.set(bytes)
  out[bytes.length] = padCharCode.charCodeAt(0)
  return out
}

/** 字符串值（默认空格补偶数；UID 类传 '\0'） */
function dicomString(text: string, pad = ' '): Uint8Array {
  return padEven(ascii(text), pad)
}

/** 封装像素数据结构：(7FE0,0010) OB 未定义长度 + 空 BOT 项 + 一个数据项 + 序列结束符 */
function encapsulatedPixelElement(fragment: Uint8Array): Uint8Array {
  const UNDEFINED_LENGTH = 0xffffffff
  const basicOffsetTableItem = concat([tagBytes('fffde000'), u32(0)])
  const fragmentItem = concat([tagBytes('fffde000'), u32(fragment.length), fragment])
  const sequenceDelimiter = concat([tagBytes('fffde0dd'), u32(0)])
  return concat([
    tagBytes('7fe00010'),
    ascii('OB'),
    u16(0),
    u32(UNDEFINED_LENGTH),
    basicOffsetTableItem,
    fragmentItem,
    sequenceDelimiter,
  ])
}

/** 构造完整的最小 DICOM Part 10 文件（返回文件的 ArrayBuffer） */
export function buildDicomFile(options: DicomFixtureOptions = {}): ArrayBuffer {
  const encoding = options.encoding ?? 'explicit'
  const {
    transferSyntax = EXPLICIT_VR_LITTLE_ENDIAN_UID,
    modality = 'CT',
    sopClassUID = CT_IMAGE_STORAGE_SOP_CLASS_UID,
    seriesInstanceUID = FIXTURE_SERIES_INSTANCE_UID,
    instanceNumber = '1',
    patientName = 'DOE^JOHN',
    patientID = 'PID-001',
    patientIdentityRemoved = null,
    deidentificationMethod = null,
    rows = 8,
    columns = 8,
    bitsAllocated = 8,
    pixelRepresentation = 0,
    photometricInterpretation = 'MONOCHROME2',
    samplesPerPixel = 1,
    pixelSpacing = '0.5\\0.5',
    rescaleIntercept = '0',
    rescaleSlope = '1',
    numberOfFrames = null,
  } = options

  const el =
    encoding === 'implicit'
      ? (tag: string, _vr: string, value: Uint8Array) => implicitElement(tag, value)
      : (tag: string, vr: string, value: Uint8Array) => explicitElement(tag, vr, value)

  // ---- 文件元组（0002,xxxx）：恒为 Explicit VR Little Endian（PS3.10）----
  const sopInstanceUID = `1.2.826.0.1.3680043.8.498.1000.1.${instanceNumber}`
  const metaBodyParts: Uint8Array[] = [
    explicitElement('00020001', 'OB', new Uint8Array([0x00, 0x01])),
    explicitElement('00020003', 'UI', dicomString(sopInstanceUID, '\0')),
    explicitElement('00020010', 'UI', dicomString(transferSyntax, '\0')),
  ]
  if (sopClassUID !== null) {
    metaBodyParts.splice(1, 0, explicitElement('00020002', 'UI', dicomString(sopClassUID, '\0')))
  }
  const metaBody = concat(metaBodyParts)
  // (0002,0000) 组长度 = 该元素之后元组部分的字节数
  const meta = concat([explicitElement('00020000', 'UL', u32(metaBody.length)), metaBody])

  // ---- 数据集（按 tag 升序）----
  const dataset: Uint8Array[] = []
  if (sopClassUID !== null) dataset.push(el('00080016', 'UI', dicomString(sopClassUID, '\0')))
  dataset.push(el('00080018', 'UI', dicomString(sopInstanceUID, '\0')))
  if (modality !== null) dataset.push(el('00080060', 'CS', dicomString(modality)))
  if (patientName !== null) dataset.push(el('00100010', 'PN', dicomString(patientName)))
  if (patientID !== null) dataset.push(el('00100020', 'LO', dicomString(patientID)))
  if (patientIdentityRemoved !== null) {
    dataset.push(el('00120062', 'CS', dicomString(patientIdentityRemoved)))
  }
  if (deidentificationMethod !== null) {
    dataset.push(el('00120063', 'LO', dicomString(deidentificationMethod)))
  }
  if (seriesInstanceUID !== null) dataset.push(el('0020000e', 'UI', dicomString(seriesInstanceUID, '\0')))
  if (instanceNumber !== null) dataset.push(el('00200013', 'IS', dicomString(instanceNumber)))
  dataset.push(el('00280002', 'US', u16(samplesPerPixel)))
  dataset.push(el('00280004', 'CS', dicomString(photometricInterpretation)))
  dataset.push(el('00280010', 'US', u16(rows)))
  dataset.push(el('00280011', 'US', u16(columns)))
  if (pixelSpacing !== null) dataset.push(el('00280030', 'DS', dicomString(pixelSpacing)))
  dataset.push(el('00280100', 'US', u16(bitsAllocated)))
  dataset.push(el('00280101', 'US', u16(bitsAllocated)))
  dataset.push(el('00280102', 'US', u16(bitsAllocated - 1)))
  dataset.push(el('00280103', 'US', u16(pixelRepresentation)))
  if (numberOfFrames !== null) dataset.push(el('00280008', 'IS', dicomString(numberOfFrames)))
  dataset.push(el('00281052', 'DS', dicomString(rescaleIntercept)))
  dataset.push(el('00281053', 'DS', dicomString(rescaleSlope)))

  // ---- 像素数据 ----
  if (options.encapsulatedPixelData === true) {
    // 封装结构固定用 Explicit 编码书写（压缩语法均为 Explicit VR）
    const fragment = options.pixelData ?? new Uint8Array(rows * columns * (bitsAllocated / 8))
    dataset.push(encapsulatedPixelElement(padEven(fragment, '\0')))
  } else {
    const pixelData = options.pixelData ?? new Uint8Array(rows * columns * (bitsAllocated / 8))
    const vr = bitsAllocated === 8 ? 'OB' : 'OW'
    dataset.push(el('7fe00010', vr, padEven(pixelData, '\0')))
  }

  return concat([new Uint8Array(128), ascii('DICM'), meta, ...dataset]).buffer as ArrayBuffer
}

/**
 * 构造同一 series 的多切片文件（InstanceNumber 依次为 '1'..'count'），
 * 返回值可直接作为 DicomViewer / seriesUtils 测试的输入。
 */
export function buildDicomSeriesBuffers(
  count: number,
  options: DicomFixtureOptions = {},
): ArrayBuffer[] {
  return Array.from({ length: count }, (_, index) =>
    buildDicomFile({ ...options, instanceNumber: String(index + 1) }),
  )
}

/** 生成 rows×columns 的 8-bit 灰度渐变像素（值从 from 到 to 线性分布） */
export function gradientPixels8(rows: number, columns: number, from = 0, to = 255): Uint8Array {
  const pixels = new Uint8Array(rows * columns)
  const count = rows * columns
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1)
    pixels[i] = Math.round(from + (to - from) * t)
  }
  return pixels
}

/** 生成 rows×columns 的 16-bit 无符号灰度渐变像素（小端字节序） */
export function gradientPixels16(
  rows: number,
  columns: number,
  from = 1000,
  to = 3000,
  signed = false,
): Uint8Array {
  const count = rows * columns
  const pixels = new Uint8Array(count * 2)
  const view = new DataView(pixels.buffer)
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1)
    const value = Math.round(from + (to - from) * t)
    if (signed) view.setInt16(i * 2, value, true)
    else view.setUint16(i * 2, value, true)
  }
  return pixels
}
