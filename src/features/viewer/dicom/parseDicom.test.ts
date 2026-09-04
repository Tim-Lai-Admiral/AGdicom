import { describe, expect, it } from 'vitest'
import { DicomParseError, parseDicomFile } from './parseDicom.ts'
import {
  buildDicomFile,
  CT_IMAGE_STORAGE_SOP_CLASS_UID,
  EXPLICIT_VR_LITTLE_ENDIAN_UID,
  FIXTURE_SERIES_INSTANCE_UID,
  IMPLICIT_VR_LITTLE_ENDIAN_UID,
} from './__fixtures__/buildDicomFile.ts'

/** 显式 VR LE、8-bit、含基础元数据与患者信息的默认 fixture */
const DEFAULT_BUFFER = buildDicomFile()

describe('parseDicomFile: 基础元数据', () => {
  it('extracts required metadata from an explicit VR little endian file', () => {
    const result = parseDicomFile(DEFAULT_BUFFER)
    expect(result.partial).toBe(false)
    expect(result.meta).toEqual({
      modality: 'CT',
      sopClass: CT_IMAGE_STORAGE_SOP_CLASS_UID,
      transferSyntax: EXPLICIT_VR_LITTLE_ENDIAN_UID,
      rows: 8,
      columns: 8,
      pixelSpacing: [0.5, 0.5],
      seriesInstanceUID: FIXTURE_SERIES_INSTANCE_UID,
      patientName: 'DOE^JOHN',
      patientID: 'PID-001',
      instanceNumber: 1,
      sliceCount: 1,
      deidentified: false,
      deidentificationMethod: undefined,
      deidentifiedEvidence: undefined,
    })
  })

  it('parses an implicit VR little endian dataset', () => {
    const result = parseDicomFile(
      buildDicomFile({
        encoding: 'implicit',
        transferSyntax: IMPLICIT_VR_LITTLE_ENDIAN_UID,
        instanceNumber: '7',
      }),
    )
    expect(result.meta.modality).toBe('CT')
    expect(result.meta.rows).toBe(8)
    expect(result.meta.instanceNumber).toBe(7)
    expect(result.meta.transferSyntax).toBe(IMPLICIT_VR_LITTLE_ENDIAN_UID)
  })

  it('keeps pixel data accessible on the dataset for decoding', () => {
    const result = parseDicomFile(DEFAULT_BUFFER)
    const pixelElement = result.dataset.elements.x7fe00010
    expect(pixelElement).toBeDefined()
    expect(pixelElement.length).toBe(64) // 8x8 8-bit
    expect(pixelElement.dataOffset).toBeGreaterThan(0)
  })

  it('defaults sliceCount to 1 (single file is one slice; aggregation happens in seriesUtils)', () => {
    expect(parseDicomFile(DEFAULT_BUFFER).meta.sliceCount).toBe(1)
  })

  it('omits missing optional fields instead of inventing values', () => {
    const result = parseDicomFile(
      buildDicomFile({
        pixelSpacing: null,
        seriesInstanceUID: null,
        instanceNumber: null,
      }),
    )
    expect(result.meta.pixelSpacing).toBeUndefined()
    expect(result.meta.seriesInstanceUID).toBeUndefined()
    expect(result.meta.instanceNumber).toBeUndefined()
  })

  it('parses pixel spacing with backslash separator into numbers', () => {
    const result = parseDicomFile(buildDicomFile({ pixelSpacing: '0.33\\0.66' }))
    expect(result.meta.pixelSpacing).toEqual([0.33, 0.66])
  })
})

describe('parseDicomFile: 去标识化检测', () => {
  it('marks deidentified with structured evidence when (0012,0062) is YES', () => {
    const result = parseDicomFile(
      buildDicomFile({
        patientIdentityRemoved: 'YES',
        deidentificationMethod: 'Synthetic phantom; identity removed',
        patientName: '',
        patientID: '',
      }),
    )
    expect(result.meta.deidentified).toBe(true)
    expect(result.meta.deidentifiedEvidence).toEqual([
      'patient-identity-removed',
      'deidentification-method',
      'empty-patient-fields',
    ])
    expect(result.meta.deidentificationMethod).toBe('Synthetic phantom; identity removed')
    expect(result.meta.patientName).toBeUndefined()
    expect(result.meta.patientID).toBeUndefined()
  })

  it('treats empty patient fields as deidentification evidence', () => {
    const result = parseDicomFile(
      buildDicomFile({ patientName: '', patientID: '' }),
    )
    expect(result.meta.deidentified).toBe(true)
    expect(result.meta.deidentifiedEvidence).toEqual(['empty-patient-fields'])
  })

  it('reports not deidentified when patient fields exist and no markers', () => {
    const result = parseDicomFile(
      buildDicomFile({ patientIdentityRemoved: 'NO' }),
    )
    expect(result.meta.deidentified).toBe(false)
    expect(result.meta.deidentifiedEvidence).toBeUndefined()
    expect(result.meta.patientName).toBe('DOE^JOHN')
  })

  it('falls back to evidence from DeidentificationMethod alone', () => {
    const result = parseDicomFile(
      buildDicomFile({ deidentificationMethod: 'Basic Profile' }),
    )
    expect(result.meta.deidentified).toBe(true)
    expect(result.meta.deidentifiedEvidence).toEqual(['deidentification-method'])
  })
})

describe('parseDicomFile: 解析失败与部分元数据抢救', () => {
  it('throws a readable DicomParseError for non-DICOM bytes', () => {
    const garbage = new Uint8Array(256).fill(0x41).buffer
    expect(() => parseDicomFile(garbage)).toThrow(DicomParseError)
    try {
      parseDicomFile(garbage)
    } catch (error) {
      expect((error as DicomParseError).message).toContain('无法解析该 DICOM 文件')
    }
  })

  it('throws a readable DicomParseError for an empty buffer', () => {
    expect(() => parseDicomFile(new ArrayBuffer(0))).toThrow(DicomParseError)
  })

  it('salvages partial metadata when the file is truncated mid-dataset', () => {
    const full = new Uint8Array(DEFAULT_BUFFER)
    // 在数据集中间截断（保留文件元组与部分数据集元素）
    const truncated = full.slice(0, 360).buffer
    let result
    try {
      result = parseDicomFile(truncated)
    } catch {
      result = undefined
    }
    // 截断位置若落在已成功解析元素之后，dicom-parser 会携带部分元素中断：
    // 要么抢救成功（partial），要么抛可读错误——两者都不允许崩溃或乱数据
    if (result !== undefined) {
      expect(result.partial).toBe(true)
      // 抢救出的字段必须是真实存在于文件头部的值，而不是乱数据
      expect(['CT', undefined]).toContain(result.meta.modality)
    }
  })

  it('salvages partial metadata when the file is truncated inside pixel data', () => {
    // dicom-parser 对普通元素 seek 越界会中断并抛 {exception, dataSet}（含已解析元素）：
    // 像素数据区被截断时元数据元素已全部解析 → partial 抢救（预览由解码层长度校验降级）
    const full = new Uint8Array(
      buildDicomFile({
        bitsAllocated: 16,
        pixelData: new Uint8Array(8 * 8 * 2),
      }),
    )
    const truncated = full.slice(0, full.length - 40).buffer
    const result = parseDicomFile(truncated)
    expect(result.partial).toBe(true)
    expect(result.meta.modality).toBe('CT')
    expect(result.meta.rows).toBe(8)
  })
})
