/**
 * buildDicomFile fixture 自身的质量测试（CR-002 T-010 / T-005 Minor ①）。
 *
 * 背景：T-005 审查发现 NumberOfFrames（0028,0008）曾被写在 0028,0103 之后，
 * 违反 DICOM 数据集“按 tag 升序”的编码约定。此测试按字节遍历数据集元素，
 * 断言 explicit / implicit 两种编码下元素 tag 均严格升序，防止回归。
 */
import { describe, expect, it } from 'vitest'
import { buildDicomFile } from './buildDicomFile.ts'
import type { DicomFixtureEncoding } from './buildDicomFile.ts'

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  )
}

/** Explicit VR 长长度 VR（PS3.5 表 6.2-1，与 fixture 内定义一致） */
const LONG_LENGTH_VRS = new Set(['OB', 'OW', 'OF', 'OD', 'OL', 'SQ', 'UN', 'UC', 'UR', 'UT'])

/**
 * 按字节遍历 fixture 文件的数据集部分，返回元素 tag 序列（如 '00280008'）。
 * fixture 结构固定：128B preamble + "DICM" + 元组（0002,xxxx，恒 explicit）+ 数据集。
 */
function datasetTags(buffer: ArrayBuffer, encoding: DicomFixtureEncoding): string[] {
  const bytes = new Uint8Array(buffer)
  // 元组：组长度元素（0002,0000）UL = tag(4)+VR(2)+长度(2)+值(4)，值 = 元组其余部分字节数
  const metaGroupLength = readU32(bytes, 140)
  let offset = 144 + metaGroupLength // 128 + "DICM"(4) + 组长度元素(12) + 元组体
  const tags: string[] = []
  while (offset < bytes.length) {
    // tag 以小端存储：组（u16 LE）+ 元素（u16 LE）→ 规范书写 '00080016'
    const group = readU16(bytes, offset)
    const element = readU16(bytes, offset + 2)
    tags.push(`${group.toString(16).padStart(4, '0')}${element.toString(16).padStart(4, '0')}`)
    if (encoding === 'implicit') {
      const length = readU32(bytes, offset + 4)
      if (length === 0xffffffff) break // 未定义长度（封装像素）——本测试不涉及
      offset += 8 + length
      continue
    }
    const vr = String.fromCharCode(bytes[offset + 4], bytes[offset + 5])
    const long = LONG_LENGTH_VRS.has(vr)
    // 长长度 VR：保留(2) + 长度(u32, offset+8)；短 VR：长度(u16, offset+6)
    const length = long ? readU32(bytes, offset + 8) : readU16(bytes, offset + 6)
    if (length === 0xffffffff) break
    offset += (long ? 12 : 8) + length
  }
  return tags
}

describe('buildDicomFile fixture: 数据集 tag 升序', () => {
  it('writes dataset elements in ascending tag order with 0028,0008 after 0028,0002', () => {
    for (const encoding of ['explicit', 'implicit'] as const) {
      const buffer = buildDicomFile({ encoding, numberOfFrames: '6' })
      expect(datasetTags(buffer, encoding)).toEqual([
        '00080016', // SOPClassUID
        '00080018', // SOPInstanceUID
        '00080060', // Modality
        '00100010', // PatientName
        '00100020', // PatientID
        '0020000e', // SeriesInstanceUID
        '00200013', // InstanceNumber
        '00280002', // SamplesPerPixel
        '00280004', // PhotometricInterpretation
        '00280008', // NumberOfFrames（必须在 0028,0002 与 0028,0010 之间）
        '00280010', // Rows
        '00280011', // Columns
        '00280030', // PixelSpacing
        '00280100', // BitsAllocated
        '00280101', // BitsStored
        '00280102', // HighBit
        '00280103', // PixelRepresentation
        '00281052', // RescaleIntercept
        '00281053', // RescaleSlope
        '7fe00010', // PixelData
      ])
    }
  })

  it('keeps ascending order without optional elements (single frame default)', () => {
    const buffer = buildDicomFile({ patientIdentityRemoved: 'YES', deidentificationMethod: 'x' })
    const tags = datasetTags(buffer, 'explicit')
    expect([...tags].sort()).toEqual(tags)
    expect(tags).toContain('00120062')
    expect(tags).toContain('00120063')
    expect(tags).not.toContain('00280008')
  })
})
