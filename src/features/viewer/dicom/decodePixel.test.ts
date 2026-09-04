import { describe, expect, it } from 'vitest'
import {
  decodeDicomFrame,
  DicomPixelDecodeError,
  DicomPixelUnsupportedError,
  isUncompressedLittleEndian,
} from './decodePixel.ts'
import { parseDicomFile } from './parseDicom.ts'
import {
  buildDicomFile,
  EXPLICIT_VR_LITTLE_ENDIAN_UID,
  gradientPixels16,
  gradientPixels8,
  IMPLICIT_VR_LITTLE_ENDIAN_UID,
  JPEG_BASELINE_TRANSFER_SYNTAX_UID,
} from './__fixtures__/buildDicomFile.ts'

function decodeFixture(options: Parameters<typeof buildDicomFile>[0], frameIndex?: number) {
  const { dataset } = parseDicomFile(buildDicomFile(options))
  return decodeDicomFrame(dataset, frameIndex)
}

/** 取 ImageData 中第 index 个像素的灰度值（R 通道） */
function grayAt(image: ImageData, index: number): number {
  return image.data[index * 4]
}

describe('isUncompressedLittleEndian', () => {
  it('accepts implicit and explicit VR little endian', () => {
    expect(isUncompressedLittleEndian(IMPLICIT_VR_LITTLE_ENDIAN_UID)).toBe(true)
    expect(isUncompressedLittleEndian(EXPLICIT_VR_LITTLE_ENDIAN_UID)).toBe(true)
  })

  it('rejects compressed / big endian / unknown syntaxes', () => {
    expect(isUncompressedLittleEndian('1.2.840.10008.1.2.2')).toBe(false) // Explicit VR Big Endian
    expect(isUncompressedLittleEndian(JPEG_BASELINE_TRANSFER_SYNTAX_UID)).toBe(false)
    expect(isUncompressedLittleEndian('1.2.840.10008.1.2.5')).toBe(false) // RLE
    expect(isUncompressedLittleEndian(undefined)).toBe(false)
  })
})

describe('decodeDicomFrame: 8-bit', () => {
  it('min-max normalizes an unsigned 8-bit gradient to 0..255', () => {
    const image = decodeFixture({ pixelData: gradientPixels8(8, 8, 30, 200) })
    expect(image.width).toBe(8)
    expect(image.height).toBe(8)
    expect(image.data.length).toBe(8 * 8 * 4)
    expect(grayAt(image, 0)).toBe(0) // min
    expect(grayAt(image, 63)).toBe(255) // max
    // 中间像素：fixture 渐变 i=32 → round(30+170*32/63)=116，归一化 round(86/170*255)=129
    expect(grayAt(image, 32)).toBe(129)
    expect(image.data[3]).toBe(255) // alpha
  })

  it('inverts MONOCHROME1 but keeps MONOCHROME2 as is', () => {
    const normal = decodeFixture({
      pixelData: gradientPixels8(4, 4, 0, 255),
      photometricInterpretation: 'MONOCHROME2',
      rows: 4,
      columns: 4,
    })
    const inverted = decodeFixture({
      pixelData: gradientPixels8(4, 4, 0, 255),
      photometricInterpretation: 'MONOCHROME1',
      rows: 4,
      columns: 4,
    })
    expect(grayAt(normal, 0)).toBe(0)
    expect(grayAt(inverted, 0)).toBe(255)
    expect(grayAt(inverted, 15)).toBe(0)
  })

  it('outputs mid gray for a constant image (avoid misleading all-black preview)', () => {
    const image = decodeFixture({ pixelData: new Uint8Array(16).fill(99), rows: 4, columns: 4 })
    expect(grayAt(image, 0)).toBe(128)
    expect(grayAt(image, 15)).toBe(128)
  })
})

