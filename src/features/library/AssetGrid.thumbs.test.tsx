/**
 * 素材行 DICOM 真实缩略图单测（CR-007 T-002 / R-017）。
 *
 * 覆盖：dicom 行解析后（dicomMeta + 会话 objectUrl）生成并显示真实首帧；
 * 会话缓存命中直接显示像素（不再生成）；生成失败（压缩/解码失败 → null）保持
 * 类型图标占位；未解析 / 无会话字节不触发生成；image 行 objectUrl 缩略图不受影响。
 *
 * sliceThumb 以模块 mock 注入（生成器自身行为由 sliceThumb.test.ts 覆盖）。
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, DicomMeta } from '../../domain/types.ts'
import AssetGrid from './AssetGrid.tsx'
import { generateSliceThumb, getCachedSliceThumb } from '../viewer/dicom/sliceThumb.ts'

vi.mock('../viewer/dicom/sliceThumb.ts', () => ({
  getCachedSliceThumb: vi.fn(() => undefined),
  generateSliceThumb: vi.fn(async () => null),
}))

const generateMock = vi.mocked(generateSliceThumb)
const cacheMock = vi.mocked(getCachedSliceThumb)

afterEach(() => {
  cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  vi.resetAllMocks() // 恢复 mock 工厂默认实现，避免用例间的桩互相泄漏
})

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'a1',
    name: 'scan.dcm',
    kind: 'dicom',
    status: 'pending',
    tags: [],
    note: '',
    source: '',
    file: { fileName: 'scan.dcm', fileSize: 64, fileType: 'application/dicom' },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

const parsedMeta: DicomMeta = {
  modality: 'CT',
  seriesInstanceUID: 'uid-1',
  instanceNumber: 1,
  sliceCount: 1,
  deidentified: false,
}

function setup(assets: Asset[]) {
  return render(
    <AssetGrid assets={assets} selectedIds={[]} onToggleSelect={() => {}} />,
  )
}

describe('AssetGrid dicom 行真实缩略图（R-017）', () => {
  it('解析后的 dicom 行自动生成并显示真实首帧', async () => {
    cacheMock.mockReturnValue(undefined)
    generateMock.mockResolvedValue('data:image/png;base64,frame')
    const { container } = setup([
      makeAsset({ objectUrl: 'blob:a1', dicomMeta: parsedMeta }),
    ])

    await waitFor(() => {
      expect(container.querySelector('.asset-row__img')).not.toBeNull()
    })
    const img = container.querySelector('.asset-row__img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('data:image/png;base64,frame')
    expect(img.getAttribute('alt')).toBe('素材“scan.dcm”的切片缩略图')
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', objectUrl: 'blob:a1' }),
    )
  })

  it('会话缓存已有时直接显示像素，不再生成', async () => {
    cacheMock.mockReturnValue('data:image/png;base64,cached')
    const { container } = setup([
      makeAsset({ objectUrl: 'blob:a1', dicomMeta: parsedMeta }),
    ])

    await waitFor(() => {
      expect(container.querySelector('.asset-row__img')).not.toBeNull()
    })
    expect(
      (container.querySelector('.asset-row__img') as HTMLImageElement).getAttribute('src'),
    ).toBe('data:image/png;base64,cached')
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('生成失败（压缩/解码失败 → null）保持类型图标占位，不崩溃', async () => {
    cacheMock.mockReturnValue(undefined)
    generateMock.mockResolvedValue(null)
    const { container } = setup([
      makeAsset({ objectUrl: 'blob:a1', dicomMeta: parsedMeta }),
    ])

    // 行文本与状态仍正常渲染
    expect(screen.getByText('scan.dcm')).toBeTruthy()
    // 生成已触发但结果为 null：保持 glyph 占位（无像素 img）
    await waitFor(() => {
      expect(generateMock).toHaveBeenCalled()
    })
    expect(container.querySelector('.asset-row__img')).toBeNull()
    expect(container.querySelector('.asset-row__glyph')).not.toBeNull()
  })

  it('未解析或无会话字节的 dicom 行不触发生成，保持占位', () => {
    setup([
      makeAsset({ id: 'a-bare' }), // 未解析（无 dicomMeta）
      makeAsset({ id: 'a-nourl', dicomMeta: parsedMeta }), // 刷新后无 objectUrl
    ])
    expect(generateMock).not.toHaveBeenCalled()
    expect(document.querySelectorAll('.asset-row__img')).toHaveLength(0)
    expect(document.querySelectorAll('.asset-row__glyph')).toHaveLength(2)
  })

  it('image 行 objectUrl 缩略图不受 dicom 缩略图逻辑影响', () => {
    const { container } = setup([
      makeAsset({ id: 'img-1', name: 'heart.png', kind: 'image', objectUrl: 'blob:img-1' }),
    ])
    const img = container.querySelector('.asset-row__img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:img-1')
    expect(generateMock).not.toHaveBeenCalled()
  })
})
