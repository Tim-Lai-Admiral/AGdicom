/**
 * 左栏 DICOM 患者分组展开区单测（CR-005 T-002 / R-012）。
 *
 * 覆盖：患者组默认折叠（open=false 仅开关）；展开后患者组头（姓名/ID/计数）与
 * series 行（Series 升序）可见、series 行默认折叠；当前素材所在 series 自动展开
 * 并高亮（患者组头 is-active / 缩略图 is-active）；series 行手动折叠/展开与切片
 * 点击回调；姓名/ID 均缺失的“未知患者”组显示；无元数据占位提示。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, DicomMeta } from '../../domain/types.ts'
import DicomSeriesExpansion from './DicomSeriesExpansion.tsx'

afterEach(() => {
  cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
})

function meta(overrides: Partial<DicomMeta> = {}): DicomMeta {
  return {
    seriesInstanceUID: 'uid-1',
    instanceNumber: 1,
    sliceCount: 1,
    deidentified: false,
    ...overrides,
  }
}

function asset(id: string, patient: Partial<DicomMeta> = {}, overrides: Partial<Asset> = {}): Asset {
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
    dicomMeta: meta(patient),
    ...overrides,
  }
}

/** 同一患者（CHEN^WEI / P2）2 个 series × 3 切片 */
function chenAssets(): Asset[] {
  const out: Asset[] = []
  for (const uid of ['uid-1', 'uid-2']) {
    for (let i = 1; i <= 3; i += 1) {
      out.push(
        asset(`a-${uid}-${i}`, {
          patientName: 'CHEN^WEI',
          patientID: 'P2',
          seriesInstanceUID: uid,
          instanceNumber: i,
          sliceCount: 6,
        }),
      )
    }
  }
  return out
}

function renderExpansion(assets: Asset[], activeSliceAssetId: string | null, open = true) {
  return render(
    <DicomSeriesExpansion
      asset={assets[0] as Asset}
      dicomAssets={assets}
      open={open}
      activeSliceAssetId={activeSliceAssetId}
      onToggle={() => {}}
      onOpenSlice={() => {}}
    />,
  )
}

describe('DicomSeriesExpansion', () => {
  it('renders only the toggle when closed (patient group collapsed by default)', () => {
    const assets = chenAssets()
    renderExpansion(assets, null, false)
    expect(screen.getByRole('button', { name: '展开切片' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '展开切片' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
    expect(screen.queryByText('CHEN^WEI')).toBeNull()
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
  })

  it('shows the patient head and collapsed series rows when open', () => {
    const assets = chenAssets()
    renderExpansion(assets, null)
    expect(screen.getByText('CHEN^WEI')).toBeTruthy()
    expect(screen.getByText('P2')).toBeTruthy()
    expect(screen.getByText('2 序列 · 6 张')).toBeTruthy()
    // 组内 series 按 SeriesInstanceUID 升序，默认折叠（无缩略图）
    const seriesRows = screen.getAllByRole('button', { name: /Series/ })
    expect(seriesRows).toHaveLength(2)
    expect(seriesRows[0]?.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
  })

  it('auto-expands the active series and highlights the patient head and active slice', () => {
    const assets = chenAssets()
    renderExpansion(assets, 'a-uid-2-2')
    // 当前素材所在 series（uid-2）自动展开：3 张缩略图可见
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
    expect(screen.getByText('CHEN^WEI').closest('p')?.className).toContain('is-active')
    expect(screen.getByRole('button', { name: '查看切片 #2' }).className).toContain('is-active')
  })

  it('toggles a series row manually and opens the clicked slice', () => {
    const assets = chenAssets()
    const onOpenSlice = vi.fn()
    render(
      <DicomSeriesExpansion
        asset={assets[0] as Asset}
        dicomAssets={assets}
        open
        activeSliceAssetId={null}
        onToggle={() => {}}
        onOpenSlice={onOpenSlice}
      />,
    )
    const firstSeries = screen.getAllByRole('button', { name: /Series/ })[0] as HTMLElement
    fireEvent.click(firstSeries)
    const thumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect(thumbs).toHaveLength(3)
    fireEvent.click(thumbs[0] as HTMLElement)
    expect(onOpenSlice).toHaveBeenCalledWith('a-uid-1-1')
    // 再次点击同一 series 行：折叠，缩略图隐藏
    fireEvent.click(screen.getAllByRole('button', { name: /Series/ })[0] as HTMLElement)
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
  })

  it('shows 未知患者 with 已置空 for files with both patient fields missing', () => {
    const assets = [
      asset('x', { patientName: undefined, patientID: undefined }),
      asset('y', { patientName: undefined, patientID: undefined, seriesInstanceUID: 'uid-9' }),
    ]
    renderExpansion(assets, null)
    expect(screen.getByText('未知患者')).toBeTruthy()
    expect(screen.getByText('已置空')).toBeTruthy()
    expect(screen.getByText('2 序列 · 2 张')).toBeTruthy()
  })

  it('shows the placeholder when the asset has no parsed metadata', () => {
    const assets = chenAssets()
    // 未解析素材（独立 ID、无 dicomMeta）不属于任何患者组 → 占位提示
    const bare: Asset = { ...asset('bare'), dicomMeta: undefined }
    renderExpansion([bare, ...assets], null)
    expect(screen.getByText(/暂无切片数据/)).toBeTruthy()
    expect(screen.queryByText('CHEN^WEI')).toBeNull()
  })
})
