import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AppState } from '../../domain/types.ts'
import { buildExportFile } from '../../store/io.ts'
import { createEmptyState } from '../../store/repository.ts'
import ExportImport, { makeExportFileName } from './ExportImport.tsx'

const NOW = '2026-09-03T08:00:00.000Z'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'heart.png',
    kind: 'image',
    status: 'passed',
    tags: ['心脏'],
    note: '结构清晰',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: NOW,
    ...overrides,
  }
}

function makeState(): AppState {
  const asset = makeAsset()
  return {
    assets: { [asset.id]: asset },
    tags: { 心脏: { name: '心脏', count: 1 } },
    reviews: { [asset.id]: [{ status: 'passed', comment: '初审通过', createdAt: NOW }] },
  }
}

// ---- 测试桩：URL.createObjectURL / revokeObjectURL 与 <a> 点击（jsdom 无下载能力） ----

let originalCreate: PropertyDescriptor | undefined
let originalRevoke: PropertyDescriptor | undefined

/** 安装 createObjectURL 桩：'ok' 捕获 Blob，'throw' 模拟下载能力不可用 */
function stubObjectUrls(behavior: 'ok' | 'throw'): { blobs: Blob[] } {
  const blobs: Blob[] = []
  originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: (blob: Blob): string => {
      if (behavior === 'throw') throw new Error('download blocked')
      blobs.push(blob)
      return `blob:mock-${blobs.length}`
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  })
  return { blobs }
}

/** 拦截锚点点击：捕获被下载的 <a>（download 属性断言用） */
function spyAnchorClick(): { anchors: HTMLAnchorElement[] } {
  const anchors: HTMLAnchorElement[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick(
    this: HTMLAnchorElement,
  ) {
    anchors.push(this)
  })
  return { anchors }
}

/** 通过隐藏的 file input 模拟用户选择备份文件 */
function chooseFile(input: HTMLInputElement, text: string, name = 'backup.json'): void {
  const file = new File([text], name, { type: 'application/json' })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ExportImport', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    // 还原 URL 桩，避免污染其他用例
    if (originalCreate === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreate)
    }
    if (originalRevoke === undefined) {
      delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
    } else {
      Object.defineProperty(URL, 'revokeObjectURL', originalRevoke)
    }
    originalCreate = undefined
    originalRevoke = undefined
    vi.restoreAllMocks()
  })

  describe('makeExportFileName', () => {
    it('builds review-export-YYYYMMDD-HHmmss.json from local time', () => {
      expect(makeExportFileName(new Date(2026, 8, 4, 7, 8, 9))).toBe(
        'review-export-20260904-070809.json',
      )
    })
  })

  it('downloads the export with the expected filename and schema v1 content', async () => {
    const { blobs } = stubObjectUrls('ok')
    const { anchors } = spyAnchorClick()
    render(<ExportImport state={makeState()} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }))

    expect(anchors).toHaveLength(1)
    const anchor = anchors[0]
    if (anchor === undefined) throw new Error('anchor missing')
    expect(anchor.download).toMatch(/^review-export-\d{8}-\d{6}\.json$/)

    expect(blobs).toHaveLength(1)
    const blob = blobs[0]
    if (blob === undefined) throw new Error('blob missing')
    const parsed = JSON.parse(await blob.text()) as {
      schemaVersion: number
      exportedAt: string
      state: AppState
    }
    expect(parsed.schemaVersion).toBe(1)
    expect(Object.keys(parsed.state.assets)).toHaveLength(1)
    expect(parsed.state.reviews['asset-1']).toEqual([
      { status: 'passed', comment: '初审通过', createdAt: NOW },
    ])
    expect(screen.getByRole('status').textContent).toContain('已导出评审数据（1 个素材）')
  })

  it('shows an error message when the download cannot be created', () => {
    stubObjectUrls('throw')
    render(<ExportImport state={makeState()} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('导出失败')
    expect(alert.textContent).toContain('download blocked')
  })

  it('restores the exported state after the library is cleared (round trip)', async () => {
    const original = makeState()
    const { blobs } = stubObjectUrls('ok')
    spyAnchorClick()
    const first = render(<ExportImport state={original} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }))
    const blob = blobs[0]
    if (blob === undefined) throw new Error('blob missing')
    const content = await blob.text()
    first.unmount()

    // 模拟“清空素材库”后从备份还原
    const onImport = vi.fn()
    const second = render(<ExportImport state={createEmptyState()} onImport={onImport} />)
    const input = second.container.querySelector('input[type="file"]') as HTMLInputElement
    chooseFile(input, content, 'review-export-20260904-070809.json')

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1)
    })
    // parseImportFile 还原出的状态与导出前一致（素材 + 标签 + 评审记录）
    expect(onImport.mock.calls[0]?.[0]).toEqual(original)
    expect(screen.getByRole('status').textContent).toContain('已导入并还原 1 个素材')
  })

  it('rejects an import whose schema version differs, with a Chinese message', async () => {
    const onImport = vi.fn()
    const { container } = render(<ExportImport state={makeState()} onImport={onImport} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    chooseFile(
      input,
      JSON.stringify({ schemaVersion: 999, exportedAt: NOW, state: createEmptyState() }),
    )
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    expect(screen.getByRole('alert').textContent).toContain('schema 版本不符')
    expect(onImport).not.toHaveBeenCalled()
  })

  it('rejects a file that is not valid JSON', async () => {
    const onImport = vi.fn()
    const { container } = render(<ExportImport state={makeState()} onImport={onImport} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    chooseFile(input, '这不是 JSON', 'broken.json')
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    expect(screen.getByRole('alert').textContent).toContain('不是有效的 JSON')
    expect(onImport).not.toHaveBeenCalled()
  })

  it('warns on name conflicts and imports only after confirmation', async () => {
    // 现有素材 heart.png（asset-1）；备份里的 heart.png（asset-2）与其名称冲突
    const incoming = makeState()
    incoming.assets = { [makeAsset({ id: 'asset-2' }).id]: makeAsset({ id: 'asset-2' }) }
    const conflictContent = JSON.stringify(buildExportFile(incoming, NOW))

    const onImport = vi.fn()
    const { container } = render(<ExportImport state={makeState()} onImport={onImport} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    chooseFile(input, conflictContent)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    expect(screen.getByRole('alert').textContent).toContain('1 个名称与现有素材冲突')
    expect(screen.getByRole('alert').textContent).toContain('heart.png')
    expect(onImport).not.toHaveBeenCalled()

    // 取消：不做任何变更
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onImport).not.toHaveBeenCalled()

    // 再次导入并确认：整体替换
    chooseFile(input, conflictContent)
    fireEvent.click(await screen.findByRole('button', { name: '仍然导入' }))
    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1)
    })
    expect(onImport.mock.calls[0]?.[0]).toEqual(incoming)
    expect(screen.getByRole('status').textContent).toContain('已导入并还原 1 个素材')
  })
})
