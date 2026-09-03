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
  const onSetStatus = vi.fn()
  const utils = render(
    <AssetGrid
      assets={assets}
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onSetStatus={onSetStatus}
    />,
  )
  return { ...utils, onToggleSelect, onSetStatus }
}

describe('AssetGrid', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders one card per asset with name, kind label and status badge', () => {
    setup([
      makeAsset({ id: 'a1', name: 'heart.png' }),
      makeAsset({ id: 'a2', name: 'scan.dcm', kind: 'dicom' }),
      makeAsset({ id: 'a3', name: 'aorta.stl', kind: 'model', status: 'passed' }),
    ])
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('scan.dcm')).toBeTruthy()
    expect(screen.getByText('aorta.stl')).toBeTruthy()
    expect(screen.getByText('图片', { selector: '.asset-card__kind' })).toBeTruthy()
    expect(screen.getByText('DICOM', { selector: '.asset-card__kind' })).toBeTruthy()
    expect(screen.getByText('3D 模型', { selector: '.asset-card__kind' })).toBeTruthy()
    expect(screen.getAllByText('待评审')).toHaveLength(2)
    expect(screen.getByText('通过', { selector: '.status-badge' })).toBeTruthy()
  })

  it('renders the image thumbnail from the session objectUrl', () => {
    setup([makeAsset({ id: 'a1', objectUrl: 'blob:mock-1' })])
    const img = screen.getByRole('img', { name: /heart\.png/ }) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:mock-1')
  })

  it('shows a placeholder with hint when the image has no objectUrl (post-refresh)', () => {
    setup([makeAsset({ id: 'a1' })])
    expect(screen.getByText(/预览不可用/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows a placeholder on image load error without breaking other cards', () => {
    const { container } = setup([
      makeAsset({ id: 'a1', objectUrl: 'blob:broken' }),
      makeAsset({ id: 'a2', name: 'scan.dcm', kind: 'dicom' }),
    ])
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('图片加载失败')).toBeTruthy()
    expect(screen.getByText('scan.dcm')).toBeTruthy() // 其余卡片不受影响
    expect(container.querySelectorAll('.asset-card')).toHaveLength(2)
  })

  it('shows the type glyph placeholder for dicom and model cards', () => {
    const { container } = setup([
      makeAsset({ id: 'a1', name: 'scan.dcm', kind: 'dicom' }),
      makeAsset({ id: 'a2', name: 'aorta.stl', kind: 'model' }),
    ])
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelectorAll('.asset-card__glyph')).toHaveLength(2)
  })

  it('toggles compare selection on image card click and marks selected cards', () => {
    const { onToggleSelect } = setup(
      [makeAsset({ id: 'a1' }), makeAsset({ id: 'a2', name: 'lung.png' })],
      ['a1'],
    )
    const selectedCard = screen.getByRole('button', { name: '取消选择“heart.png”' })
    expect(selectedCard.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('已选中')).toBeTruthy()
    expect(
      containerOf(selectedCard).className, // li.asset-card.is-selected
    ).toContain('is-selected')
    fireEvent.click(selectedCard)
    expect(onToggleSelect).toHaveBeenCalledWith('a1')

    const otherCard = screen.getByRole('button', { name: '选择“lung.png”加入比较' })
    expect(otherCard.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(otherCard)
    expect(onToggleSelect).toHaveBeenCalledWith('a2')
  })

  it('ignores clicks on non-image cards for compare selection', () => {
    const { onToggleSelect } = setup([
      makeAsset({ id: 'a1', name: 'scan.dcm', kind: 'dicom' }),
    ])
    fireEvent.click(screen.getByText('scan.dcm'))
    expect(onToggleSelect).not.toHaveBeenCalled()
    expect(screen.queryByText('已选中')).toBeNull()
  })

  it('requests the next status via the status badge', () => {
    const { onSetStatus } = setup([makeAsset({ id: 'a1', status: 'pending' })])
    fireEvent.click(screen.getByRole('button', { name: /当前状态：待评审/ }))
    expect(onSetStatus).toHaveBeenCalledWith('a1', 'passed')
  })
})

/** 从卡片主体按钮向上取所属 li，用于断言选中态类名 */
function containerOf(element: Element): Element {
  const card = element.closest('.asset-card')
  if (card === null) throw new Error('card not found')
  return card
}
