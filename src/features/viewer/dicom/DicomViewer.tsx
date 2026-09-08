/**
 * DICOM 查看器（CR-001 T-005 / R-003；CR-003 T-003 增强 W/L 与测量 Mock；
 * CR-009 视口化与视口工具；CR-012 T-003 / R-029 视口能力抽出复用）。
 *
 * 弹层壳（role="dialog"，非路由）：标题栏（打开文件名 / Esc 提示 / 关闭按钮）、
 * Esc 关闭与 Tab 焦点圈定（T-005 Minor 无障碍项）、关闭（卸载）后焦点还原。
 * 视口本体（Canvas 灰度预览 + 四角元数据覆盖层 + 切片选择器 + 视口工具 + 测量 +
 * 解析/预览降级链路）自 CR-012 T-003 起抽为 DicomViewport（本目录同文件），
 * 供本单窗查看器与比较视图双窗（CompareView）复用；行为契约不变：
 * - 打开时解析“所属 series 的文件集合”（R-018/R-019 聚合口径，详见 DicomViewport），
 *   经 onMetasParsed 批量回写素材（含 sliceCount），由 App 持久化；
 * - 切片滚轮/滑动条双向同步（R-025）；切片变化经 onSelectedSliceChange 上报
 *   （CR-008 T-002 / R-022 左栏高亮）；
 * - 视口工具（pan/zoom/window/rotate/measure，R-024）由 App 持有 activeTool 下发；
 * - W/L（R-003 修改）由 App 持有，右栏面板可调，window 工具拖拽回传。
 * 任何解析/解码/降级路径都不崩溃（口径见 DicomViewport 头注释）。
 *
 * 展示内容仅为工程元数据，不包含任何诊断/治疗暗示。
 */
import { useEffect, useRef } from 'react'
import type { Asset, DicomMeta } from '../../../domain/types.ts'
import DicomViewport from './DicomViewport.tsx'
import { AUTO_WINDOW_LEVEL } from './windowLevel.ts'
import type { WindowLevelState } from './windowLevel.ts'
import type { ViewerTool } from '../viewerTools.ts'

export interface DicomViewerProps {
  /** 当前打开的 DICOM 素材 */
  asset: Asset
  /** 素材库中全部 DICOM 素材（用于按 series 聚合统计切片数与切换切片） */
  dicomAssets: readonly Asset[]
  /** 本会话解析得到元数据后批量回写（持久化由上层完成） */
  onMetasParsed: (metas: Record<string, DicomMeta>) => void
  /** 关闭查看器（“关闭”按钮与 Esc 键均触发） */
  onClose: () => void
  /** 当前切片变化上报（CR-008 T-002 / R-022）：selectedAssetId 变化（含初始选择、
   *  滑动条切换等任意路径）时回传切片素材 ID；同一 ID 不重复回调。缺省不上报 */
  onSelectedSliceChange?: (assetId: string) => void
  /** 窗宽窗位（R-003 修改）；缺省自动 min-max（与既有行为等价）。App 持有，右栏面板可调 */
  windowLevel?: WindowLevelState
  /** 激活的视口工具（CR-009 T-002 / R-024；App 持有，顶栏工具组切换）。缺省平移 */
  activeTool?: ViewerTool
  /** 窗宽窗位变更上报（window 工具拖拽；App 持有 wc/ww，CR-003 契约）。缺省不调窗 */
  onWindowLevelChange?: (wl: WindowLevelState) => void
}

export default function DicomViewer({
  asset,
  dicomAssets,
  onMetasParsed,
  onClose,
  onSelectedSliceChange,
  windowLevel = AUTO_WINDOW_LEVEL,
  activeTool = 'pan',
  onWindowLevelChange,
}: DicomViewerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  // ---- 弹层交互：打开时聚焦关闭按钮；Tab / Shift+Tab 焦点圈定在弹层内；Esc 关闭；
  // 关闭（卸载）后焦点还原到打开前的触发元素（T-005 Minor 无障碍项）----
  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (dialog === null) return
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusables.length === 0) {
        event.preventDefault()
        closeButtonRef.current?.focus()
        return
      }
      const first = focusables[0] as HTMLElement
      const last = focusables[focusables.length - 1] as HTMLElement
      const active = document.activeElement
      const activeInside = active instanceof HTMLElement && dialog.contains(active)
      if (event.shiftKey) {
        if (!activeInside || active === first) {
          event.preventDefault()
          last.focus()
        }
        return
      }
      if (!activeInside || active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div className="dicom-viewer-overlay">
      <section
        ref={dialogRef}
        className="dicom-viewer"
        role="dialog"
        aria-label="DICOM 详情"
      >
        <header className="dicom-viewer__header">
          <h2 className="dicom-viewer__title">DICOM 详情</h2>
          <p className="dicom-viewer__file" title={asset.file.fileName}>
            {asset.file.fileName}
          </p>
          <p className="dicom-viewer__esc-hint">按 Esc 也可关闭</p>
          <button type="button" ref={closeButtonRef} className="dicom-viewer__close" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="dicom-viewer__body">
          <section className="dicom-viewer__preview" aria-label="切片预览">
            {/* 视口本体（CR-012 T-003 / R-029 抽出）：单窗非受控挂载，行为与抽出前一致 */}
            <DicomViewport
              asset={asset}
              dicomAssets={dicomAssets}
              onMetasParsed={onMetasParsed}
              onSelectedSliceChange={onSelectedSliceChange}
              windowLevel={windowLevel}
              activeTool={activeTool}
              onWindowLevelChange={onWindowLevelChange}
            />
          </section>
        </div>
      </section>
    </div>
  )
}
