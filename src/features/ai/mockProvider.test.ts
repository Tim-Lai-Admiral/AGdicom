import { describe, expect, it } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import { mockProvider } from './mockProvider.ts'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'heart.png',
    kind: 'image',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 2048, fileType: 'image/png' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    ...overrides,
  }
}

describe('mockProvider 确定性（R-006）', () => {
  it('同一图片素材两次生成结果完全一致', () => {
    const asset = makeAsset()
    expect(mockProvider.suggest(asset)).toEqual(mockProvider.suggest(asset))
  })

  it('同一 DICOM 素材两次生成结果完全一致', () => {
    const asset = makeAsset({
      kind: 'dicom',
      name: 'file1.dcm',
      file: { fileName: 'file1.dcm', fileSize: 524288, fileType: '' },
      dicomMeta: {
        modality: 'CT',
        seriesInstanceUID: '1.2.840.10008',
        sliceCount: 12,
        deidentified: true,
      },
    })
    expect(mockProvider.suggest(asset)).toEqual(mockProvider.suggest(asset))
  })

  it('同一 3D 模型素材两次生成结果完全一致', () => {
    const asset = makeAsset({
      kind: 'model',
      name: 'aorta.stl',
      file: { fileName: 'aorta.stl', fileSize: 14470456, fileType: 'model/stl' },
    })
    expect(mockProvider.suggest(asset)).toEqual(mockProvider.suggest(asset))
  })

  it('元数据相同的两个素材（不同 ID）建议一致（图片文件名含序号时）', () => {
    const a = mockProvider.suggest(
      makeAsset({ id: 'id-a', file: { fileName: 'IMG_9.png', fileSize: 2048, fileType: 'image/png' } }),
    )
    const b = mockProvider.suggest(
      makeAsset({ id: 'id-b', file: { fileName: 'IMG_9.png', fileSize: 2048, fileType: 'image/png' } }),
    )
    expect(a).toEqual(b)
  })
})

describe('mockProvider 图片建议（类型+序号）', () => {
  it('命名取文件名中的数字序号，标签为类型与 MIME 子类型，摘要一句话', () => {
    const suggestion = mockProvider.suggest(
      makeAsset({ file: { fileName: 'IMG_1234.png', fileSize: 2048, fileType: 'image/png' } }),
    )
    expect(suggestion.name).toBe('图片-1234')
    expect(suggestion.tags).toEqual(['图片', 'PNG'])
    expect(suggestion.summary).toBe('PNG 图片，文件大小 2048 字节。')
  })

  it('文件名无数字时用资产 ID 的稳定哈希序号（3 位数字，仍确定）', () => {
    const suggestion = mockProvider.suggest(makeAsset({ file: { fileName: 'photo.jpg', fileSize: 1, fileType: '' } }))
    expect(suggestion.name).toMatch(/^图片-\d{3}$/)
    expect(mockProvider.suggest(makeAsset()).name).toBe(suggestion.name)
    expect(suggestion.tags).toEqual(['图片'])
    expect(suggestion.summary).toBe('图片素材，文件大小 1 字节。')
  })
})

describe('mockProvider DICOM 建议（序列+切片数）', () => {
  const dicomAsset = makeAsset({
    kind: 'dicom',
    name: 'file1.dcm',
    file: { fileName: 'file1.dcm', fileSize: 524288, fileType: '' },
    dicomMeta: {
      modality: 'ct',
      seriesInstanceUID: '1.2.840.10008',
      sliceCount: 12,
      deidentified: true,
    },
  })

  it('命名为 Modality+序列 UID 前 8 位+切片数，标签含类型/Modality/去标识化/多切片', () => {
    const suggestion = mockProvider.suggest(dicomAsset)
    expect(suggestion.name).toBe('CT-序列1.2.840-12切片')
    expect(suggestion.tags).toEqual(['DICOM', 'CT', '已去标识化', '多切片序列'])
    expect(suggestion.summary).toBe('CT 序列（已去标识化），共 12 张切片。')
  })

  it('元数据缺失时逐项降级（无 Modality/UID 用 DICOM，切片数未知），仍确定', () => {
    const suggestion = mockProvider.suggest(makeAsset({ kind: 'dicom', file: { fileName: 'broken.dcm', fileSize: 10, fileType: '' } }))
    expect(suggestion.name).toBe('DICOM-切片数未知')
    expect(suggestion.tags).toEqual(['DICOM'])
    expect(suggestion.summary).toBe('DICOM 序列，切片数未知。')
    expect(mockProvider.suggest(makeAsset({ kind: 'dicom', file: { fileName: 'broken.dcm', fileSize: 10, fileType: '' } }))).toEqual(suggestion)
  })
})

describe('mockProvider 3D 模型建议（文件名规范化）', () => {
  it('命名去扩展名并把空白/下划线规范化为连字符，标签含类型与扩展名', () => {
    const suggestion = mockProvider.suggest(
      makeAsset({
        kind: 'model',
        file: { fileName: 'Cardiac_Aorta 01.stl', fileSize: 14470456, fileType: 'model/stl' },
      }),
    )
    expect(suggestion.name).toBe('Cardiac-Aorta-01')
    expect(suggestion.tags).toEqual(['3D 模型', 'STL'])
    expect(suggestion.summary).toBe('STL 格式 3D 模型，文件大小 14470456 字节。')
  })

  it('规范化后为空时回退为模型+资产 ID 前 8 位；无扩展名时标签仅类型', () => {
    const suggestion = mockProvider.suggest(
      makeAsset({ kind: 'model', file: { fileName: '???', fileSize: 5, fileType: '' } }),
    )
    expect(suggestion.name).toBe('模型-asset-1')
    expect(suggestion.tags).toEqual(['3D 模型'])
    expect(suggestion.summary).toBe('3D 模型素材，文件大小 5 字节。')
  })
})
