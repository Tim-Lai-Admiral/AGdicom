/**
 * DICOM 视口（CR-012 T-003 / R-029 自 DicomViewer 抽出，供单窗查看器与比较双窗复用）：
 * Canvas 灰度预览（自动 min-max 或显式窗宽窗位）+ 四角元数据覆盖层（R-023）+
 * 切片选择器（多文件 series 按 InstanceNumber 排序，滚轮/滑条双向同步 R-025）+
 * 视口工具（pan/zoom/window/rotate/measure 拖拽，R-024）+ 解析/预览降级链路。
 * 弹层职责（标题栏/关闭/Esc/焦点圈定）留在 DicomViewer；本组件不含任何弹层语义。
 *
 * 同步契约（CR-012 T-003 / R-029，比较模式）：
 * - 受控切片：传入 `sliceIndex`（0-based，按本 series 有序切片对齐，越界按本系列
 *   长度钳制显示）+ `onSliceIndexChange`（本窗滚轮/滑条变更时上报索引，由上层写入
 *   共享状态驱动两窗）→ 双窗切片同步；
 * - 受控变换：传入 `viewportTransform` + `onViewportTransformChange` → pan/zoom/rotate
 *   （拖拽与 Ctrl+滚轮）上层共享，两窗同步；
 * - 缺省（单窗）：内部自持，与既有 DicomViewer 行为完全一致；
 * - W/L（windowLevel/onWindowLevelChange）不做共享抽象：上层给每窗传独立状态即得
 *   “W/L 独立”（R-029 默认），给同一状态即得同步。
 *
 * 四角降级口径、数据流（R-018/R-019 聚合与解析范围）、降级路径与单窗查看器一致，
 * 详见原 DicomViewer 头注释（此处不再重复）。
 */
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { DataSet } from 'dicom-parser'
import type { Asset, DicomMeta } from '../../../domain/types.ts'
import { DicomParseError, parseDicomFile } from './parseDicom.ts'
import { decodeDicomFrame } from './decodePixel.ts'
import { AUTO_WINDOW_LEVEL } from './windowLevel.ts'
import type { WindowLevelState } from './windowLevel.ts'
import { clientToImagePoint, formatMeasureLength, measureLength } from './measure.ts'
import type { MeasureLength, MeasurePoint } from './measure.ts'
import { transferSyntaxLabel } from './metaLabels.ts'
import { findDicomPatientSeriesGroup, sliceCountByAsset } from './seriesUtils.ts'
import type { DicomSeriesEntry } from './seriesUtils.ts'
import type { ViewerTool } from '../viewerTools.ts'

/** 读取素材的字节（会话级 objectUrl → fetch；预览与解析共用） */
async function loadDicomAssetBytes(objectUrl: string): Promise<ArrayBuffer> {
  if (typeof fetch !== 'function') {
    throw new Error('当前环境不支持读取文件内容（fetch 不可用）')
  }
  const response = await fetch(objectUrl)
  if (!response.ok) throw new Error(`读取文件内容失败（HTTP ${response.status}）`)
  return await response.arrayBuffer()
}

/** 每个文件解析之间让出一轮事件循环，避免大 series 连续解析阻塞界面 */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/** 解析/读取失败的可读信息（DicomParseError 已带“无法解析”前缀，其余补齐） */
function parseIssueMessage(error: unknown): string {
  if (error instanceof DicomParseError) return error.message
  if (error instanceof Error && error.message !== '') {
    return `无法解析该 DICOM 文件：${error.message}`
  }
  return `无法解析该 DICOM 文件：${String(error)}`
}

/** 单条已完成测量：端点（图像像素坐标）+ 落笔时按当时 PixelSpacing 算得的长度 */
interface MeasureEntry {
  id: number
  a: MeasurePoint
  b: MeasurePoint
  length: MeasureLength
}

/** SeriesInstanceUID 截断展示口径（R-023 右上角；> 20 字符截断加省略号，全文经 title 悬停查看） */
const SERIES_UID_MAX_LENGTH = 20

function truncateSeriesUid(uid: string | undefined): string | undefined {
  if (uid === undefined) return undefined
  return uid.length > SERIES_UID_MAX_LENGTH
    ? `${uid.slice(0, SERIES_UID_MAX_LENGTH)}…`
    : uid
}

// ---- 视口工具交互常量（CR-009 T-002 / R-024；拖拽手感与滚轮缩放步长）----
/** 缩放下限（相对原图，20%） */
export const VIEWPORT_ZOOM_MIN = 0.2
/** 缩放上限（8 倍） */
export const VIEWPORT_ZOOM_MAX = 8
/** Ctrl/Cmd+滚轮单档缩放系数（上滚放大、下滚缩小） */
const VIEWPORT_ZOOM_WHEEL_FACTOR = 1.1
/** 缩放拖拽灵敏度：每像素 0.01 倍（向上拖放大） */
const VIEWPORT_ZOOM_DRAG_STEP = 0.01
/** 旋转拖拽灵敏度：每像素 0.5°（向右拖顺时针） */
const VIEWPORT_ROTATE_DRAG_STEP = 0.5

