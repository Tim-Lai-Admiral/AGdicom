/**
 * 素材并排比较视图（CR-001 T-004 / R-002；CR-009 T-003 / R-024 窗格独立变换；
 * CR-012 T-003 / R-029 DICOM 双系列比较；CR-012 T-004 / R-030 STL 双模型比较）。
 *
 * 应用内视图状态（非路由）：由上层在选中两张同类型素材时渲染于工作台中央查看区
 * （CR-003 T-002 布局壳 / T-004 归位）；按素材 kind 分派：
 * - image：双图等尺寸并排（等分栅格 + object-fit: contain），窗格独立视口变换
 *   （共享 imageViewport 模块，R-024 契约：比较视图隐藏顶栏工具组）；
 * - dicom：双系列双窗（R-029），每窗复用 DicomViewport（四角/工具/切片滑动条），
 *   切片索引共享（各系列按 InstanceNumber 排序后按 index 对齐，切片数不同按本系列
 *   长度钳制显示；滚轮/滑条任一侧驱动两侧）、pan/zoom/rotate 共享、W/L 每窗独立；
 * - model：双 three.js 渲染实例并排（R-030），相机旋转/平移/缩放两窗同步
 *   （共享 OrbitControls 目标 + 复制相机变换，见 modelViewSync）；组件按需加载
 *   （React.lazy，TD-002：three.js 不进首屏主包），加载/错误/降级每窗独立。
 * “退出比较”按钮与 Esc 键均可退出；降级（压缩/损坏/会话失效）单窗降级不互相影响。
 */
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { Asset, DicomMeta } from '../../domain/types.ts'
import {
  ImageViewportControls,
  imageViewportTransformCss,
  useImageViewportTransform,
} from '../viewer/imageViewport.tsx'
import DicomViewport, { IDENTITY_VIEWPORT } from '../viewer/dicom/DicomViewport.tsx'
import type { ViewportTransform } from '../viewer/dicom/DicomViewport.tsx'
import { AUTO_WINDOW_LEVEL } from '../viewer/dicom/windowLevel.ts'
import type { WindowLevelState } from '../viewer/dicom/windowLevel.ts'
import type { ViewerTool } from '../viewer/viewerTools.ts'

// TD-002：three.js 随模型比较拆为独立 chunk（React.lazy 按需加载，不进首屏主包）
const ModelComparePanes = lazy(() => import('../viewer/model3d/ModelComparePanes.tsx'))

// 幽灵占位提示统一措辞（CR-006 T-004，与 AssetGrid/ImageStage 一致）
const PREVIEW_UNAVAILABLE = '图片预览不可用：会话失效，可重新导入或删除该素材'
const LOAD_FAILED = '图片加载失败'

/** 单侧图片窗格：等分宽度 + 等高视口；名称置于图下；窗格独立视口变换 */
function ComparePane({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false)
  const objectUrl = asset.objectUrl
  /** 视口容器（滚轮缩放宿主 + 拖拽解释区；比较窗格无工具组，按 pan 解释拖拽） */
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewport = useImageViewportTransform(viewportRef, null)
  // reset 为 useCallback([]) 稳定引用，可安全作为 effect 依赖
  const { reset } = viewport

  // objectUrl 变化（如重新导入后）时复位加载失败状态
  useEffect(() => {
    setFailed(false)
  }, [objectUrl])
  // 切换素材即复位该窗格视图（两侧互不影响）
  useEffect(() => {
    reset()
  }, [asset.id, reset])

  const imageReady = objectUrl !== undefined && !failed

  return (
    <figure className="compare-pane">
      <div ref={viewportRef} className="compare-pane__viewport" {...viewport.pointerHandlers}>
        {imageReady ? (
          <div
            className="image-viewport__stage"
            style={{ transform: imageViewportTransformCss(viewport.transform) }}
          >
            <img
              className="compare-pane__img"
              src={objectUrl}
              alt={`素材“${asset.name}”的图片预览`}
              onError={() => setFailed(true)}
              draggable={false}
            />
          </div>
        ) : (
          <p className="compare-pane__placeholder">
            {failed ? LOAD_FAILED : PREVIEW_UNAVAILABLE}
          </p>
        )}
        {imageReady ? <ImageViewportControls api={viewport} /> : null}
      </div>
      <figcaption className="compare-pane__name" title={asset.name}>
        {asset.name}
      </figcaption>
    </figure>
  )
}

/**
 * DICOM 双窗（CR-012 T-003 / R-029）：共享切片索引（左/右滚轮或滑条任一侧变更 →
 * 共享索引更新，两窗按各自系列 InstanceNumber 序位对齐显示，越界按本系列长度钳制）、
 * 共享 pan/zoom/rotate 变换；W/L 每窗独立状态（默认 auto min-max，window 工具拖拽
 * 仅影响所在窗）。解析元数据经 onMetasParsed 上送 App 持久化（与单窗查看器一致）。
 */
