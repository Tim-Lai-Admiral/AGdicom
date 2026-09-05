import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('shows placeholders when objectUrl is missing (post-refresh session)', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png' }),
      makeImageAsset({ id: 'a2', name: 'lung.png' }),
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getAllByText(/预览不可用/)).toHaveLength(2)
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

  it('removes the Escape listener on unmount', () => {
    const { onExit } = renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png' }),
      makeImageAsset({ id: 'a2', name: 'lung.png' }),
    )
    cleanup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).not.toHaveBeenCalled()
  })
})
