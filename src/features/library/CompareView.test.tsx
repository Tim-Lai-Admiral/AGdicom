import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import CompareView from './CompareView.tsx'

function makeImageAsset(overrides: Partial<Asset> = {}): Asset {
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

function renderCompare(left: Asset, right: Asset) {
  const onExit = vi.fn()
  render(<CompareView left={left} right={right} onExit={onExit} />)
  return { onExit }
}

describe('CompareView', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders a dialog with both image names and the exit button', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png' }),
      makeImageAsset({ id: 'a2', name: 'lung.png' }),
    )
    const dialog = screen.getByRole('dialog', { name: '图片比较' })
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('lung.png')).toBeTruthy()
    expect(screen.getByRole('button', { name: '退出比较' })).toBeTruthy()
    expect(dialog.querySelectorAll('.compare-pane__viewport')).toHaveLength(2)
  })

  it('renders both images side by side in equal panes when objectUrl exists', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    expect(screen.getByRole('img', { name: /heart\.png/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /lung\.png/ })).toBeTruthy()
  })

  it('exits via the exit button and via the Escape key', () => {
    const { onExit } = renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '退出比较' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(2)
    // 非 Esc 按键不触发退出
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('shows a load-failure placeholder without breaking the other pane', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:broken' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const images = screen.getAllByRole('img')
    fireEvent.error(images[0] as HTMLImageElement)
    expect(screen.getByText('图片加载失败')).toBeTruthy()
    expect(screen.getByRole('img', { name: /lung\.png/ })).toBeTruthy()
  })
})

describe('CompareView: 窗格独立变换（CR-009 T-003 / R-024）', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  function paneEls(): HTMLElement[] {
    const panes = Array.from(document.querySelectorAll('.compare-pane')) as HTMLElement[]
    if (panes.length !== 2) throw new Error('应渲染两个比较窗格')
    return panes
  }

  it('transforms each pane independently via its own controls', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const panes = paneEls()
    // 两侧窗格各有独立的视口控件（放大/缩小/旋转/重置）
    for (const pane of panes) {
      for (const label of ['放大', '缩小', '旋转 90 度', '重置视图']) {
        expect(within(pane).getByRole('button', { name: label })).toBeTruthy()
      }
    }
    // 左侧放大：仅左侧舞台变换，右侧保持恒等
    fireEvent.click(within(panes[0]).getByRole('button', { name: '放大' }))
    const leftStage = panes[0].querySelector('.image-viewport__stage') as HTMLElement
    const rightStage = panes[1].querySelector('.image-viewport__stage') as HTMLElement
    expect(leftStage.style.transform).toContain('scale(1.25)')
    expect(rightStage.style.transform).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
    // 左侧读数 125%，右侧读数仍为 100%
    expect(panes[0].querySelector('.image-viewport__zoom')?.textContent).toBe('125%')
    expect(panes[1].querySelector('.image-viewport__zoom')?.textContent).toBe('100%')
  })

  it('pans one pane by dragging without affecting the other', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const panes = paneEls()
    const leftViewport = panes[0].querySelector('.compare-pane__viewport') as HTMLElement
    fireEvent.pointerDown(leftViewport, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(leftViewport, { clientX: 12, clientY: -8 })
    fireEvent.pointerUp(leftViewport, {})
    expect(
      (panes[0].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toBe('translate(12px, -8px) rotate(0deg) scale(1)')
    expect(
      (panes[1].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
  })

  it('offers a per-pane reset without touching the other pane', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const panes = paneEls()
    fireEvent.click(within(panes[0]).getByRole('button', { name: '旋转 90 度' }))
    fireEvent.click(within(panes[1]).getByRole('button', { name: '放大' }))
    expect(
      (panes[0].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toContain('rotate(90deg)')
    expect(
      (panes[1].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toContain('scale(1.25)')
    // 重置左侧：仅左侧回恒等，右侧保留放大
    fireEvent.click(within(panes[0]).getByRole('button', { name: '重置视图' }))
    expect(
      (panes[0].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
    expect(
      (panes[1].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toContain('scale(1.25)')
  })
})
