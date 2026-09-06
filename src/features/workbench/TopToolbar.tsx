/**
 * 工作台顶栏（CR-003 T-002 / UI-001；CR-004 T-001 按 rec/ 视觉语言重做）。
 *
 * rec TopToolbar 设计语言：44px 面板底、tool-btn 16px 线性图标按钮、垂直分隔线、
 * mono 读数。功能与契约不变：左栏开关（菜单图标）+ 应用标题 + 导入 + 加载样本 +
 * 比较 + 筛选控件组（Filters：状态/标签/搜索并入同一组）+ 导出 + 右栏开关。
 * 图标按钮以 aria-label 保持既有可访问名（存量测试语义不变），title 提供悬停提示；
 * 各按钮只负责回调，状态与持久化由 App 管理。
 */
import Filters from '../library/Filters.tsx'
import type { AssetFilter } from '../../domain/filter.ts'

/** rec 风格 16px stroke 线性图标（TopToolbar 专用） */
const Icon = {
  Menu: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  ),
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10.5V2.5M5 5.5l3-3 3 3" />
      <path d="M2.5 11v2a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-2" />
    </svg>
  ),
  Samples: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8 1.5l6 3.4v6.2l-6 3.4-6-3.4V4.9l6-3.4z" />
      <path d="M2 4.9l6 3.4 6-3.4M8 8.3v6.2" />
    </svg>
  ),
  Compare: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2.5" width="5" height="11" rx="0.5" />
      <rect x="9" y="2.5" width="5" height="11" rx="0.5" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5v8M5 7.5l3 3 3-3" />
      <path d="M2.5 11v2a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-2" />
    </svg>
  ),
  Info: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7v5M8 5.5v.5" />
    </svg>
  ),
}

export interface TopToolbarProps {
  filter: AssetFilter
  /** 可选标签名列表（注册表 ∪ 素材在用标签，由 App 用 collectTagNames 计算） */
  tagNames: readonly string[]
  onFilterChange: (filter: AssetFilter) => void
  /** 导入管线忙（导入中禁用加载样本） */
  importing: boolean
  samplesLoading: boolean
  onLoadSamples: () => void
  /** 已选满两张图片（比较按钮可用） */
  compareReady: boolean
  onOpenCompare: () => void
  /** 中央是否正处在导入视图（导入按钮高亮） */
  importActive: boolean
  onOpenImport: () => void
  exportOpen: boolean
  onToggleExport: () => void
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}

export default function TopToolbar({
  filter,
  tagNames,
  onFilterChange,
  importing,
  samplesLoading,
  onLoadSamples,
  compareReady,
  onOpenCompare,
  importActive,
  onOpenImport,
  exportOpen,
  onToggleExport,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: TopToolbarProps) {
  return (
    <header className="workbench__toolbar">
      <button
        type="button"
        className="tool-btn"
        aria-label="切换左栏素材列表"
        aria-pressed={leftOpen}
        title={leftOpen ? '折叠左栏素材列表' : '展开左栏素材列表'}
        onClick={onToggleLeft}
      >
        <Icon.Menu />
      </button>
      <h1 className="workbench__title">素材评审工作台</h1>
      <span className="workbench__sep" aria-hidden="true" />
      <button
        type="button"
        className={importActive ? 'tool-btn is-active' : 'tool-btn'}
        aria-label="导入"
        aria-pressed={importActive}
        title="导入素材（选择文件 / 拖拽）"
        onClick={onOpenImport}
      >
        <Icon.Upload />
      </button>
      <button
        type="button"
        className="tool-btn"
        aria-label="加载内置样本（STL）"
        title={samplesLoading ? '样本加载中…' : '加载内置样本（STL）'}
        disabled={importing || samplesLoading}
        onClick={onLoadSamples}
      >
        <Icon.Samples />
      </button>
      <button
        type="button"
        className="tool-btn"
        aria-label="比较"
        title={compareReady ? '并排比较所选的两张图片' : '先选中两张图片'}
        disabled={!compareReady}
        onClick={onOpenCompare}
      >
        <Icon.Compare />
      </button>
      <span className="workbench__sep" aria-hidden="true" />
      <Filters filter={filter} tagNames={tagNames} onChange={onFilterChange} />
      <span className="workbench__spacer" aria-hidden="true" />
      <button
        type="button"
        className={exportOpen ? 'tool-btn is-active' : 'tool-btn'}
        aria-label="导出"
        aria-expanded={exportOpen}
        title="导出 / 导入评审数据"
        onClick={onToggleExport}
      >
        <Icon.Download />
      </button>
      <span className="workbench__sep" aria-hidden="true" />
      <button
        type="button"
        className="tool-btn"
        aria-label="切换右栏信息面板"
        aria-pressed={rightOpen}
        style={{ color: rightOpen ? 'var(--accent)' : undefined }}
        title={rightOpen ? '折叠右栏信息面板' : '展开右栏信息面板'}
        onClick={onToggleRight}
      >
        <Icon.Info />
      </button>
    </header>
  )
}
