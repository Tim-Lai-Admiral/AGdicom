/**
 * Model3DViewer UI 逻辑单测（CR-001 T-006）。
 *
 * jsdom 无 WebGL / 无 Canvas：渲染链路测到“加载成功 → WebGL 不可用降级提示”为止，
 * three.js 场景与 OrbitControls 交互不在 jsdom 可测范围（任务卡：以手动验证为主）。
 * 覆盖：弹层结构与文件名、操作提示文案可见、加载错误 + 重试成功、
 * 无会话文件内容（刷新后）提示、关闭按钮与 Esc。
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../../domain/types.ts'
import { buildStlFile } from './__fixtures__/buildStlFile.ts'
import Model3DViewer from './Model3DViewer.tsx'

function makeModelAsset(objectUrl?: string): Asset {
  const at = '2026-09-01T00:00:00.000Z'
  return {
    id: 'model-1',
    name: 'aorta.stl',
    kind: 'model',
    status: 'pending',
    tags: [],
    note: '',
    source: '样本 STL',
    file: { fileName: 'aorta.stl', fileSize: 284, fileType: 'model/stl' },
    createdAt: at,
    updatedAt: at,
    objectUrl,
  }
}

/** fetch 桩：对任意 URL 返回最小二进制 STL（body 为 null 走 arrayBuffer 分支） */
function stubFetchWithFixture(): void {
  const bytes = new Uint8Array(buildStlFile())
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => String(bytes.byteLength) },
      body: null,
      arrayBuffer: async () => bytes.slice().buffer,
    })),
  )
}

describe('Model3DViewer', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows the dialog with file info and interaction hints, then the WebGL degrade message', async () => {
    // jsdom 无 WebGL：getContext 返回 null（T-005 同款处理，避免 not-implemented 噪音）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    stubFetchWithFixture()
    render(<Model3DViewer asset={makeModelAsset('blob:model-1')} onClose={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: '3D 模型预览' })
    expect(within(dialog).getByText('aorta.stl（284 B）')).toBeTruthy()

    // 操作提示（旋转 / 缩放 / 平移）常驻可见（验收：文案可见）
    expect(within(dialog).getByText('左键拖拽：旋转')).toBeTruthy()
    expect(within(dialog).getByText('滚轮：缩放')).toBeTruthy()
    expect(within(dialog).getByText('右键拖拽：平移')).toBeTruthy()

    // 加载成功但 WebGL 不可用 → 降级提示而非白屏，不崩溃
    await waitFor(() => {
      expect(within(dialog).getByText(/不支持 WebGL/)).toBeTruthy()
    })
  })

  it('shows a readable error with a retry button, and retry succeeds after the file is fixed', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const fetchMock = vi.fn<() => Promise<unknown>>(async () => {
      throw new Error('network gone')
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<Model3DViewer asset={makeModelAsset('blob:model-bad')} onClose={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: '3D 模型预览' })
    await waitFor(() => {
      expect(within(dialog).getByText(/模型加载失败/)).toBeTruthy()
    })
    expect(within(dialog).getByText(/network gone/)).toBeTruthy()

    // 修复后重试：fetch 恢复正常 → 加载成功 → 到达 WebGL 降级提示（jsdom 终点）
    fetchMock.mockImplementation(async () => {
      const bytes = new Uint8Array(buildStlFile())
      return {
        ok: true,
        status: 200,
        headers: { get: () => String(bytes.byteLength) },
        body: null,
        arrayBuffer: async () => bytes.slice().buffer,
      }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '重试' }))
    await waitFor(() => {
      expect(within(dialog).getByText(/不支持 WebGL/)).toBeTruthy()
    })
    expect(within(dialog).queryByText(/模型加载失败/)).toBeNull()
  })

  it('asks to re-import when the session file content is unavailable after a refresh', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<Model3DViewer asset={makeModelAsset(undefined)} onClose={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: '3D 模型预览' })
    expect(within(dialog).getByText(/刷新后需重新导入该 3D 模型文件/)).toBeTruthy()
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('closes via the close button and the Escape key', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    stubFetchWithFixture()
    const onClose = vi.fn()
    render(<Model3DViewer asset={makeModelAsset('blob:model-1')} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
