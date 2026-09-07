/**
 * 左栏患者分组面板切片真实缩略图单测（CR-007 T-002 / R-017；CR-008 T-001 面板化移植）。
 *
 * 覆盖：series 展开后对已解析（dicomMeta + 会话 objectUrl）切片自动生成并切换为
 * 真实像素；会话缓存命中直接显示像素（不再生成）；生成失败/压缩降级保持占位
 * SVG 不崩溃；未解析 / 无会话字节的切片不触发生成、保持占位。
 *
 * sliceThumb 以模块 mock 注入（生成器自身行为由 sliceThumb.test.ts 覆盖；
 * jsdom 无 canvas，mock 同时避免测试发出真实请求）。
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, DicomMeta } from '../../domain/types.ts'
import PatientGroupPanel from './PatientGroupPanel.tsx'
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

function asset(
  id: string,
  meta: Partial<DicomMeta> = {},
  overrides: Partial<Asset> = {},
): Asset {
  return {
    id,
    name: id,
    kind: 'dicom',
    status: 'pending',
    tags: [],
    note: '',
    source: '',
    file: { fileName: `${id}.dcm`, fileSize: 1, fileType: 'application/dicom' },
    createdAt: '',
    updatedAt: '',
    dicomMeta: {
      seriesInstanceUID: 'uid-1',
      sliceCount: 1,
      deidentified: false,
      ...meta,
    },
    ...overrides,
  }
}

/** 同患者（CHEN^WEI / P2）单 series 2 切片，均带会话 objectUrl 与已解析元数据 */
function parsedSeriesAssets(): Asset[] {
  return [1, 2].map((i) =>
    asset(`a-${i}`, {
      patientName: 'CHEN^WEI',
      patientID: 'P2',
      instanceNumber: i,
      sliceCount: 2,
    }, { objectUrl: `blob:a-${i}` }),
  )
}

/** CHEN^WEI/P2 患者组键（R-012 键语义：`姓名\0ID`） */
const CHEN_KEY = 'CHEN^WEI\u0000P2'

function renderPanel(assets: Asset[], activeSliceAssetId: string | null = null) {
  return render(
    <PatientGroupPanel
      dicomAssets={assets}
      activeSliceAssetId={activeSliceAssetId}
      openGroupKeys={new Set([CHEN_KEY])}
      onToggleGroup={() => {}}
      onOpenGroup={() => {}}
      onOpenSlice={() => {}}
    />,
  )
}

describe('PatientGroupPanel 切片真实缩略图（R-017）', () => {
  it('series 展开后自动生成已解析切片的首帧并切换为真实像素', async () => {
    cacheMock.mockReturnValue(undefined)
    generateMock.mockImplementation(async ({ id }) => `data:image/png;base64,${id}`)
    const { container } = renderPanel(parsedSeriesAssets(), 'a-1')

    // 当前素材所在 series 自动展开：两张切片均触发生成（含会话 objectUrl）
    await waitFor(() => {
      expect(container.querySelectorAll('.dicom-panel__thumb-img')).toHaveLength(2)
    })
    expect(screen.getByRole('button', { name: '查看切片 #1' }).querySelector('img')).not.toBeNull()
    const img = container.querySelector('.dicom-panel__thumb-img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('data:image/png;base64,a-1')
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a-1', objectUrl: 'blob:a-1' }),
    )
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a-2', objectUrl: 'blob:a-2' }),
    )
  })

  it('会话缓存已有时直接显示像素，不再触发生成', async () => {
    cacheMock.mockImplementation((id) => `data:image/png;base64,cache-${id}`)
    const { container } = renderPanel(parsedSeriesAssets(), 'a-1')

    await waitFor(() => {
      expect(container.querySelectorAll('.dicom-panel__thumb-img')).toHaveLength(2)
    })
    expect(
      (container.querySelector('.dicom-panel__thumb-img') as HTMLImageElement).getAttribute('src'),
    ).toBe('data:image/png;base64,cache-a-1')
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('生成中保持占位 SVG，完成后切换为像素', async () => {
    const resolvers: Array<(value: string | null) => void> = []
    generateMock.mockImplementation(
      () => new Promise<string | null>((resolve) => { resolvers.push(resolve) }),
    )
    const { container } = renderPanel(parsedSeriesAssets(), 'a-1')

    // 生成未完成：显示占位 SVG（非像素）
    await waitFor(() => {
      expect(container.querySelector('.dicom-panel__thumb svg')).not.toBeNull()
    })
    expect(container.querySelector('.dicom-panel__thumb-img')).toBeNull()
    expect(generateMock).toHaveBeenCalled()

    await act(async () => {
      for (const resolve of resolvers) resolve('data:image/png;base64,late')
    })
    await waitFor(() => {
      expect(container.querySelector('.dicom-panel__thumb-img')).not.toBeNull()
    })
    expect(container.querySelector('.dicom-panel__thumb svg')).toBeNull()
  })

  it('生成失败（压缩/解码失败 → null）保持占位 SVG，不崩溃', async () => {
    const resolvers: Array<(value: string | null) => void> = []
    generateMock.mockImplementation(
      () => new Promise<string | null>((resolve) => { resolvers.push(resolve) }),
    )
    const { container } = renderPanel(parsedSeriesAssets(), 'a-1')
    await waitFor(() => {
      expect(container.querySelector('.dicom-panel__thumb svg')).not.toBeNull()
    })
    await act(async () => {
      for (const resolve of resolvers) resolve(null)
    })
    // 仍为占位，无像素 img，组件不崩溃
    expect(container.querySelector('.dicom-panel__thumb-img')).toBeNull()
    expect(container.querySelector('.dicom-panel__thumb svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: '查看切片 #2' })).toBeTruthy()
  })

  it('未解析或无会话字节的切片不触发生成，保持占位', () => {
    const assets = [
      // 已解析但刷新后无 objectUrl：不生成
      asset('a-nourl', { patientName: 'CHEN^WEI', patientID: 'P2', instanceNumber: 1 }),
      // 未解析（无 dicomMeta）：不进入患者分组 → 不影响分组展示
      asset('bare', { patientName: 'CHEN^WEI', patientID: 'P2' }, { objectUrl: 'blob:bare', dicomMeta: undefined }),
    ]
    renderPanel(assets, 'a-nourl')
    expect(generateMock).not.toHaveBeenCalled()
    // 无会话字节的切片不生成，保持占位 SVG；未解析素材不影响分组展示
    expect(screen.getByText('CHEN^WEI')).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看切片 #1' }).querySelector('img')).toBeNull()
  })
})
