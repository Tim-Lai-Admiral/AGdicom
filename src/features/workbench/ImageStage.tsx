/**
 * 中央图片预览区（CR-003 T-002 / UI-001；CR-009 T-003 / R-024 视口工具接入）。
 *
 * 选中 image 素材时中央查看区显示该图片（会话级 objectUrl）；缺失或加载失败
 * 时显示占位与提示（与 AssetGrid/CompareView 的 objectUrl 会话字段约定一致），
 * 不影响布局。仅预览，不含比较（比较由 CompareView 承载）。
 *
 * 视口工具（CR-009 T-003 / R-024 图片子集）：激活工具由 App 持有（activeTool 下发，
 * 顶栏工具组切换；window/measure 图片不支持、按钮禁用）：
 * - pan：拖拽平移；zoom：竖拖或滚轮缩放；rotate：横拖旋转；
 * - 视口右上小控件提供按钮通道（放大/缩小/旋转 90°/重置，与拖拽/滚轮并列）；
 * - Esc 或“重置”复位视图；切换素材即复位（App 对查看器按素材重挂载语义一致）；
 * - 变换（translate/rotate/scale）施加在“变换舞台”上（共享 imageViewport 模块，
 *   与 CompareView 窗格同一实现）。
 */
import { useEffect, useRef, useState } from 'react'
import type { Asset } from '../../domain/types.ts'
import type { ViewerTool } from '../viewer/viewerTools.ts'
import {
  ImageViewportControls,
  imageViewportTransformCss,
  useImageViewportTransform,
} from '../viewer/imageViewport.tsx'

// 幽灵占位提示统一措辞（CR-006 T-004，与 AssetGrid/CompareView 一致）
const PREVIEW_UNAVAILABLE = '图片预览不可用：会话失效，可重新导入或删除该素材'
const LOAD_FAILED = '图片加载失败'

export interface ImageStageProps {
  asset: Asset
  /** 激活的视口工具（CR-009 T-003 / R-024；App 持有，顶栏工具组切换）。缺省平移 */
  activeTool?: ViewerTool
}

export default function ImageStage({ asset, activeTool = 'pan' }: ImageStageProps) {
  const [failed, setFailed] = useState(false)
  const objectUrl = asset.objectUrl
  /** 视口容器（滚轮缩放宿主 + 拖拽解释区） */
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewport = useImageViewportTransform(viewportRef, activeTool)
  // reset 为 useCallback([]) 稳定引用，可安全作为 effect 依赖
  const { reset } = viewport

  // objectUrl 变化（如重新导入后）时复位加载失败状态
  useEffect(() => {
    setFailed(false)
  }, [objectUrl])
  // 切换素材即复位视图（与 App 进入素材时工具复位为 pan 的语义一致）
  useEffect(() => {
    reset()
  }, [asset.id, reset])
  // Esc 复位视图（R-024 图片子集：Esc/重置；Esc 关闭查看器仅 DICOM/比较弹层语义）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') reset()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [reset])

  const imageReady = objectUrl !== undefined && !failed

  return (
    <figure className="image-stage" aria-label="图片预览">
      <div
        ref={viewportRef}
        className="image-stage__canvas"
        data-tool={activeTool}
        {...viewport.pointerHandlers}
      >
        {imageReady ? (
          <div
            className="image-viewport__stage"
            style={{ transform: imageViewportTransformCss(viewport.transform) }}
          >
            <img
              className="image-stage__img"
              src={objectUrl}
              alt={`素材“${asset.name}”的图片预览`}
              onError={() => setFailed(true)}
              draggable={false}
            />
          </div>
        ) : (
          <p className="image-stage__placeholder">
            {failed ? LOAD_FAILED : PREVIEW_UNAVAILABLE}
          </p>
        )}
        {imageReady ? <ImageViewportControls api={viewport} /> : null}
      </div>
      <figcaption className="image-stage__name" title={asset.name}>
        {asset.name}
      </figcaption>
    </figure>
  )
}
