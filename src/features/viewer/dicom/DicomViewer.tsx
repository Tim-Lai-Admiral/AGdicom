/**
 * DICOM 查看器（CR-001 T-005 / R-003；CR-003 T-003 增强 W/L 与测量 Mock）。
 *
 * 应用内查看区（role="dialog"，非路由）：元数据表格（可读中文标签）+ 切片选择器
 * （多文件 series 按 InstanceNumber 排序切换）+ Canvas 灰度预览（自动 min-max 或
 * 显式窗宽窗位，R-003 修改）+ 测量工具（拖拽绘制 + 距离标注，Mock 非临床，R-010）。
 *
 * 数据流（解析范围见 R-018，聚合口径见 R-019）：
 * - 打开时解析“所属 series 的文件集合”（按患者分组语义匹配，含缺 UID 聚合出的
 *   “未知系列”）∪ 尚无元数据、无法归类的文件（可能属于当前 series，保持“打开即
 *   解析”行为；解析出元数据后即纳入分组并去重，不再重复解析），每个文件间让出
 *   事件循环，大 series 不阻塞界面，dicom-parser 数据集留在会话缓存供像素解码；
 * - 解析完成后按患者分组内的 series 聚合统计切片数（seriesUtils），经 onMetasParsed
 *   批量回写素材（含 sliceCount），由 App 持久化（刷新后元数据表格仍可展示）；
 * - 降级：压缩传输语法 / 解码失败 / Canvas 不可用 → 预览区显示“仅元数据”类文案；
 *   文件无法解析 → 显示解析错误；刷新后（无 objectUrl）→ 元数据来自持久化记录，
 *   预览提示统一为“会话失效，可重新导入或删除该素材”（CR-006 T-004）；任何路径都不崩溃。
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
import { DEID_EVIDENCE_LABELS, sopClassLabel, transferSyntaxLabel } from './metaLabels.ts'
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

export interface DicomViewerProps {
  /** 当前打开的 DICOM 素材 */
  asset: Asset
  /** 素材库中全部 DICOM 素材（用于按 series 聚合统计切片数与切换切片） */
  dicomAssets: readonly Asset[]
  /** 本会话解析得到元数据后批量回写（持久化由上层完成） */
  onMetasParsed: (metas: Record<string, DicomMeta>) => void
  /** 关闭查看器（“关闭”按钮与 Esc 键均触发） */
  onClose: () => void
  /** 窗宽窗位（R-003 修改）；缺省自动 min-max（与既有行为等价）。App 持有，右栏面板可调 */
  windowLevel?: WindowLevelState
}

export default function DicomViewer({
  asset,
  dicomAssets,
  onMetasParsed,
  onClose,
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
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const onMetasParsedRef = useRef(onMetasParsed)
  useEffect(() => {
    onMetasParsedRef.current = onMetasParsed
  }, [onMetasParsed])

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

  const failedCount = Object.keys(sessionErrors).length
  // 测量覆盖层视觉尺寸随图像分辨率缩放（端点半径/字号在 viewBox 坐标系内取值）
  const measureImageSpan = Math.max(previewSize?.width ?? 0, previewSize?.height ?? 0)
  const measureEndpointRadius = Math.max(2, Math.round(measureImageSpan / 150))
  const measureLabelFontSize = Math.max(11, Math.min(24, Math.round(measureImageSpan / 32)))
  const measureLabelOffset = measureLabelFontSize * 0.7
  const metaMissingMessage =
    parseProgress !== null
      ? '正在解析该 DICOM 文件的元数据…'
      : (sessionErrors[selectedAsset.id] ??
        (selectedAsset.objectUrl === undefined
          ? '暂无可展示的元数据：会话失效，可重新导入或删除该素材'
          : '该文件暂无可展示的元数据'))

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
            <div className="dicom-viewer__canvas-wrap">
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
          </section>

          <section className="dicom-viewer__meta" aria-label="DICOM 元数据">
            <h3 className="dicom-viewer__meta-title">元数据</h3>
            {selectedMeta === undefined ? (
              <p className="dicom-viewer__meta-missing" role="alert">
                {metaMissingMessage}
              </p>
            ) : (
              <>
                <table className="dicom-viewer__table">
                  <tbody>
                    <tr>
                      <th scope="row">模态（Modality）</th>
                      <td>{selectedMeta.modality ?? '未提供'}</td>
                    </tr>
                    <tr>
                      <th scope="row">SOP Class</th>
                      <td className="dicom-viewer__uid">{sopClassLabel(selectedMeta.sopClass)}</td>
                    </tr>
                    <tr>
                      <th scope="row">传输语法（Transfer Syntax）</th>
                      <td className="dicom-viewer__uid">
                        {transferSyntaxLabel(selectedMeta.transferSyntax)}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">行 × 列（Rows × Columns）</th>
                      <td>
                        {selectedMeta.rows !== undefined && selectedMeta.columns !== undefined
                          ? `${selectedMeta.rows} × ${selectedMeta.columns}`
                          : '未提供'}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">像素间距（PixelSpacing）</th>
                      <td>
                        {selectedMeta.pixelSpacing !== undefined
                          ? `${selectedMeta.pixelSpacing.join(' × ')} mm`
                          : '未提供'}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">序列实例 UID（SeriesInstanceUID）</th>
                      <td className="dicom-viewer__uid">
                        {selectedMeta.seriesInstanceUID ?? '未提供'}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">切片序号（InstanceNumber）</th>
                      <td>
                        {selectedMeta.instanceNumber !== undefined
                          ? `#${selectedMeta.instanceNumber}`
                          : '未提供'}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">切片数（按序列分组统计）</th>
                      <td>
                        {currentGroup !== undefined
                          ? `${currentGroup.sliceCount} 张（本序列）`
                          : `${selectedMeta.sliceCount} 张`}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">患者姓名（PatientName）</th>
                      <td>{selectedMeta.patientName ?? '已置空'}</td>
                    </tr>
                    <tr>
                      <th scope="row">患者 ID（PatientID）</th>
                      <td>{selectedMeta.patientID ?? '已置空'}</td>
                    </tr>
                    <tr>
                      <th scope="row">去标识化（Deidentification）</th>
                      <td>
                        {selectedMeta.deidentified ? (
                          <>
                            <span className="dicom-viewer__deid-yes">是</span>
                            {selectedMeta.deidentifiedEvidence !== undefined ? (
                              <ul className="dicom-viewer__deid-evidence">
                                {selectedMeta.deidentifiedEvidence.map((item) => (
                                  <li key={item}>
                                    {DEID_EVIDENCE_LABELS[item]}
                                    {item === 'deidentification-method' &&
                                    selectedMeta.deidentificationMethod !== undefined
                                      ? `：${selectedMeta.deidentificationMethod}`
                                      : ''}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        ) : (
                          '否（未检测到去标识化标记）'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {sessionPartials[selectedAsset.id] === true ? (
                  <p className="dicom-viewer__partial-hint" role="status">
                    注：该文件仅解析出部分元数据（文件可能被截断），切片预览不可用。
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
