/**
 * 工作台顶栏（CR-003 T-002 / UI-001）。
 *
 * 全屏工作台的唯一常驻操作区：应用标题 + 类型筛选（状态/标签/搜索并入同一
 * 筛选控件组，复用 Filters）+ 导入 + 加载样本 + 比较 + 导出 + 左/右栏面板开关。
 * 各按钮只负责回调，状态与持久化由 App 管理（与旧“素材库头部”行为一致：
 * 比较 / 加载样本的禁用条件与提示文案保持不变）。
 */
import Filters from '../library/Filters.tsx'
import type { AssetFilter } from '../../domain/filter.ts'

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
      <h1 className="workbench__title">素材评审工作台</h1>
      <button
        type="button"
        className={importActive ? 'workbench__tool is-active' : 'workbench__tool'}
        aria-pressed={importActive}
        onClick={onOpenImport}
      >
        导入
      </button>
      <button
        type="button"
        className="workbench__tool"
        disabled={importing || samplesLoading}
        onClick={onLoadSamples}
      >
        {samplesLoading ? '样本加载中…' : '加载内置样本（STL）'}
      </button>
      <button
        type="button"
        className="workbench__tool"
        disabled={!compareReady}
        onClick={onOpenCompare}
        title={compareReady ? '并排比较所选的两张图片' : '先选中两张图片'}
      >
        比较
      </button>
      <Filters filter={filter} tagNames={tagNames} onChange={onFilterChange} />
      <span className="workbench__spacer" aria-hidden="true" />
      <button
        type="button"
        className={exportOpen ? 'workbench__tool is-active' : 'workbench__tool'}
        aria-expanded={exportOpen}
        onClick={onToggleExport}
      >
        导出
      </button>
      <button
        type="button"
        className={leftOpen ? 'workbench__tool is-active' : 'workbench__tool'}
        aria-pressed={leftOpen}
        aria-label="切换左栏素材列表"
        title={leftOpen ? '折叠左栏素材列表' : '展开左栏素材列表'}
        onClick={onToggleLeft}
      >
        左栏
      </button>
      <button
        type="button"
        className={rightOpen ? 'workbench__tool is-active' : 'workbench__tool'}
        aria-pressed={rightOpen}
        aria-label="切换右栏信息面板"
        title={rightOpen ? '折叠右栏信息面板' : '展开右栏信息面板'}
        onClick={onToggleRight}
      >
        右栏
      </button>
    </header>
  )
}