function DicomComparePanes({
  left,
  right,
  dicomAssets,
  activeTool,
  onMetasParsed,
}: {
  left: Asset
  right: Asset
  dicomAssets: readonly Asset[]
  activeTool: ViewerTool
  onMetasParsed?: (metas: Record<string, DicomMeta>) => void
}) {
  /** 共享切片索引（0-based，各窗按本系列有序切片对齐 + 钳制） */
  const [sliceIndex, setSliceIndex] = useState(0)
  /** 共享视口变换（pan/zoom/rotate；任一侧拖拽/Ctrl+滚轮驱动两窗） */
  const [transform, setTransform] = useState<ViewportTransform>(IDENTITY_VIEWPORT)
  /** 每窗独立 W/L（R-029 默认独立；进入比较即复位为自动 min-max） */
  const [leftWindowLevel, setLeftWindowLevel] = useState<WindowLevelState>(AUTO_WINDOW_LEVEL)
  const [rightWindowLevel, setRightWindowLevel] = useState<WindowLevelState>(AUTO_WINDOW_LEVEL)

  return (
    <div className="compare__panes">
      <figure className="compare-pane compare-pane--dicom" key={left.id}>
        <DicomViewport
          asset={left}
          dicomAssets={dicomAssets}
          onMetasParsed={onMetasParsed}
          activeTool={activeTool}
          windowLevel={leftWindowLevel}
          onWindowLevelChange={setLeftWindowLevel}
          sliceIndex={sliceIndex}
          onSliceIndexChange={setSliceIndex}
          viewportTransform={transform}
          onViewportTransformChange={setTransform}
          paneLabel="左侧"
        />
        <figcaption className="compare-pane__name" title={left.name}>
          {left.name}
        </figcaption>
      </figure>
      <figure className="compare-pane compare-pane--dicom" key={right.id}>
        <DicomViewport
          asset={right}
          dicomAssets={dicomAssets}
          onMetasParsed={onMetasParsed}
          activeTool={activeTool}
          windowLevel={rightWindowLevel}
          onWindowLevelChange={setRightWindowLevel}
          sliceIndex={sliceIndex}
          onSliceIndexChange={setSliceIndex}
          viewportTransform={transform}
          onViewportTransformChange={setTransform}
          paneLabel="右侧"
        />
        <figcaption className="compare-pane__name" title={right.name}>
          {right.name}
        </figcaption>
      </figure>
    </div>
  )
}

export interface CompareViewProps {
  /** 左侧素材（先选中的；与 right 同类型，由 App 的选择约束保证） */
  left: Asset
  /** 右侧素材（后选中的） */
  right: Asset
  /** 退出比较（“退出比较”按钮与 Esc 键均触发） */
  onExit: () => void
  /** 素材库中全部 DICOM 素材（dicom 比较双窗按 series 聚合切片；image 比较可缺省） */
  dicomAssets?: readonly Asset[]
  /** DICOM 解析元数据回写（dicom 比较双窗经此持久化；image 比较可缺省） */
  onMetasParsed?: (metas: Record<string, DicomMeta>) => void
  /** 激活的视口工具（R-024；App 在 dicom 比较时显示顶栏工具组并下发。缺省平移） */
  activeTool?: ViewerTool
}

export default function CompareView({
  left,
  right,
  onExit,
  dicomAssets = [],
  onMetasParsed,
  activeTool = 'pan',
}: CompareViewProps) {
  const exitButtonRef = useRef<HTMLButtonElement>(null)
  // 按选中素材类型分派（App 保证两张同类型）
  const dicomCompare = left.kind === 'dicom' && right.kind === 'dicom'
  const modelCompare = left.kind === 'model' && right.kind === 'model'
  const title = dicomCompare ? 'DICOM 比较' : modelCompare ? '模型比较' : '图片比较'
  const hint = dicomCompare
    ? '双系列并排显示：切片与视图变换两窗同步（W/L 每窗独立），按 Esc 也可退出'
    : modelCompare
      ? '双模型并排显示：旋转/平移/缩放两窗同步，按 Esc 也可退出'
      : '两张图片等尺寸并排显示，按 Esc 也可退出'

  useEffect(() => {
    // 弹层打开后聚焦退出按钮（键盘用户可直达），并监听 Esc 关闭
    exitButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onExit])

  return (
    <div className="compare-overlay">
      <section className="compare" role="dialog" aria-label={title}>
        <header className="compare__header">
          <h2 className="compare__title">{title}</h2>
          <p className="compare__esc-hint">{hint}</p>
          <button type="button" ref={exitButtonRef} className="compare__exit" onClick={onExit}>
            退出比较
          </button>
        </header>
        {dicomCompare ? (
          <DicomComparePanes
            left={left}
            right={right}
            dicomAssets={dicomAssets}
            activeTool={activeTool}
            onMetasParsed={onMetasParsed}
          />
        ) : modelCompare ? (
          <Suspense
            fallback={
              <div className="compare__panes" role="status">
                <p className="compare-pane__placeholder">正在加载模型比较…</p>
              </div>
            }
          >
            <ModelComparePanes left={left} right={right} />
          </Suspense>
        ) : (
          <div className="compare__panes">
            <ComparePane asset={left} />
            <ComparePane asset={right} />
          </div>
        )}
      </section>
    </div>
  )
}
