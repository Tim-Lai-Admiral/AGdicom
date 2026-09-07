/**
 * ImageStage 视口变换测试（CR-009 T-003 / R-024 图片子集）。
 *
 * 覆盖任务卡 Test requirements（Unit: ImageStage）：
 * - 视口控件渲染（放大/缩小/旋转 90°/重置 + mono 读数）；
 * - 按钮缩放/旋转与重置（恒等复位）；
 * - 拖拽平移（pan 工具默认）、zoom/rotate 工具重解释拖拽；
 * - 滚轮缩放（图片无切片，滚轮直接缩放）；
 * - Esc 复位；切换素材复位；占位（无 objectUrl）不渲染控件。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ImageStage from './ImageStage.tsx'
import type { Asset } from '../../domain/types.ts'

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
    objectUrl: 'blob:mock-1',
    ...overrides,
  }
}

function stageEl(): HTMLElement {
  const el = document.querySelector('.image-viewport__stage') as HTMLElement | null
  if (el === null) throw new Error('变换舞台未渲染')
  return el
}

function viewportEl(): HTMLElement {
  const el = document.querySelector('.image-stage__canvas') as HTMLElement | null
  if (el === null) throw new Error('视口未渲染')
  return el
}

function readout(): string {
  return (document.querySelector('.image-viewport__zoom') as HTMLElement).textContent ?? ''
}

describe('ImageStage: 视口变换（CR-009 T-003 / R-024 图片子集）', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders the viewport controls and the identity zoom readout', () => {
    render(<ImageStage asset={makeImageAsset()} />)
    for (const label of ['放大', '缩小', '旋转 90 度', '重置视图']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('img', { name: /heart\.png/ })).toBeTruthy()
    expect(readout()).toBe('100%')
    expect(viewportEl().getAttribute('data-tool')).toBe('pan') // 缺省工具：平移
    expect(stageEl().style.transform).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
  })

  it('zooms in/out via buttons (step 1.25x, readout follows)', () => {
    render(<ImageStage asset={makeImageAsset()} />)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(readout()).toBe('125%')
    expect(stageEl().style.transform).toContain('scale(1.25)')
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(readout()).toBe('100%')
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(readout()).toBe('80%')
  })

  it('rotates 90° per click and resets to identity', () => {
    render(<ImageStage asset={makeImageAsset()} />)
    fireEvent.click(screen.getByRole('button', { name: '旋转 90 度' }))
    fireEvent.click(screen.getByRole('button', { name: '旋转 90 度' }))
    expect(stageEl().style.transform).toContain('rotate(180deg)')
    fireEvent.click(screen.getByRole('button', { name: '重置视图' }))
    expect(stageEl().style.transform).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
    expect(readout()).toBe('100%')
  })

  it('pans by dragging with the default pan tool', () => {
    render(<ImageStage asset={makeImageAsset()} />)
    const viewport = viewportEl()
    fireEvent.pointerDown(viewport, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(viewport, { clientX: 40, clientY: 25 })
    fireEvent.pointerUp(viewport, {})
    expect(stageEl().style.transform).toBe('translate(30px, 15px) rotate(0deg) scale(1)')
  })

  it('zooms with the wheel (images have no slices; wheel zooms directly)', () => {
    render(<ImageStage asset={makeImageAsset()} />)
    fireEvent.wheel(viewportEl(), { deltaY: -120 })
    expect(readout()).toBe('110%')
    fireEvent.wheel(viewportEl(), { deltaY: 120 })
    expect(readout()).toBe('100%')
  })

  it('reinterprets the drag for the zoom tool (vertical drag) and rotate tool (horizontal drag)', () => {
    const { unmount } = render(<ImageStage asset={makeImageAsset()} activeTool="zoom" />)
    expect(viewportEl().getAttribute('data-tool')).toBe('zoom')
    let viewport = viewportEl()
    fireEvent.pointerDown(viewport, { button: 0, clientX: 50, clientY: 100 })
    fireEvent.pointerMove(viewport, { clientX: 50, clientY: 60 })
    fireEvent.pointerUp(viewport, {})
    expect(stageEl().style.transform).toBe('translate(0px, 0px) rotate(0deg) scale(1.4)')
    unmount()

    render(<ImageStage asset={makeImageAsset()} activeTool="rotate" />)
    viewport = viewportEl()
    fireEvent.pointerDown(viewport, { button: 0, clientX: 10, clientY: 50 })
    fireEvent.pointerMove(viewport, { clientX: 50, clientY: 50 })
    fireEvent.pointerUp(viewport, {})
    expect(stageEl().style.transform).toBe('translate(0px, 0px) rotate(20deg) scale(1)')
  })

  it('resets the transform via the Escape key', () => {
    render(<ImageStage asset={makeImageAsset()} />)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(readout()).toBe('125%')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(readout()).toBe('100%')
    expect(stageEl().style.transform).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
    // 非 Esc 按键不触发复位
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(readout()).toBe('125%')
  })

  it('resets the transform when the asset changes', () => {
    const { rerender } = render(<ImageStage asset={makeImageAsset({ id: 'a1' })} />)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(readout()).toBe('125%')
    rerender(<ImageStage asset={makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' })} />)
    expect(readout()).toBe('100%')
    expect(screen.getByRole('img', { name: /lung\.png/ })).toBeTruthy()
  })

  it('renders the placeholder without transform controls when the preview is unavailable', () => {
    render(<ImageStage asset={makeImageAsset({ objectUrl: undefined })} />)
    expect(screen.getByText('图片预览不可用：会话失效，可重新导入或删除该素材')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '放大' })).toBeNull()
    expect(screen.queryByRole('button', { name: '重置视图' })).toBeNull()
  })
})
