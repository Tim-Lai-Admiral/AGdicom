/**
 * 视口工具标识（CR-009 T-002 / R-024）。
 *
 * 顶栏工具组（TopToolbar）与查看器（DicomViewer；图片查看器 T-003 接入子集）
 * 共享的“激活工具”标识：pan/zoom/window/rotate/measure。状态由 App 持有并下发，
 * 顶栏按钮切换、查看器按工具解释拖拽/滚轮行为。
 * window/measure 仅 DICOM 支持，图片素材对应按钮呈禁用态；
 * 3D 查看器不接入工具组（R-024 非目标）。
 */

/** 视口工具：平移 / 缩放 / 调窗 / 旋转 / 测量 */
export type ViewerTool = 'pan' | 'zoom' | 'window' | 'rotate' | 'measure'

/** 默认工具：平移（进入素材即“拖拽移动视口”的常见手感） */
export const DEFAULT_VIEWER_TOOL: ViewerTool = 'pan'
