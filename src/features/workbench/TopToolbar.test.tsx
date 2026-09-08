import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TopToolbar from './TopToolbar.tsx'
import { DEFAULT_ASSET_FILTER } from '../../domain/filter.ts'
import type { AssetFilter } from '../../domain/filter.ts'
import { DEFAULT_VIEWER_TOOL } from '../viewer/viewerTools.ts'
import type { ViewerTool } from '../viewer/viewerTools.ts'

function renderToolbar(overrides: {
  toolGroupKind?: 'dicom' | 'image' | null
  viewerTool?: ViewerTool
  onViewerToolChange?: (tool: ViewerTool) => void
  compareMode?: boolean
  compareAvailable?: boolean
  importActive?: boolean
  settingsOpen?: boolean
} = {}) {
  const filter: AssetFilter = DEFAULT_ASSET_FILTER
  const props = {
    filter,
    tagNames: [],
    onFilterChange: vi.fn(),
    compareAvailable: true,
    compareMode: false,
    onToggleCompare: vi.fn(),
    importActive: false,
    onOpenImport: vi.fn(),
    exportOpen: false,
    onToggleExport: vi.fn(),
    settingsOpen: false,
    onToggleSettings: vi.fn(),
    leftOpen: true,
    rightOpen: true,
    onToggleLeft: vi.fn(),
    onToggleRight: vi.fn(),
    toolGroupKind: 'dicom' as const,
    viewerTool: DEFAULT_VIEWER_TOOL,
    onViewerToolChange: vi.fn(),
    ...overrides,
  }
  render(<TopToolbar {...props} />)
  return props
}

afterEach(() => {
  cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
})

describe('TopToolbar: 视口工具组（CR-009 T-002 / R-024）', () => {
  it('renders the five tool buttons for a DICOM asset and switches the active tool', () => {
    const { onViewerToolChange } = renderToolbar({ toolGroupKind: 'dicom' })

    const group = screen.getByRole('group', { name: '视口工具' })
    for (const label of ['平移', '缩放', '窗宽窗位', '旋转', '测量（模拟）']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    // 默认激活平移（aria-pressed），其余未激活；DICOM 下无禁用按钮
    expect(screen.getByRole('button', { name: '平移' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '旋转' }).getAttribute('aria-pressed')).toBe('false')
    for (const label of ['平移', '缩放', '窗宽窗位', '旋转', '测量（模拟）']) {
      expect(
        (screen.getByRole('button', { name: label }) as HTMLButtonElement).disabled,
      ).toBe(false)
    }

    // 点击“旋转”→ 上报切换激活工具（状态由 App 持有）
    fireEvent.click(screen.getByRole('button', { name: '旋转' }))
    expect(onViewerToolChange).toHaveBeenCalledWith('rotate')
    expect(group.getAttribute('aria-label')).toBe('视口工具')
  })

  it('reflects the active tool via aria-pressed (controlled state)', () => {
    renderToolbar({ toolGroupKind: 'dicom', viewerTool: 'window' })
    expect(screen.getByRole('button', { name: '平移' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: '窗宽窗位' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('disables window/measure for image assets and keeps pan/zoom/rotate available', () => {
    const { onViewerToolChange } = renderToolbar({ toolGroupKind: 'image' })
    expect(
      (screen.getByRole('button', { name: '窗宽窗位' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: '测量（模拟）' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    for (const label of ['平移', '缩放', '旋转']) {
      expect((screen.getByRole('button', { name: label }) as HTMLButtonElement).disabled).toBe(false)
    }
    fireEvent.click(screen.getByRole('button', { name: '缩放' }))
    expect(onViewerToolChange).toHaveBeenCalledWith('zoom')
  })

  it('hides the tool group outside asset viewing (import/compare/3D)', () => {
    renderToolbar({ toolGroupKind: null })
    expect(screen.queryByRole('group', { name: '视口工具' })).toBeNull()
    expect(screen.queryByRole('button', { name: '平移' })).toBeNull()
  })
})

describe('TopToolbar: 汉字按钮与比较模式入口（CR-011 T-002 / R-002）', () => {
  it('renders 导入/比较 as Chinese text buttons without legacy icon-only variants', () => {
    renderToolbar()
    const importBtn = screen.getByRole('button', { name: '导入' })
    const compareBtn = screen.getByRole('button', { name: '比较' })
    expect(importBtn.textContent).toBe('导入')
    expect(compareBtn.textContent).toBe('比较')
    expect(importBtn.className).toContain('tool-btn--text')
    expect(compareBtn.className).toContain('tool-btn--text')
    // 无旧图标按钮残留（同一名下不应再有 svg 图标按钮）
    expect(importBtn.querySelector('svg')).toBeNull()
    expect(compareBtn.querySelector('svg')).toBeNull()
  })

  it('reports the compare toggle and is disabled without comparable image assets', () => {
    const { onToggleCompare } = renderToolbar({ compareAvailable: false })
    const compareBtn = screen.getByRole('button', { name: '比较' }) as HTMLButtonElement
    expect(compareBtn.disabled).toBe(true)
    fireEvent.click(compareBtn)
    expect(onToggleCompare).not.toHaveBeenCalled()

    cleanup()
    const { onToggleCompare: onToggleAvailable } = renderToolbar({ compareAvailable: true })
    const enabledBtn = screen.getByRole('button', { name: '比较' }) as HTMLButtonElement
    expect(enabledBtn.disabled).toBe(false)
    expect(enabledBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(enabledBtn)
    expect(onToggleAvailable).toHaveBeenCalledTimes(1)
  })

  it('shows the 完成 state inside compare mode and exits via the same button', () => {
    const { onToggleCompare } = renderToolbar({ compareMode: true, compareAvailable: true })
    const doneBtn = screen.getByRole('button', { name: '完成' })
    expect(screen.queryByRole('button', { name: '比较' })).toBeNull()
    expect(doneBtn.getAttribute('aria-pressed')).toBe('true')
    expect((doneBtn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(doneBtn)
    expect(onToggleCompare).toHaveBeenCalledTimes(1)
  })

  it('keeps the 导入 button clickable with its toggle state (功能不变)', () => {
    const { onOpenImport } = renderToolbar({ importActive: true })
    const importBtn = screen.getByRole('button', { name: '导入' })
    expect(importBtn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(importBtn)
    expect(onOpenImport).toHaveBeenCalledTimes(1)
  })
})

describe('TopToolbar: 设置按钮（CR-012 T-001 / R-027）', () => {
  it('renders the settings entry with aria-expanded state and reports toggles', () => {
    const { onToggleSettings } = renderToolbar()
    const settingsBtn = screen.getByRole('button', { name: '设置' })
    expect(settingsBtn.getAttribute('aria-expanded')).toBe('false')
    expect(settingsBtn.className).not.toContain('active')
    fireEvent.click(settingsBtn)
    expect(onToggleSettings).toHaveBeenCalledTimes(1)

    // 打开态（由 App 持有）：aria-expanded=true + active 样式
    cleanup()
    renderToolbar({ settingsOpen: true })
    const openBtn = screen.getByRole('button', { name: '设置' })
    expect(openBtn.getAttribute('aria-expanded')).toBe('true')
    expect(openBtn.className).toContain('active')
  })
})
