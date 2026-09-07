/**
 * 图片视口变换（CR-009 T-003 / R-024 图片子集）。
 *
 * ImageStage（单图）与 CompareView 窗格（比较）共用的视口变换逻辑：
 * - transform 状态（offset / scale / rotate，CSS transform 施加，与 DicomViewer
 *   T-002 的“变换舞台”同一实现口径与拖拽手感常量）；
 * - 按激活工具解释拖拽：pan 拖拽平移 / zoom 竖拖缩放 / rotate 横拖旋转；
 *   比较窗格无顶栏工具组（R-024：比较视图隐藏工具组）→ 缺省按 pan 解释；
 * - 滚轮缩放（图片无切片，滚轮直接缩放，上滚放大下滚缩小，钳制上下限）；
 * - 按钮步进（放大 / 缩小 / 旋转 90°）与重置（图片支持按钮入口，R-024 验收
 *   “拖拽/滚轮/按钮”三通道）。
 * window / measure 仅 DICOM 支持，图片不接入（TopToolbar 禁用态，T-002）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { ViewerTool } from './viewerTools.ts'

/** 缩放下限（20%） */
export const IMAGE_ZOOM_MIN = 0.2
/** 缩放上限（8 倍） */
export const IMAGE_ZOOM_MAX = 8
/** 滚轮单档缩放系数（上滚放大、下滚缩小） */
export const IMAGE_ZOOM_WHEEL_FACTOR = 1.1
/** 按钮（放大/缩小）单档缩放系数 */
export const IMAGE_ZOOM_BUTTON_FACTOR = 1.25
/** 缩放拖拽灵敏度：每像素 0.01 倍（向上拖放大，与 DICOM 视口一致） */
export const IMAGE_ZOOM_DRAG_STEP = 0.01
/** 旋转拖拽灵敏度：每像素 0.5°（向右拖顺时针，与 DICOM 视口一致） */
export const IMAGE_ROTATE_DRAG_STEP = 0.5

/** 视口变换状态：平移 offset / 缩放 zoom / 旋转 rotateDeg（度） */
export interface ImageViewportTransform {
  zoom: number
  rotateDeg: number
  offsetX: number
  offsetY: number
}

export const IMAGE_IDENTITY_VIEWPORT: ImageViewportTransform = {
  zoom: 1,
  rotateDeg: 0,
  offsetX: 0,
  offsetY: 0,
}

/** CSS transform 模板（与 DicomViewer 变换舞台同序：translate → rotate → scale） */
export function imageViewportTransformCss(t: ImageViewportTransform): string {
  return `translate(${t.offsetX}px, ${t.offsetY}px) rotate(${t.rotateDeg}deg) scale(${t.zoom})`
}

/** 缩放钳制（拖拽/滚轮/按钮共用；不溢出上下限） */
export function clampImageZoom(zoom: number): number {
  return Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, zoom))
}

/** 进行中的拖拽会话（pointerdown 建立、pointerup 结束；经 ref 存放，move 高频更新不经 state） */
type ImageDrag =
  | { kind: 'pan'; startClientX: number; startClientY: number; baseX: number; baseY: number }
  | { kind: 'zoom'; startClientY: number; baseZoom: number }
  | { kind: 'rotate'; startClientX: number; baseDeg: number }

export interface ImageViewportApi {
  /** 当前变换（CSS transform 施加在舞台元素上） */
  transform: ImageViewportTransform
  /** 视口元素展开用：pointer 拖拽三件套（按激活工具解释 pan/zoom/rotate） */
  pointerHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  }
  /** 按钮步进：放大 / 缩小 / 旋转 deg 度（正值为顺时针） */
  zoomIn: () => void
  zoomOut: () => void
  rotateBy: (deg: number) => void
  /** 重置回恒等变换 */
  reset: () => void
}

/**
 * 图片视口变换 hook：滚轮监听挂载在 viewportRef 元素（passive:false 才能
 * preventDefault，拦截页面滚动），拖拽经 pointer 事件由组件展开。
 * activeTool 缺省/null（比较窗格）按 pan 解释；window/measure 不会传入图片侧。
 */