/** 视口变换状态（R-024）：平移 offset / 缩放 zoom / 旋转 rotateDeg（度） */
export interface ViewportTransform {
  zoom: number
  rotateDeg: number
  offsetX: number
  offsetY: number
}

/** 视口变换恒等态（比较模式共享状态的初始值） */
export const IDENTITY_VIEWPORT: ViewportTransform = {
  zoom: 1,
  rotateDeg: 0,
  offsetX: 0,
  offsetY: 0,
}

/** 缩放钳制（拖拽/滚轮共用；不溢出上下限） */
function clampViewportZoom(zoom: number): number {
  return Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, zoom))
}

/**
 * 进行中的拖拽会话（pointerdown 建立、pointerup 结束；经 ref 存放，move 高频更新
 * 不经 state 触发额外渲染）。各工具捕获拖拽起点与基准值，move 时按灵敏度增量更新。
 */
type ViewportDrag =
  | { kind: 'measure' }
  | { kind: 'pan'; startClientX: number; startClientY: number; baseX: number; baseY: number }
  | { kind: 'zoom'; startClientY: number; baseZoom: number }
  | { kind: 'rotate'; startClientX: number; baseDeg: number }
  | {
      kind: 'window'
      startClientX: number
      startClientY: number
      baseWc: number
      baseWw: number
    }

export interface DicomViewportProps {
  /** 本窗展示的 DICOM 素材（所属 series 的锚点；初始选中它） */
  asset: Asset
  /** 素材库中全部 DICOM 素材（用于按 series 聚合统计切片数与切换切片） */
  dicomAssets: readonly Asset[]
  /** 本会话解析得到元数据后批量回写（持久化由上层完成；比较双窗共享 App 回写） */
  onMetasParsed?: (metas: Record<string, DicomMeta>) => void
  /** 激活的视口工具（R-024；上层下发）。缺省平移 */
  activeTool?: ViewerTool
  /** 窗宽窗位（R-003 修改）；缺省自动 min-max。上层每窗传独立状态即 W/L 独立 */
  windowLevel?: WindowLevelState
  /** 窗宽窗位变更上报（window 工具拖拽；CR-003 契约）。缺省不调窗 */
  onWindowLevelChange?: (wl: WindowLevelState) => void
  /** 当前切片变化上报（CR-008 T-002 / R-022；单窗模式供 App 更新左栏高亮） */
  onSelectedSliceChange?: (assetId: string) => void
  /**
   * 受控切片索引（CR-012 T-003 / R-029 比较 shared state）：0-based，按本 series
   * 有序切片（InstanceNumber 升序）取切片，越界按本系列长度钳制显示。
   * 提供后本窗滚轮/滑条变更经 onSliceIndexChange 上报索引（不再内部改选）；
   * 须与 onSliceIndexChange 成对提供。缺省内部自持（单窗语义）
   */
  sliceIndex?: number
  /** 受控切片索引变更上报（本窗滚轮/滑条驱动；上层写共享索引实现双窗同步） */
  onSliceIndexChange?: (index: number) => void
  /**
   * 受控视口变换（比较 shared state）：pan/zoom/rotate 拖拽与 Ctrl+滚轮经
   * onViewportTransformChange 上报，由上层写入共享状态驱动两窗同步。
   * 须与 onViewportTransformChange 成对提供。缺省内部自持
   */
  viewportTransform?: ViewportTransform
  /** 受控视口变换变更上报（上层写共享变换实现双窗同步） */
  onViewportTransformChange?: (transform: ViewportTransform) => void
  /** 窗格限定标签（比较双窗区分左/右的可访问名后缀，如“左侧”）；缺省无后缀（单窗） */
  paneLabel?: string
}

