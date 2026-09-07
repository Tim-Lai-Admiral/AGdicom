/**
 * 工作台顶栏（CR-003 T-002 / UI-001；CR-004 T-001 按 rec/ 视觉语言重做；
 * CR-009 T-002 / R-024 新增视口工具组）。
 *
 * rec TopToolbar 设计语言：44px 面板底、tool-btn 16px 线性图标按钮、垂直分隔线、
 * mono 读数。功能与契约不变：左栏开关（菜单图标）+ 应用标题 + 视口工具组 +
 * 导入 + 比较 + 筛选控件组（Filters：状态/标签/搜索并入同一组）+ 导出 + 右栏开关。
 * 图标按钮以 aria-label 保持既有可访问名（存量测试语义不变），title 提供悬停提示；
 * 各按钮只负责回调，状态与持久化由 App 管理。
 *
 * 视口工具组（R-024）：中央为 DICOM 或图片素材时显示（比较/导入/3D 隐藏）；
 * pan/zoom/window/rotate/measure 图标按钮（aria-pressed 切换态），激活工具由
 * App 持有并下发查看器；图片素材不支持 window/measure（禁用态），pan/zoom/rotate
 * 的图片侧行为由 T-003 接入。
 */
import type { ReactNode } from 'react'
import Filters from '../library/Filters.tsx'
import type { AssetFilter } from '../../domain/filter.ts'
import type { ViewerTool } from '../viewer/viewerTools.ts'

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

/** 视口工具图标（R-024；16px 线性，与既有 Icon 同语言） */
const ToolIcon = {
  Pan: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5v13M1.5 8h13" />
      <path d="M8 1.5 6.2 3.3M8 1.5l1.8 1.8M8 14.5l-1.8-1.8M8 14.5l1.8-1.8M1.5 8l1.8-1.8M1.5 8l1.8 1.8M14.5 8l-1.8-1.8M14.5 8l-1.8 1.8" />
    </svg>
  ),
  Zoom: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7.2" cy="7.2" r="4.7" />
      <path d="M10.7 10.7 14 14" />
      <path d="M7.2 5.2v4M5.2 7.2h4" />
    </svg>
  ),
  Window: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  Rotate: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.2 9.5a5.4 5.4 0 1 1-.7-4.2" />
      <path d="M12.5 1.8v3.5H9" />
    </svg>
  ),
  Measure: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="6" width="12" height="4" rx="0.5" />
      <path d="M5 6v2M8 6v2.8M11 6v2" />
    </svg>
  ),
}

/** 顶栏视口工具定义（R-024）：顺序即展示顺序；imageUnsupported → 图片素材禁用 */
const VIEWER_TOOL_BUTTONS: ReadonlyArray<{
  id: ViewerTool
  /** aria-label（中文，可访问名） */
  label: string
  /** 悬停提示 */
  title: string
  icon: ReactNode
  imageUnsupported?: boolean
}> = [
  { id: 'pan', label: '平移', title: '平移：拖拽移动视口', icon: <ToolIcon.Pan /> },
  { id: 'zoom', label: '缩放', title: '缩放：拖拽或 Ctrl+滚轮', icon: <ToolIcon.Zoom /> },
  {
    id: 'window',
    label: '窗宽窗位',
    title: '窗宽窗位：拖拽调节 C/W',
    icon: <ToolIcon.Window />,
    imageUnsupported: true,
  },
  { id: 'rotate', label: '旋转', title: '旋转：拖拽旋转视口', icon: <ToolIcon.Rotate /> },
  {
    id: 'measure',
    label: '测量（模拟）',
    title: '测量：拖拽绘制距离标注（模拟，非临床）',
    icon: <ToolIcon.Measure />,
    imageUnsupported: true,
  },
]

export interface TopToolbarProps {
  filter: AssetFilter
  /** 可选标签名列表（注册表 ∪ 素材在用标签，由 App 用 collectTagNames 计算） */
  tagNames: readonly string[]
  onFilterChange: (filter: AssetFilter) => void
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
  /** 中央查看素材种类（R-024 工具组可见性）：'dicom' | 'image' 显示；null（导入/比较/3D）隐藏 */
  toolGroupKind: 'dicom' | 'image' | null
  /** 当前激活的视口工具（App 持有） */
  viewerTool: ViewerTool
  /** 工具按钮点击回调（切换激活工具） */
  onViewerToolChange: (tool: ViewerTool) => void
}

export default function TopToolbar({
  filter,
  tagNames,
  onFilterChange,
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
  toolGroupKind,
  viewerTool,
  onViewerToolChange,
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
      {toolGroupKind !== null ? (
        <>
          {/* 视口工具组（R-024）：图片素材不支持 window/measure → 禁用态 */}
          <div role="group" aria-label="视口工具" className="workbench__toolgroup">
            {VIEWER_TOOL_BUTTONS.map((tool) => {
              const unsupported = toolGroupKind === 'image' && tool.imageUnsupported === true
              const active = viewerTool === tool.id
              return (
                <button
                  key={tool.id}
                  type="button"
                  className={active ? 'tool-btn active' : 'tool-btn'}
                  aria-label={tool.label}
                  aria-pressed={active}
                  disabled={unsupported}
                  title={unsupported ? `${tool.title}（图片素材不支持）` : tool.title}
                  onClick={() => onViewerToolChange(tool.id)}
                >
                  {tool.icon}
                </button>
              )
            })}
          </div>
          <span className="workbench__sep" aria-hidden="true" />
        </>
      ) : null}
      <button
        type="button"
        className={importActive ? 'tool-btn active' : 'tool-btn'}
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
        className={exportOpen ? 'tool-btn active' : 'tool-btn'}
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