export function useImageViewportTransform<T extends HTMLElement>(
  viewportRef: RefObject<T | null>,
  activeTool?: ViewerTool | null,
): ImageViewportApi {
  const [transform, setTransform] = useState<ImageViewportTransform>(IMAGE_IDENTITY_VIEWPORT)
  const dragRef = useRef<ImageDrag | null>(null)

  // ---- 滚轮缩放：图片无切片可切换，滚轮直接缩放（上滚放大、下滚缩小）----
  useEffect(() => {
    const el = viewportRef.current
    if (el === null) return
    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? IMAGE_ZOOM_WHEEL_FACTOR : 1 / IMAGE_ZOOM_WHEEL_FACTOR
      setTransform((prev) => ({ ...prev, zoom: clampImageZoom(prev.zoom * factor) }))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [viewportRef])

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return
    const capture = (): void => {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // jsdom 等环境不支持 pointer capture：不影响拖拽主流程
      }
    }
    const tool = activeTool ?? 'pan'
    if (tool === 'zoom') {
      dragRef.current = { kind: 'zoom', startClientY: event.clientY, baseZoom: transform.zoom }
      capture()
      return
    }
    if (tool === 'rotate') {
      dragRef.current = { kind: 'rotate', startClientX: event.clientX, baseDeg: transform.rotateDeg }
      capture()
      return
    }
    dragRef.current = {
      kind: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseX: transform.offsetX,
      baseY: transform.offsetY,
    }
    capture()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    if (drag.kind === 'pan') {
      const offsetX = drag.baseX + (event.clientX - drag.startClientX)
      const offsetY = drag.baseY + (event.clientY - drag.startClientY)
      setTransform((prev) => ({ ...prev, offsetX, offsetY }))
      return
    }
    if (drag.kind === 'zoom') {
      // 向上拖放大（startY - y > 0）
      const zoom = clampImageZoom(drag.baseZoom + (drag.startClientY - event.clientY) * IMAGE_ZOOM_DRAG_STEP)
      setTransform((prev) => ({ ...prev, zoom }))
      return
    }
    const rotateDeg = drag.baseDeg + (event.clientX - drag.startClientX) * IMAGE_ROTATE_DRAG_STEP
    setTransform((prev) => ({ ...prev, rotateDeg }))
  }

  const handlePointerUp = (): void => {
    dragRef.current = null
  }

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, zoom: clampImageZoom(prev.zoom * IMAGE_ZOOM_BUTTON_FACTOR) }))
  }, [])
  const zoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, zoom: clampImageZoom(prev.zoom / IMAGE_ZOOM_BUTTON_FACTOR) }))
  }, [])
  const rotateBy = useCallback((deg: number) => {
    setTransform((prev) => ({ ...prev, rotateDeg: prev.rotateDeg + deg }))
  }, [])
  const reset = useCallback(() => setTransform(IMAGE_IDENTITY_VIEWPORT), [])

  return {
    transform,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
    zoomIn,
    zoomOut,
    rotateBy,
    reset,
  }
}

/** 视口控件图标（16px 线性，与 TopToolbar 图标同语言） */
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
)

const MinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 8h10" />
  </svg>
)

const RotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.2 9.5a5.4 5.4 0 1 1-.7-4.2" />
    <path d="M12.5 1.8v3.5H9" />
  </svg>
)

export interface ImageViewportControlsProps {
  /** useImageViewportTransform 返回的视口操作集 */
  api: ImageViewportApi
}

/**
 * 视口右上小控件：放大 / 缩小 / 旋转 90° 按钮 + mono 缩放读数 + 重置
 * （R-024 图片子集验收“拖拽/滚轮/按钮”三通道；图片与比较窗格共用）。
 * 控件内 pointer 事件不冒泡到视口（避免按下按钮误启动拖拽会话）。
 */
export function ImageViewportControls({ api }: ImageViewportControlsProps) {
  return (
    <div
      className="image-viewport__controls"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" className="image-viewport__ctl" aria-label="放大" title="放大" onClick={api.zoomIn}>
        <PlusIcon />
      </button>
      <span className="image-viewport__zoom">{`${Math.round(api.transform.zoom * 100)}%`}</span>
      <button type="button" className="image-viewport__ctl" aria-label="缩小" title="缩小" onClick={api.zoomOut}>
        <MinusIcon />
      </button>
      <button
        type="button"
        className="image-viewport__ctl"
        aria-label="旋转 90 度"
        title="旋转 90°"
        onClick={() => api.rotateBy(90)}
      >
        <RotateIcon />
      </button>
      <button type="button" className="image-viewport__ctl image-viewport__ctl--text" aria-label="重置视图" title="重置视图" onClick={api.reset}>
        重置
      </button>
    </div>
  )
}