export default function DicomViewport({
  asset,
  dicomAssets,
  onMetasParsed,
  activeTool = 'pan',
  windowLevel = AUTO_WINDOW_LEVEL,
  onWindowLevelChange,
  onSelectedSliceChange,
  sliceIndex,
  onSliceIndexChange,
  viewportTransform,
  onViewportTransformChange,
  paneLabel,
}: DicomViewportProps) {
  /** 切片受控（比较共享）模式：提供 sliceIndex 即启用（onSliceIndexChange 成对契约） */
  const sliceControlled = sliceIndex !== undefined
  /** 变换受控（比较共享）模式：提供 viewportTransform 即启用 */
  const transformControlled = viewportTransform !== undefined
  /** 可访问名后缀（比较双窗区分左右；单窗为空串） */
  const labelSuffix = paneLabel !== undefined ? `（${paneLabel}）` : ''

  /** 本会话（本次挂载）解析出的元数据，优先于持久化记录 */
  const [sessionMetas, setSessionMetas] = useState<Record<string, DicomMeta>>({})
  /** 解析失败的素材 → 可读错误信息 */
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({})
  /** 仅抢救出部分元数据的素材（截断文件） */
  const [sessionPartials, setSessionPartials] = useState<Record<string, true>>({})
  /** 批量解析进度；null = 空闲（无待解析文件或已完成） */
  const [parseProgress, setParseProgress] = useState<{ done: number; total: number } | null>(null)
  /** 当前选中的切片（素材 ID）；初始为本窗锚点素材（非受控模式内部自持） */
  const [innerSelectedId, setInnerSelectedId] = useState(asset.id)
  /** 非受控视口变换（CR-009 T-002 / R-024）；受控模式由 props 提供 */
  const [innerViewport, setInnerViewport] = useState<ViewportTransform>(IDENTITY_VIEWPORT)
  /** 预览区文案；null 且 previewRendered=false 之外的组合见渲染逻辑 */
  const [previewMessage, setPreviewMessage] = useState<string | null>(null)
  const [previewPending, setPreviewPending] = useState(false)
  const [previewRendered, setPreviewRendered] = useState(false)
  /** 当前预览帧尺寸（测量覆盖层 SVG viewBox 用） */
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)
  /** 测量工具是否激活（R-024：activeTool 下发；仅 DICOM） */
  const measureMode = activeTool === 'measure'
  /** 已完成的测量线；切换素材/切片即清空，不持久化（R-010） */
  const [measures, setMeasures] = useState<MeasureEntry[]>([])
  /** 拖拽中的草稿测量线；null = 未在拖拽 */
  const [draftMeasure, setDraftMeasure] = useState<{ a: MeasurePoint; b: MeasurePoint } | null>(null)
  /** 进行中的工具拖拽会话（pan/zoom/rotate/window/measure；见 ViewportDrag） */
  const dragRef = useRef<ViewportDrag | null>(null)

  const datasetsRef = useRef(new Map<string, DataSet>())
  /** sessionMetas 的同步镜像：解析 effect 的聚合步骤需读取此前批次已解析出的元数据 */
  const sessionMetasRef = useRef<Record<string, DicomMeta>>({})
  const completedIdsRef = useRef(new Set<string>())
  const nextMeasureIdRef = useRef(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** 视口容器（四角覆盖层 + 滚轮切片宿主；R-025 原生 wheel 监听挂载点） */
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const onMetasParsedRef = useRef(onMetasParsed)
  useEffect(() => {
    onMetasParsedRef.current = onMetasParsed
  }, [onMetasParsed])

  // ---- 视口变换（受控/非受控统一出口）：当前值 = 受控 props ?? 内部 state；
  // 变更经 applyViewport 分发（受控 → 上层共享状态；非受控 → 内部 state）。
  // viewportStateRef/applyViewportRef 供挂载一次的原生 wheel 监听读取最新值。----
  const viewport = transformControlled ? (viewportTransform as ViewportTransform) : innerViewport
  const viewportStateRef = useRef(viewport)
  const onViewportTransformChangeRef = useRef(onViewportTransformChange)
  useEffect(() => {
    viewportStateRef.current = viewport
    onViewportTransformChangeRef.current = onViewportTransformChange
  })
  const applyViewport = (next: ViewportTransform): void => {
    if (transformControlled) onViewportTransformChangeRef.current?.(next)
    else setInnerViewport(next)
  }
  const applyViewportRef = useRef(applyViewport)
  useEffect(() => {
    applyViewportRef.current = applyViewport
  })

  // ---- 当前切片变化上报（CR-008 T-002 / R-022）：selectedAssetId 变化（含初始选择、
  // 滑动条切换等任意路径）即回调 onSelectedSliceChange；经 ref 读取最新回调（避免因
  // 回调身份变化重复触发）并以 reportedSliceIdRef 去重（同一素材 ID 不重复回调）----
  const onSelectedSliceChangeRef = useRef(onSelectedSliceChange)
  useEffect(() => {
    onSelectedSliceChangeRef.current = onSelectedSliceChange
  }, [onSelectedSliceChange])
  const reportedSliceIdRef = useRef<string | null>(null)

  // ---- 派生：已知元数据 / series 分组 / 当前切片 / 解析范围（R-018 / R-019）----
  // 已知元数据：本会话解析结果优先于持久化记录；患者分组语义下的 series 分组
  // （同患者内缺 UID 文件聚合为单个“未知系列”）同时决定切片切换与解析范围。
  const assetById = new Map<string, Asset>()
  for (const a of dicomAssets) assetById.set(a.id, a)
  const knownEntries: DicomSeriesEntry[] = []
  const knownMetaIds = new Set<string>()
  for (const a of dicomAssets) {
    const meta = sessionMetas[a.id] ?? a.dicomMeta
    if (meta !== undefined) {
      knownMetaIds.add(a.id)
      knownEntries.push({ assetId: a.id, meta, fileName: a.file.fileName })
    }
  }
  const currentGroup = findDicomPatientSeriesGroup(knownEntries, asset.id)
  const orderedSlices = currentGroup?.slices ?? []

  // 当前切片素材 ID：受控模式按共享索引在本系列有序切片中取（越界钳制到末片），
  // 系列未解析出分组时回退锚点素材；非受控模式为内部自持 ID（与既有行为一致）。
  const sharedIndex =
    sliceControlled && orderedSlices.length > 0
      ? Math.min(Math.max(sliceIndex as number, 0), orderedSlices.length - 1)
      : null
  const selectedAssetId = sliceControlled
    ? sharedIndex !== null
      ? (orderedSlices[sharedIndex] as { assetId: string }).assetId
      : asset.id
    : innerSelectedId
  const selectedAsset = assetById.get(selectedAssetId) ?? asset
  const selectedMeta = sessionMetas[selectedAsset.id] ?? selectedAsset.dicomMeta
  const selectedSliceIndex = Math.max(
    0,
    orderedSlices.findIndex((slice) => slice.assetId === selectedAssetId),
  )

  // ---- 切片选择统一出口：非受控改内部 ID；受控上报共享索引（由上层驱动两窗）----
  const onSliceIndexChangeRef = useRef(onSliceIndexChange)
  useEffect(() => {
    onSliceIndexChangeRef.current = onSliceIndexChange
  }, [onSliceIndexChange])
  const selectSliceByIndex = (index: number): void => {
    const slice = orderedSlices[index]
    if (slice === undefined) return
    if (sliceControlled) onSliceIndexChangeRef.current?.(index)
    else setInnerSelectedId(slice.assetId)
  }

  // ---- 四角覆盖层派生文案（R-023；缺失字段按文件头注释口径如实降级，不造数）----
  const cornerSeriesUid = truncateSeriesUid(selectedMeta?.seriesInstanceUID)
  // Inst #：优先 DICOM InstanceNumber（缺失回退视口序位）；M = 所属 series 切片数
  const cornerInstanceNumber = selectedMeta?.instanceNumber ?? selectedSliceIndex + 1
  const cornerSliceTotal =
    orderedSlices.length > 0 ? orderedSlices.length : (selectedMeta?.sliceCount ?? 1)

  // 解析范围（R-018）：所属 series 的文件集合（含聚合后的“未知系列”）∪ 尚无元数据、
  // 无法归类的文件——后者可能属于当前 series，保持“打开即解析”的既有行为，解析出
  // 元数据后即纳入分组；已归入其他 series 的文件不会被解析，跨 series 互不污染。
  const seriesAssetIds = new Set<string>([asset.id])
  if (currentGroup !== undefined) {
    for (const slice of currentGroup.slices) seriesAssetIds.add(slice.assetId)
  }
  const parseScopeIds: string[] = []
  for (const a of dicomAssets) {
    if (seriesAssetIds.has(a.id) || !knownMetaIds.has(a.id)) parseScopeIds.push(a.id)
  }
  // parseKey（范围内素材 ID + objectUrl）变化时重新入队；解析完成的素材记入
  // completedIdsRef 去重（引导解析完成后范围收敛，不重复解析）。
  const parseKey = parseScopeIds
    .map((id) => `${id}:${assetById.get(id)?.objectUrl ?? ''}`)
    .join('|')

  // ---- 批量解析：解析范围内含会话 objectUrl 且未解析过的 DICOM 素材 ----
  useEffect(() => {
    let cancelled = false
    const scopeIds = new Set(parseScopeIds)
    const queue = dicomAssets.filter(
      (a) => scopeIds.has(a.id) && a.objectUrl !== undefined && !completedIdsRef.current.has(a.id),
    )
    if (queue.length === 0) {
      setParseProgress(null)
      return
    }
    setParseProgress({ done: 0, total: queue.length })
    void (async () => {
      const metas: Record<string, DicomMeta> = {}
      const errors: Record<string, string> = {}
      const partials: Record<string, true> = {}
      let done = 0
      for (const target of queue) {
        if (cancelled) return
        await yieldToUi()
        if (cancelled) return
        try {
          const buffer = await loadDicomAssetBytes(target.objectUrl as string)
          if (cancelled) return
          const parsed = parseDicomFile(buffer)
          metas[target.id] = parsed.meta
          if (parsed.partial) partials[target.id] = true
          datasetsRef.current.set(target.id, parsed.dataset)
        } catch (error) {
          errors[target.id] = parseIssueMessage(error)
        }
        completedIdsRef.current.add(target.id)
        done += 1
        if (cancelled) return
        setParseProgress({ done, total: queue.length })
      }
      // 全部完成：按最终已知元数据（本批次 ∪ 此前批次 ∪ 持久化）做患者分组聚合
      // （R-019：同患者缺 UID 文件聚合为“未知系列”），为本批次解析出的素材回写
      // 所属 series 的切片数（R-018：回写口径收敛到所属 series 的分组统计）。
      const entries: DicomSeriesEntry[] = []
      for (const a of dicomAssets) {
        const meta = metas[a.id] ?? sessionMetasRef.current[a.id] ?? a.dicomMeta
        if (meta !== undefined) entries.push({ assetId: a.id, meta, fileName: a.file.fileName })
      }
      const counts = sliceCountByAsset(entries)
      const updates: Record<string, DicomMeta> = {}
      for (const [id, meta] of Object.entries(metas)) {
        updates[id] = { ...meta, sliceCount: counts[id] ?? meta.sliceCount }
      }
      sessionMetasRef.current = { ...sessionMetasRef.current, ...updates }
      setSessionMetas((prev) => ({ ...prev, ...updates }))
      if (Object.keys(errors).length > 0) setSessionErrors((prev) => ({ ...prev, ...errors }))
      if (Object.keys(partials).length > 0) {
        setSessionPartials((prev) => ({ ...prev, ...partials }))
      }
      setParseProgress(null)
      if (Object.keys(updates).length > 0) onMetasParsedRef.current?.(updates)
    })()
    return () => {
      cancelled = true
    }
    // oxlint 不启用 exhaustive-deps：parseKey 已编码范围集合，asset 随 key 重挂载稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseKey])

  // ---- 当前切片变化上报（去重；受控/非受控共用 selectedAssetId 派生值）----
  useEffect(() => {
    if (onSelectedSliceChangeRef.current === undefined) return
    if (reportedSliceIdRef.current === selectedAssetId) return
    reportedSliceIdRef.current = selectedAssetId
    onSelectedSliceChangeRef.current(selectedAssetId)
  }, [selectedAssetId])

  // ---- 预览：解码所选切片并绘制到 Canvas（失败/不支持 → 降级文案） ----
  useEffect(() => {
    let cancelled = false
    setPreviewRendered(false)
    setPreviewMessage(null)
    setPreviewPending(false)
    setPreviewSize(null)
    const target = selectedAsset
    const targetMeta = sessionMetas[target.id] ?? target.dicomMeta

    if (target.objectUrl === undefined) {
      // 刷新后（objectUrl 为会话字段）：元数据可来自持久化记录，预览不可用
      setPreviewMessage(
        targetMeta !== undefined
          ? '切片预览不可用：会话失效，可重新导入或删除该素材'
          : '元数据与切片预览不可用：会话失效，可重新导入或删除该素材',
      )
      return
    }
    const parseError = sessionErrors[target.id]
    if (parseError !== undefined) {
      setPreviewMessage(parseError)
      return
    }
    const dataset = datasetsRef.current.get(target.id)
    if (dataset === undefined) {
      if (target.objectUrl !== undefined && !completedIdsRef.current.has(target.id)) {
        // 该文件已入队但尚未解析完成
        setPreviewPending(true)
        setPreviewMessage('正在解析所选切片…')
      } else {
        setPreviewMessage('该切片暂无像素数据可预览（未在本会话解析）')
      }
      return
    }
    try {
      // 显式 WC/WW（手动）或自动 min-max（缺省，与既有行为等价，R-003 修改）
      const image = windowLevel.auto
        ? decodeDicomFrame(dataset)
        : decodeDicomFrame(dataset, 0, { wc: windowLevel.wc, ww: windowLevel.ww })
      if (cancelled) return
      const canvas = canvasRef.current
      const ctx = canvas !== null ? canvas.getContext('2d') : null
      if (canvas === null || ctx === null) {
        setPreviewMessage('当前环境不支持 Canvas 预览显示（像素已解码，无法绘制）')
        return
      }
      canvas.width = image.width
      canvas.height = image.height
      ctx.putImageData(image, 0, 0)
      setPreviewSize({ width: image.width, height: image.height })
      setPreviewRendered(true)
    } catch (error) {
      if (cancelled) return
      setPreviewMessage(error instanceof Error ? error.message : `切片预览失败（${String(error)})`)
    }
    return () => {
      cancelled = true
    }
  }, [selectedAssetId, selectedAsset, sessionMetas, sessionErrors, parseProgress, windowLevel])

  // ---- 测量清空语义（R-010）：切换切片即清空测量（素材切换由上层以 key 重挂载达成）----
  useEffect(() => {
    setMeasures([])
    setDraftMeasure(null)
  }, [selectedAssetId])

  // ---- 视口工具指针交互（CR-009 T-002 / R-024）：统一 pointerdown/move/up 通路，
  // 按激活工具解释拖拽（pan/zoom/window/rotate 平移/缩放/调窗/旋转；measure 沿用
  // 既有 R-010 测量逻辑）。拖拽会话经 dragRef 传递，move 高频更新不经 state。----
  const canvasPointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): MeasurePoint | null => {
    const canvas = canvasRef.current
    if (canvas === null) return null
    return clientToImagePoint(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      canvas.width,
      canvas.height,
    )
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!previewRendered || event.button !== 0) return
    const capture = (): void => {
      try {
        canvasRef.current?.setPointerCapture(event.pointerId)
      } catch {
        // jsdom 等环境不支持 pointer capture：不影响拖拽主流程
      }
    }
    if (activeTool === 'measure') {
      const point = canvasPointFromEvent(event)
      if (point === null) return
      setDraftMeasure({ a: point, b: point })
      dragRef.current = { kind: 'measure' }
      capture()
      return
    }
    if (activeTool === 'pan') {
      dragRef.current = {
        kind: 'pan',
        startClientX: event.clientX,
        startClientY: event.clientY,
        baseX: viewport.offsetX,
        baseY: viewport.offsetY,
      }
      capture()
      return
    }
    if (activeTool === 'zoom') {
      dragRef.current = { kind: 'zoom', startClientY: event.clientY, baseZoom: viewport.zoom }
      capture()
      return
    }
    if (activeTool === 'rotate') {
      dragRef.current = { kind: 'rotate', startClientX: event.clientX, baseDeg: viewport.rotateDeg }
      capture()
      return
    }
    if (activeTool === 'window' && onWindowLevelChange !== undefined) {
      // 调窗基准取当前状态值（auto 时即四角展示的 40/400 口径）：首拖即转手动
      dragRef.current = {
        kind: 'window',
        startClientX: event.clientX,
        startClientY: event.clientY,
        baseWc: windowLevel.wc,
        baseWw: windowLevel.ww,
      }
      capture()
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    if (drag.kind === 'measure') {
      if (draftMeasure === null) return
      const point = canvasPointFromEvent(event)
      if (point === null) return
      setDraftMeasure({ a: draftMeasure.a, b: point })
      return
    }
    if (drag.kind === 'pan') {
      const offsetX = drag.baseX + (event.clientX - drag.startClientX)
      const offsetY = drag.baseY + (event.clientY - drag.startClientY)
      applyViewport({ ...viewport, offsetX, offsetY })
      return
    }
    if (drag.kind === 'zoom') {
      // 向上拖放大（startY - y > 0）
      const zoom = clampViewportZoom(drag.baseZoom + (drag.startClientY - event.clientY) * VIEWPORT_ZOOM_DRAG_STEP)
      applyViewport({ ...viewport, zoom })
      return
    }
    if (drag.kind === 'rotate') {
      const rotateDeg = drag.baseDeg + (event.clientX - drag.startClientX) * VIEWPORT_ROTATE_DRAG_STEP
      applyViewport({ ...viewport, rotateDeg })
      return
    }
    // window：横拖 → 窗宽（右增），竖拖 → 窗位（上增）；auto 状态首拖即转手动
    const ww = Math.max(1, drag.baseWw + (event.clientX - drag.startClientX))
    const wc = drag.baseWc - (event.clientY - drag.startClientY)
    onWindowLevelChange?.({ auto: false, wc, ww })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    dragRef.current = null
    if (drag.kind !== 'measure') return // pan/zoom/rotate/window：变换已随 move 落定
    // ---- 测量落笔（R-010 既有逻辑沿用）----
    if (draftMeasure === null) return
    const start = draftMeasure.a
    const point = canvasPointFromEvent(event) ?? draftMeasure.b
    setDraftMeasure(null)
    if (point.x === start.x && point.y === start.y) return // 单击（零长度）不算测量
    // 距离口径见 measure.ts：PixelSpacing 可用 → 确定性 mm；否则 Mock（图像像素）
    setMeasures((prev) => [
      ...prev,
      {
        id: nextMeasureIdRef.current++,
        a: start,
        b: point,
        length: measureLength(start, point, selectedMeta?.pixelSpacing),
      },
    ])
  }

  // ---- 视口滚轮切片与缩放（CR-009 T-001/R-025、T-002/R-024；R-029 比较同步）----
  // 原生 wheel 监听挂载在视口容器（passive:false 才能 preventDefault，拦截页面滚动与
  // 浏览器缩放手势）：非 Ctrl/Cmd → 切片 ±1（按本系列边界钳制），经 selectSliceByIndex
  // 分发（非受控改内部选中；受控上报共享索引驱动两窗）；Ctrl/Cmd + 滚轮 → 缩放
  // （R-024，与切片切换不冲突，R-025），经 applyViewport 分发（受控即两窗同步）。
  // 当前切片与有序切片经 ref 读取（监听器仅随容器挂载一次，避免闭包过期值）。
  const orderedSlicesRef = useRef(orderedSlices)
  const selectedAssetIdRef = useRef(selectedAssetId)
  useEffect(() => {
    orderedSlicesRef.current = orderedSlices
    selectedAssetIdRef.current = selectedAssetId
  })
  useEffect(() => {
    const wrap = canvasWrapRef.current
    if (wrap === null) return
    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd + 滚轮 → 缩放（R-024；不与切片切换冲突，R-025）
        const factor =
          event.deltaY < 0 ? VIEWPORT_ZOOM_WHEEL_FACTOR : 1 / VIEWPORT_ZOOM_WHEEL_FACTOR
        const current = viewportStateRef.current
        applyViewportRef.current({ ...current, zoom: clampViewportZoom(current.zoom * factor) })
        return
      }
      if (event.deltaY === 0) return // 横向滚动不切切片
      const slices = orderedSlicesRef.current
      if (slices.length === 0) return
      const currentId = selectedAssetIdRef.current
      const currentIndex = slices.findIndex((slice) => slice.assetId === currentId)
      const base = currentIndex < 0 ? 0 : currentIndex
      const nextIndex =
        event.deltaY > 0 ? Math.min(slices.length - 1, base + 1) : Math.max(0, base - 1)
      const next = slices[nextIndex]
      if (next === undefined || next.assetId === currentId) return // 边界钳制：无变化
      if (sliceControlled) onSliceIndexChangeRef.current?.(nextIndex)
      else setInnerSelectedId(next.assetId)
    }
    wrap.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      wrap.removeEventListener('wheel', handleWheel)
    }
    // 受控/非受控模式切换随重渲染由 ref 通路覆盖；监听器仅挂载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const failedCount = Object.keys(sessionErrors).length
  // 测量覆盖层视觉尺寸随图像分辨率缩放（端点半径/字号在 viewBox 坐标系内取值）
  const measureImageSpan = Math.max(previewSize?.width ?? 0, previewSize?.height ?? 0)
  const measureEndpointRadius = Math.max(2, Math.round(measureImageSpan / 150))
  const measureLabelFontSize = Math.max(11, Math.min(24, Math.round(measureImageSpan / 32)))
  const measureLabelOffset = measureLabelFontSize * 0.7

  return (
    <>
      {parseProgress !== null ? (
        <p className="dicom-viewer__status" role="status">
          {`正在解析 DICOM 文件（${parseProgress.done}/${parseProgress.total}）…`}
        </p>
      ) : failedCount > 0 ? (
        <p className="dicom-viewer__status dicom-viewer__status--warning" role="status">
          {`${failedCount} 个文件无法解析，已按可用内容降级展示`}
        </p>
      ) : null}
      <div ref={canvasWrapRef} className="dicom-viewer__canvas-wrap" data-tool={activeTool}>
        {/* 变换舞台（CR-009 T-002 / R-024）：pan/zoom/rotate 经 CSS transform 施加，
            画布与测量覆盖层同组变换；四角覆盖层/方向标记不随动（viewport 级固定） */}
        <div
          className="dicom-viewer__stage"
          style={{
            transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) rotate(${viewport.rotateDeg}deg) scale(${viewport.zoom})`,
          }}
        >
          <canvas
            ref={canvasRef}
            className={
              previewRendered
                ? measureMode
                  ? 'dicom-viewer__canvas is-measuring'
                  : 'dicom-viewer__canvas'
                : 'dicom-viewer__canvas is-hidden'
            }
            aria-label={`所选切片的灰度预览${labelSuffix}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          {previewRendered && previewSize !== null && (measures.length > 0 || draftMeasure !== null) ? (
            <svg
              className="dicom-viewer__measure-overlay"
              viewBox={`0 0 ${previewSize.width} ${previewSize.height}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              {measures.map((measure) => (
                <g key={measure.id}>
                  <line
                    className="dicom-viewer__measure-line"
                    x1={measure.a.x}
                    y1={measure.a.y}
                    x2={measure.b.x}
                    y2={measure.b.y}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    className="dicom-viewer__measure-endpoint"
                    cx={measure.a.x}
                    cy={measure.a.y}
                    r={measureEndpointRadius}
                  />
                  <circle
                    className="dicom-viewer__measure-endpoint"
                    cx={measure.b.x}
                    cy={measure.b.y}
                    r={measureEndpointRadius}
                  />
                  <text
                    className="dicom-viewer__measure-label"
                    x={(measure.a.x + measure.b.x) / 2}
                    y={(measure.a.y + measure.b.y) / 2 - measureLabelOffset}
                    textAnchor="middle"
                    fontSize={measureLabelFontSize}
                  >
                    {formatMeasureLength(measure.length)}
                  </text>
                </g>
              ))}
              {draftMeasure !== null ? (
                <line
                  className="dicom-viewer__measure-line is-draft"
                  x1={draftMeasure.a.x}
                  y1={draftMeasure.a.y}
                  x2={draftMeasure.b.x}
                  y2={draftMeasure.b.y}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>
          ) : null}
        </div>
        {previewMessage !== null ? (
          <p className="dicom-viewer__preview-message" role={previewPending ? 'status' : 'alert'}>
            {previewMessage}
          </p>
        ) : null}
        {/* 四角元数据覆盖层（CR-009 T-001 / R-023）：.viewport-overlay 为
            pointer-events:none（index.css），不遮挡画布/测量交互；降级口径见文件头注释 */}
        {/* 左上：患者姓名 / ID / 日期时间（无日期字段 → 当前切片文件名占位） */}
        <div className="viewport-overlay" style={{ top: 10, left: 12 }}>
          <div>{selectedMeta?.patientName ?? '已置空'}</div>
          <div>{`ID: ${selectedMeta?.patientID ?? '已置空'}`}</div>
          <div>{selectedAsset.file.fileName}</div>
        </div>
        {/* 右上：模态 · 传输语法或去标识化标记 / series UID 截断 / Inst #N / M */}
        <div className="viewport-overlay" style={{ top: 10, right: 12, textAlign: 'right' }}>
          <div>
            {`${selectedMeta?.modality ?? '未提供'} · ${
              selectedMeta?.deidentified
                ? '去标识化'
                : transferSyntaxLabel(selectedMeta?.transferSyntax)
            }`}
          </div>
          {cornerSeriesUid !== undefined ? (
            <div title={selectedMeta?.seriesInstanceUID}>{cornerSeriesUid}</div>
          ) : null}
          <div>{`Inst #${cornerInstanceNumber} / ${cornerSliceTotal}`}</div>
        </div>
        {/* 左下：C/W（上层持有的真实 wc/ww，随调节实时更新）+ PixelSpacing。
            auto=min-max 归一化（真实 min/max 在解码器内部），标注“（自动）”避免误读 */}
        <div className="viewport-overlay" style={{ bottom: 10, left: 12 }}>
          <div>
            {`C: ${windowLevel.wc > 0 ? '+' : ''}${windowLevel.wc} W: ${windowLevel.ww}${
              windowLevel.auto ? '（自动）' : ''
            }`}
          </div>
          {selectedMeta?.pixelSpacing !== undefined ? (
            <div>{`${selectedMeta.pixelSpacing.join(' × ')} mm/px`}</div>
          ) : null}
        </div>
        {/* 右下：Zoom/Rot（视口工具状态实时驱动，R-024；Rot 0° 不显示）/ 平面
            （无 plane 字段 → 默认 AXL） */}
        <div className="viewport-overlay" style={{ bottom: 10, right: 12, textAlign: 'right' }}>
          <div>{`Zoom: ${Math.round(viewport.zoom * 100)}%`}</div>
          {Math.round(viewport.rotateDeg) !== 0 ? (
            <div>{`Rot: ${Math.round(viewport.rotateDeg)}°`}</div>
          ) : null}
          <div>AXIAL</div>
        </div>
        {/* 方向标记（R-023，rec Viewport 同款）：plane 默认 AXL → R/L/A/P */}
        <div
          className="dicom-viewer__orient"
          style={{ top: '50%', left: 10, transform: 'translateY(-50%)' }}
          aria-hidden="true"
        >
          R
        </div>
        <div
          className="dicom-viewer__orient"
          style={{ top: '50%', right: 10, transform: 'translateY(-50%)' }}
          aria-hidden="true"
        >
          L
        </div>
        <div
          className="dicom-viewer__orient"
          style={{ top: 10, left: '50%', transform: 'translateX(-50%)' }}
          aria-hidden="true"
        >
          A
        </div>
        <div
          className="dicom-viewer__orient"
          style={{ bottom: 10, left: '50%', transform: 'translateX(-50%)' }}
          aria-hidden="true"
        >
          P
        </div>
        {/* 测量小控件（CR-009 T-002 / R-024）：Mock 提示与清空入口（有测量或测量
            工具激活时显示）；测量为窗格内状态，比较双窗互不影响 */}
        {measureMode || measures.length > 0 ? (
          <div className="dicom-viewer__measure-widgets">
            <span className="dicom-viewer__measure-hint" role="status">
              模拟测量，非临床：距离标注仅供界面演示
            </span>
            <button
              type="button"
              className="dicom-viewer__measure-clear"
              aria-label={`清空测量${labelSuffix}`}
              disabled={measures.length === 0}
              onClick={() => setMeasures([])}
            >
              清空测量
            </button>
          </div>
        ) : null}
      </div>
      {orderedSlices.length > 0 ? (
        <div className="dicom-viewer__slice-nav">
          <span className="dicom-viewer__slice-counter">
            <span className="dicom-viewer__slice-counter-current">{selectedSliceIndex + 1}</span>
            {` / ${orderedSlices.length}`}
          </span>
          <input
            type="range"
            className="dicom-viewer__slice-slider range-input"
            aria-label={`选择切片${labelSuffix}`}
            min={1}
            max={orderedSlices.length}
            value={selectedSliceIndex + 1}
            style={{ flex: 1 }}
            onChange={(event) => {
              const index = Number(event.target.value) - 1
              selectSliceByIndex(index)
            }}
          />
          <span className="dicom-viewer__slice-position">
            {`切片 ${selectedSliceIndex + 1} / ${orderedSlices.length}（按 InstanceNumber 排序）`}
          </span>
        </div>
      ) : null}
      {sessionPartials[selectedAsset.id] === true ? (
        <p className="dicom-viewer__partial-hint" role="status">
          注：该文件仅解析出部分元数据（文件可能被截断），切片预览不可用。
        </p>
      ) : null}
    </>
  )
}