describe('decodeDicomFrame: 16-bit 与 Rescale', () => {
  it('min-max normalizes an unsigned 16-bit frame', () => {
    const image = decodeFixture({
      bitsAllocated: 16,
      pixelData: gradientPixels16(8, 8, 500, 3000),
    })
    expect(image.width).toBe(8)
    expect(grayAt(image, 0)).toBe(0)
    expect(grayAt(image, 63)).toBe(255)
  })

  it('supports signed 16-bit samples (PixelRepresentation = 1)', () => {
    const image = decodeFixture({
      bitsAllocated: 16,
      pixelRepresentation: 1,
      pixelData: gradientPixels16(8, 8, -1024, 1024, true),
    })
    expect(grayAt(image, 0)).toBe(0)
    expect(grayAt(image, 63)).toBe(255)
    // 中间像素：fixture 渐变 i=32 → round(-1024+2048*32/63)=16，归一化 round(1040/2048*255)=129
    expect(grayAt(image, 32)).toBe(129)
  })

  it('applies RescaleSlope and RescaleIntercept before normalization', () => {
    const image = decodeFixture({
      pixelData: gradientPixels8(4, 4, 10, 20),
      rows: 4,
      columns: 4,
      rescaleSlope: '2',
      rescaleIntercept: '-10',
    })
    // 原始 10..20 → Rescale（×2 −10）后 10..30 → 归一化 0..255
    expect(grayAt(image, 0)).toBe(0)
    expect(grayAt(image, 15)).toBe(255)
    // i=7：原始 round(10+10*7/15)=15 → Rescale 20 → round((20-10)/20*255)=128
    expect(grayAt(image, 7)).toBe(128)
  })

  it('decodes the second frame of a multi-frame file', () => {
    const frame0 = new Uint8Array(16).fill(0)
    const frame1 = new Uint8Array(16).fill(255)
    const image = decodeFixture(
      { pixelData: new Uint8Array([...frame0, ...frame1]), rows: 4, columns: 4, numberOfFrames: '2' },
      1,
    )
    expect(grayAt(image, 0)).toBe(128) // 单帧内恒定 → 中间灰度
    expect(grayAt(image, 15)).toBe(128)
  })
})

describe('decodeDicomFrame: 降级路径（“仅元数据”）', () => {
  it('rejects compressed transfer syntax with a readable message', () => {
    expect(() => decodeFixture({ transferSyntax: JPEG_BASELINE_TRANSFER_SYNTAX_UID })).toThrow(
      DicomPixelUnsupportedError,
    )
    try {
      decodeFixture({ transferSyntax: JPEG_BASELINE_TRANSFER_SYNTAX_UID })
    } catch (error) {
      expect((error as DicomPixelUnsupportedError).message).toContain('仅元数据')
      expect((error as DicomPixelUnsupportedError).message).toContain(
        JPEG_BASELINE_TRANSFER_SYNTAX_UID,
      )
    }
  })

  it('rejects encapsulated pixel data structure even with an uncompressed syntax', () => {
    expect(() =>
      decodeFixture({ encapsulatedPixelData: true, pixelData: gradientPixels8(4, 4) }),
    ).toThrow(DicomPixelUnsupportedError)
  })

  it('rejects unsupported bits allocated (e.g. 12-bit packed)', () => {
    // fixture 仅支持 8/16-bit 的合法构造；12-bit 分支通过改写 BitsAllocated 元素值触发
    const parsed = parseDicomFile(buildDicomFile({ bitsAllocated: 16 }))
    const element = parsed.dataset.elements.x00280100
    const bytes = parsed.dataset.byteArray as Uint8Array
    new DataView(bytes.buffer, bytes.byteOffset + element.dataOffset, 2).setUint16(0, 12, true)
    expect(() => decodeDicomFrame(parsed.dataset)).toThrow(/仅支持 8\/16-bit/)
  })

  it('rejects color samples', () => {
    expect(() => decodeFixture({ samplesPerPixel: 3 })).toThrow(DicomPixelUnsupportedError)
  })

  it('rejects non-grayscale photometric interpretation', () => {
    expect(() => decodeFixture({ photometricInterpretation: 'PALETTE COLOR' })).toThrow(
      /MONOCHROME1\/2/,
    )
  })

  it('throws a decode error for missing or empty pixel data', () => {
    expect(() => decodeFixture({ pixelData: new Uint8Array(0) })).toThrow(DicomPixelDecodeError)
  })

  it('throws a decode error when pixel data is shorter than the frame', () => {
    const { dataset } = parseDicomFile(
      buildDicomFile({ bitsAllocated: 16, pixelData: new Uint8Array(8) }),
    )
    expect(() => decodeDicomFrame(dataset)).toThrow(/像素数据长度不足/)
  })

  it('throws a decode error for out-of-range frame index', () => {
    expect(() =>
      decodeFixture({ pixelData: gradientPixels8(4, 4), rows: 4, columns: 4 }, 3),
    ).toThrow(/帧序号超出范围/)
  })
})
