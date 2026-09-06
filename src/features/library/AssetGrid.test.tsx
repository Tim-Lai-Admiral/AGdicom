import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import AssetGrid from './AssetGrid.tsx'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'heart.png',
    kind: 'image',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    ...overrides,
  }
}

function setup(assets: Asset[], selectedIds: readonly string[] = []) {
  const onToggleSelect = vi.fn()
  const utils = render(
    <AssetGrid assets={assets} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />,
  )
  return { ...utils, onToggleSelect }
}

describe('AssetGrid', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders one row per asset with name, kind label and status dot', () => {
    setup([
      makeAsset({ id: 'a1', name: 'heart.png' }),
      makeAsset({ id: 'a2', name: 'scan.dcm', kind: 'dicom' }),
      makeAsset({ id: 'a3', name: 'aorta.stl', kind: 'model', status: 'passed' }),
    ])
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('scan.dcm')).toBeTruthy()
    expect(screen.getByText('aorta.stl')).toBeTruthy()
    expect(screen.getByText('图片', { selector: '.asset-row__kind' })).toBeTruthy()
    expect(screen.getByText('DICOM', { selector: '.asset-row__kind' })).toBeTruthy()
    expect(screen.getByText('3D 模型', { selector: '.asset-row__kind' })).toBeTruthy()
    expect(screen.getAllByText('待评审', { selector: '.status-dot' })).toHaveLength(2)
    expect(screen.getByText('通过', { selector: '.status-dot' })).toBeTruthy()
  })

  it('renders the image thumbnail from the session objectUrl', () => {
    setup([makeAsset({ id: 'a1', objectUrl: 'blob:mock-1' })])
    const img = screen.getByRole('img', { name: /heart\.png/ }) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:mock-1')
  })

it('shows a placeholder on image load error without breaking other rows', () => {
    const { container } = setup([
      makeAsset({ id: 'a1', objectUrl: 'blob:broken' }),
      makeAsset({ id: 'a2', name: 'scan.dcm', kind: 'dicom' }),
    ])
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('图片加载失败')).toBeTruthy()
    expect(screen.getByText('scan.dcm')).toBeTruthy() // 其余行不受影响
    expect(container.querySelectorAll('.asset-row')).toHaveLength(2)
  })

it('toggles compare selection on image row click and marks the selected row', () => {
    const { onToggleSelect } = setup(
      [makeAsset({ id: 'a1' }), makeAsset({ id: 'a2', name: 'lung.png' })],
      ['a1'],
    )
    const selectedRow = screen.getByRole('button', { name: '取消选择“heart.png”' })
    expect(selectedRow.getAttribute('aria-pressed')).toBe('true')
    expect(
      containerOf(selectedRow).className, // li.asset-row.is-selected
    ).toContain('is-selected')
    fireEvent.click(selectedRow)
    expect(onToggleSelect).toHaveBeenCalledWith('a1')

    const otherRow = screen.getByRole('button', { name: '选择“lung.png”加入比较' })
    expect(otherRow.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(otherRow)
    expect(onToggleSelect).toHaveBeenCalledWith('a2')
  })

  it('ignores clicks on non-image rows for compare selection', () => {
    const { onToggleSelect } = setup([
      makeAsset({ id: 'a1', name: 'scan.dcm', kind: 'dicom' }),
    ])
    fireEvent.click(screen.getByText('scan.dcm'))
    expect(onToggleSelect).not.toHaveBeenCalled()
  })

  it('opens the DICOM viewer when a dicom row is clicked and onOpenDicom is provided', () => {
    const onOpenDicom = vi.fn()
    render(
      <AssetGrid
        assets={[
          makeAsset({ id: 'a1', name: 'scan.dcm', kind: 'dicom' }),
          makeAsset({ id: 'a2', name: 'aorta.stl', kind: 'model' }),
          makeAsset({ id: 'a3', name: 'heart.png' }),
        ]}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onOpenDicom={onOpenDicom}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '查看“scan.dcm”的 DICOM 详情' }))
    expect(onOpenDicom).toHaveBeenCalledWith('a1')

    // image 行点击仍走比较选中；model 行保持不可交互（T-006 前不变）
    fireEvent.click(screen.getByRole('button', { name: '选择“heart.png”加入比较' }))
    expect(onOpenDicom).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /aorta\.stl/ })).toBeNull()
  })

it('renders status as display-only: no inline status button and no review button (CR-004 T-001)', () => {
    setup([makeAsset({ id: 'a1', status: 'pending' })])
    // 状态点仅展示；状态修改入口移到右栏评审面板（选中素材后）
    expect(screen.getByText('待评审', { selector: '.status-dot' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /当前状态：待评审/ })).toBeNull()
    // 行内无“评审”按钮（评审经选中 → 右栏）
    expect(screen.queryByRole('button', { name: /评审/ })).toBeNull()
  })
})

/** 从行主体按钮向上取所属 li，用于断言选中态类名 */
function containerOf(element: Element): Element {
  const row = element.closest('.asset-row')
  if (row === null) throw new Error('row not found')
  return row
}
