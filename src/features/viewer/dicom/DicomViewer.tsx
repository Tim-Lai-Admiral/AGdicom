/**
 * DICOM 查看器（CR-001 T-005 / R-003；CR-003 T-003 增强 W/L 与测量 Mock；
 * CR-009 T-001 视口化：四角元数据覆盖层 + 滚轮切片同步，中央元数据表格下线）。
 *
 * 应用内查看区（role="dialog"，非路由）：Canvas 灰度预览（自动 min-max 或显式窗宽窗位，
 * R-003 修改）+ 四角元数据覆盖层（R-023，视觉参照 rec/src/App.tsx Viewport，只读素材：
 * 左上患者/ID/文件名；右上模态·传输语法或去标识化 / series UID 截断 / Inst #N / M；
 * 左下 C/W（实时）+ PixelSpacing；右下 Zoom/Rot/平面 + 方向标记）+ 切片选择器
 * （多文件 series 按 InstanceNumber 排序切换；视口滚轮与滑条经 selectedAssetId
 * 共享状态双向同步，R-025）+ 测量工具（拖拽绘制 + 距离标注，Mock 非临床，R-010）。
 * 中央元数据表格已移除：元数据唯一来源为右栏 MetadataPanel（CR-009 T-001 / R-023）。
 *
 * 四角降级口径（DicomMeta 契约 R-003 未含的字段，如实降级而非造数）：
 * - 日期时间：无日期字段 → 左上第三行以当前切片文件名占位（随切片切换，辅助识别）；
 * - SliceThickness / plane：无字段 → 左下省略厚度行；平面默认 AXL（显示 AXIAL，
 *   方向标记 R/L/A/P）；
 * - Zoom/Rot：R-024（T-002）工具状态预留 → 恒为默认 100% / 0°（Rot 0° 不显示）；
 * - auto W/L：真实 min/max 在解码器内部计算不外泄 → C/W 展示 App 状态值并标注“（自动）”。
 *
 * 数据流（解析范围见 R-018，聚合口径见 R-019）：
 * - 打开时解析“所属 series 的文件集合”（按患者分组语义匹配，含缺 UID 聚合出的
 *   “未知系列”）∪ 尚无元数据、无法归类的文件（可能属于当前 series，保持“打开即
 *   解析”行为；解析出元数据后即纳入分组并去重，不再重复解析），每个文件间让出
 *   事件循环，大 series 不阻塞界面，dicom-parser 数据集留在会话缓存供像素解码；
 * - 解析完成后按患者分组内的 series 聚合统计切片数（seriesUtils），经 onMetasParsed
 *   批量回写素材（含 sliceCount），由 App 持久化（刷新后右栏元数据面板仍可展示）；
 * - 降级：压缩传输语法 / 解码失败 / Canvas 不可用 → 预览区显示“仅元数据”类文案；
 *   文件无法解析 → 显示解析错误；刷新后（无 objectUrl）→ 元数据来自持久化记录，
 *   预览提示统一为“会话失效，可重新导入或删除该素材”（CR-006 T-004）；任何路径都不崩溃；
 * - 当前切片变化（初始选择 / 滑动条等任意 selectedAssetId 变化路径）经
 *   onSelectedSliceChange 上报切片素材 ID，供 App 更新左栏分组面板高亮
 *   （CR-008 T-002 / R-022；同一素材 ID 不重复回调）。
 *
 * 展示内容仅为工程元数据，不包含任何诊断/治疗暗示。
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
}

export default function DicomViewer({
  asset,
  dicomAssets,
  onMetasParsed,
  onClose,
  onSelectedSliceChange,
  windowLevel = AUTO_WINDOW_LEVEL,
}: DicomViewerProps) {
  /** 本会话（本次打开）解析出的元数据，优先于持久化记录 */
  const [sessionMetas, setSessionMetas] = useState<Record<string, DicomMeta>>({})
  /** 解析失败的素材 → 可读错误信息 */
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({})
  /** 仅抢救出部分元数据的素材（截断文件） */
  const [sessionPartials, setSessionPartials] = useState<Record<string, true>>({})
  /** 批量解析进度；null = 空闲（无待解析文件或已完成） */
  const [parseProgress, setParseProgress] = useState<{ done: number; total: number } | null>(null)
  /** 当前选中的切片（素材 ID）；初始为打开的素材 */
  const [selectedAssetId, setSelectedAssetId] = useState(asset.id)
  /** 预览区文案；null 且 previewRendered=false 之外的组合见渲染逻辑 */
  const [previewMessage, setPreviewMessage] = useState<string | null>(null)
  const [previewPending, setPreviewPending] = useState(false)
  const [previewRendered, setPreviewRendered] = useState(false)
  /** 当前预览帧尺寸（测量覆盖层 SVG viewBox 用） */
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)
  /** 测量工具开关（R-010 Mock：拖拽绘制线 + 距离标注，非临床） */
  const [measureMode, setMeasureMode] = useState(false)
  /** 已完成的测量线；切换素材/切片即清空，不持久化（R-010） */
  const [measures, setMeasures] = useState<MeasureEntry[]>([])
  /** 拖拽中的草稿测量线；null = 未在拖拽 */
  const [draftMeasure, setDraftMeasure] = useState<{ a: MeasurePoint; b: MeasurePoint } | null>(null)

  const datasetsRef = useRef(new Map<string, DataSet>())
  /** sessionMetas 的同步镜像：解析 effect 的聚合步骤需读取此前批次已解析出的元数据 */
  const sessionMetasRef = useRef<Record<string, DicomMeta>>({})
  const completedIdsRef = useRef(new Set<string>())
  const nextMeasureIdRef = useRef(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** 视口容器（四角覆盖层 + 滚轮切片宿主；R-025 原生 wheel 监听挂载点） */
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const onMetasParsedRef = useRef(onMetasParsed)
  useEffect(() => {
    onMetasParsedRef.current = onMetasParsed
  }, [onMetasParsed])

  // ---- 当前切片变化上报（CR-008 T-002 / R-022）：selectedAssetId 变化（含初始选择、
  // 滑动条切换等任意路径）即回调 onSelectedSliceChange；经 ref 读取最新回调（避免因
  // 回调身份变化重复触发）并以 reportedSliceIdRef 去重（同一素材 ID 不重复回调）----
  const onSelectedSliceChangeRef = useRef(onSelectedSliceChange)
  useEffect(() => {
    onSelectedSliceChangeRef.current = onSelectedSliceChange
  }, [onSelectedSliceChange])
  const reportedSliceIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (onSelectedSliceChangeRef.current === undefined) return
    if (reportedSliceIdRef.current === selectedAssetId) return
    reportedSliceIdRef.current = selectedAssetId
    onSelectedSliceChangeRef.current(selectedAssetId)
  }, [selectedAssetId])

  // ---- 派生：已知元数据 / series 分组 / 当前切片 / 解析范围（R-018 / R-019）----
  // 已知元数据：本会话解析结果优先于持久化记录；患者分组语义下的 series 分组
  // （同患者内缺 UID 文件聚合为单个“未知系列”）同时决定切片切换与解析范围。
  const assetById = new Map<string, Asset>()
  for (const a of dicomAssets) assetById.set(a.id, a)
  const selectedAsset = assetById.get(selectedAssetId) ?? asset
  const selectedMeta = sessionMetas[selectedAsset.id] ?? selectedAsset.dicomMeta

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
  const selectedSliceIndex = Math.max(
    0,
    orderedSlices.findIndex((slice) => slice.assetId === selectedAssetId),
  )

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
      if (Object.keys(updates).length > 0) onMetasParsedRef.current(updates)
    })()
    return () => {
      cancelled = true
    }
    // oxlint 不启用 exhaustive-deps：parseKey 已编码范围集合，asset 随 key 重挂载稳定
  }, [parseKey])

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

  // ---- 测量清空语义（R-010）：切换切片即清空测量（素材切换由 App 以 key 重挂载达成）----
  useEffect(() => {
    setMeasures([])
    setDraftMeasure(null)
  }, [selectedAssetId])

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

  // ---- 测量工具指针交互（R-010 Mock）：工具开启且预览渲染后可拖拽，抬起落笔 ----
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

  const handleMeasurePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!measureMode || !previewRendered || event.button !== 0) return
    const point = canvasPointFromEvent(event)
    if (point === null) return
    setDraftMeasure({ a: point, b: point })
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // jsdom 等环境不支持 pointer capture：不影响拖拽主流程
    }
  }

  const handleMeasurePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (draftMeasure === null) return
    const point = canvasPointFromEvent(event)
    if (point === null) return
    setDraftMeasure({ a: draftMeasure.a, b: point })
  }

  const handleMeasurePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
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

  // ---- 视口滚轮切片（CR-009 T-001 / R-025）----
  // 原生 wheel 监听挂载在视口容器（passive:false 才能 preventDefault，拦截页面滚动与
  // 浏览器缩放手势）：非 Ctrl/Cmd → 切片 ±1（上下边界钳制不溢出），经 setSelectedAssetId
  // 与底部滑条共享同一状态实现双向同步；Ctrl/Cmd + 滚轮 → 缩放为 R-024（T-002）工具
  // 范畴，当前预留不处理（仅拦截浏览器页面缩放，避免误触整体缩放）。
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
      if (event.ctrlKey || event.metaKey) return // 缩放预留（T-002 / R-024）
      if (event.deltaY === 0) return // 横向滚动不切切片
      const slices = orderedSlicesRef.current
      if (slices.length === 0) return
      const currentId = selectedAssetIdRef.current
      const currentIndex = slices.findIndex((slice) => slice.assetId === currentId)
      const base = currentIndex < 0 ? 0 : currentIndex
      const nextIndex =
        event.deltaY > 0 ? Math.min(slices.length - 1, base + 1) : Math.max(0, base - 1)
      const next = slices[nextIndex]
      if (next !== undefined && next.assetId !== currentId) setSelectedAssetId(next.assetId)
    }
    wrap.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      wrap.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const failedCount = Object.keys(sessionErrors).length
  // 测量覆盖层视觉尺寸随图像分辨率缩放（端点半径/字号在 viewBox 坐标系内取值）
  const measureImageSpan = Math.max(previewSize?.width ?? 0, previewSize?.height ?? 0)
  const measureEndpointRadius = Math.max(2, Math.round(measureImageSpan / 150))
  const measureLabelFontSize = Math.max(11, Math.min(24, Math.round(measureImageSpan / 32)))
  const measureLabelOffset = measureLabelFontSize * 0.7

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

        {parseProgress !== null ? (
          <p className="dicom-viewer__status" role="status">
            {`正在解析 DICOM 文件（${parseProgress.done}/${parseProgress.total}）…`}
          </p>
        ) : failedCount > 0 ? (
          <p className="dicom-viewer__status dicom-viewer__status--warning" role="status">
            {`${failedCount} 个文件无法解析，已按可用内容降级展示`}
          </p>
        ) : null}

        <div className="dicom-viewer__body">
          <section className="dicom-viewer__preview" aria-label="切片预览">
            <div ref={canvasWrapRef} className="dicom-viewer__canvas-wrap">
              <canvas
                ref={canvasRef}
                className={
                  previewRendered
                    ? measureMode
                      ? 'dicom-viewer__canvas is-measuring'
                      : 'dicom-viewer__canvas'
                    : 'dicom-viewer__canvas is-hidden'
                }
                aria-label="所选切片的灰度预览"
                onPointerDown={handleMeasurePointerDown}
                onPointerMove={handleMeasurePointerMove}
                onPointerUp={handleMeasurePointerUp}
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
              {previewMessage !== null ? (
                <p className="dicom-viewer__preview-message" role={previewPending ? 'status' : 'alert'}>
                  {previewMessage}
                </p>
              ) : null}
              {/* 四角元数据覆盖层（CR-009 T-001 / R-023；视觉参照 rec/src/App.tsx Viewport，
                  只读素材）。.viewport-overlay 为 pointer-events:none（index.css），
                  不遮挡画布/测量交互；降级口径见文件头注释。 */}
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
              {/* 左下：C/W（App 持有的真实 wc/ww，随右栏 W/L 调节实时更新）+ PixelSpacing。
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
              {/* 右下：Zoom/Rot（T-002 工具状态预留：默认 100% / 0°，0° 不显示）/ 平面
                  （无 plane 字段 → 默认 AXL） */}
              <div className="viewport-overlay" style={{ bottom: 10, right: 12, textAlign: 'right' }}>
                <div>Zoom: 100%</div>
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
            </div>
            <div className="dicom-viewer__tools">
              <button
                type="button"
                className={
                  measureMode ? 'dicom-viewer__tool-btn is-active' : 'dicom-viewer__tool-btn'
                }
                aria-pressed={measureMode}
                disabled={!previewRendered}
                onClick={() => setMeasureMode((value) => !value)}
              >
                测量（模拟）
              </button>
              <button
                type="button"
                className="dicom-viewer__tool-btn"
                disabled={measures.length === 0}
                onClick={() => setMeasures([])}
              >
                清空测量
              </button>
              {measureMode || measures.length > 0 ? (
                <span className="dicom-viewer__measure-hint" role="status">
                  模拟测量，非临床：距离标注仅供界面演示
                </span>
              ) : null}
            </div>
            {orderedSlices.length > 0 ? (
              <div className="dicom-viewer__slice-nav">
                <span className="dicom-viewer__slice-counter">
                  <span className="dicom-viewer__slice-counter-current">
                    {selectedSliceIndex + 1}
                  </span>
                  {` / ${orderedSlices.length}`}
                </span>
                <input
                  type="range"
                  className="dicom-viewer__slice-slider range-input"
                  aria-label="选择切片"
                  min={1}
                  max={orderedSlices.length}
                  value={selectedSliceIndex + 1}
                  style={{ flex: 1 }}
                  onChange={(event) => {
                    const index = Number(event.target.value) - 1
                    const slice = orderedSlices[index]
                    if (slice !== undefined) setSelectedAssetId(slice.assetId)
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
          </section>
        </div>
      </section>
    </div>
  )
}
