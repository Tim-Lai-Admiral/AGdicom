/**
 * DICOM 查看器（CR-001 T-005 / R-003）。
 *
 * 应用内弹层（role="dialog"，非路由）：元数据表格（可读中文标签）+ 切片选择器
 * （多文件 series 按 InstanceNumber 排序切换）+ Canvas 灰度预览（min-max 归一化）。
 *
 * 数据流：
 * - 打开时对素材库中所有含会话 objectUrl 的 DICOM 素材异步逐个解析（每个文件间让出
 *   事件循环，大 series 不阻塞界面），dicom-parser 数据集留在会话缓存供像素解码；
 * - 解析完成后按 SeriesInstanceUID 聚合统计切片数（seriesUtils），经 onMetasParsed
 *   批量回写素材（含 sliceCount），由 App 持久化（刷新后元数据表格仍可展示）；
 * - 降级：压缩传输语法 / 解码失败 / Canvas 不可用 → 预览区显示“仅元数据”类文案；
 *   文件无法解析 → 显示解析错误；刷新后（无 objectUrl）→ 元数据来自持久化记录，
 *   预览提示需重新导入；任何路径都不崩溃。
 *
 * 展示内容仅为工程元数据，不包含任何诊断/治疗暗示。
 */
import { useEffect, useRef, useState } from 'react'
import type { DataSet } from 'dicom-parser'
import type { Asset, DicomDeidEvidence, DicomMeta } from '../../../domain/types.ts'
import { DicomParseError, parseDicomFile } from './parseDicom.ts'
import { decodeDicomFrame } from './decodePixel.ts'
import {
  EXPLICIT_VR_LITTLE_ENDIAN_UID,
  IMPLICIT_VR_LITTLE_ENDIAN_UID,
} from './decodePixel.ts'
import { findDicomSeriesGroup, groupDicomBySeries, sliceCountByAsset } from './seriesUtils.ts'
import type { DicomSeriesEntry } from './seriesUtils.ts'

/** 常见 SOP Class 的可读名称（未知 UID 原样展示） */
const SOP_CLASS_LABELS: Readonly<Record<string, string>> = {
  '1.2.840.10008.5.1.4.1.1.2': 'CT Image Storage',
  '1.2.840.10008.5.1.4.1.1.2.1': 'Enhanced CT Image Storage',
  '1.2.840.10008.5.1.4.1.1.4': 'MR Image Storage',
  '1.2.840.10008.5.1.4.1.1.7': 'Secondary Capture Image Storage',
}

/** 常见传输语法的可读名称（用于判断预览可用性并向用户说明） */
const TRANSFER_SYNTAX_LABELS: Readonly<Record<string, string>> = {
  [IMPLICIT_VR_LITTLE_ENDIAN_UID]: 'Implicit VR Little Endian（无压缩）',
  [EXPLICIT_VR_LITTLE_ENDIAN_UID]: 'Explicit VR Little Endian（无压缩）',
  '1.2.840.10008.1.2.2': 'Explicit VR Big Endian（无压缩，暂不支持预览）',
  '1.2.840.10008.1.2.5': 'RLE Lossless（压缩，仅元数据）',
}

/** 去标识化依据的可读说明 */
const DEID_EVIDENCE_LABELS: Readonly<Record<DicomDeidEvidence, string>> = {
  'patient-identity-removed': 'PatientIdentityRemoved（0012,0062）标记为 YES',
  'deidentification-method': '包含 DeidentificationMethod（0012,0063）字段',
  'empty-patient-fields': '患者字段（姓名 / ID）均为空',
}

function sopClassLabel(uid: string | undefined): string {
  if (uid === undefined) return '未提供'
  const known = SOP_CLASS_LABELS[uid]
  return known !== undefined ? `${known}（${uid}）` : uid
}

function transferSyntaxLabel(uid: string | undefined): string {
  if (uid === undefined) return '未提供'
  const known = TRANSFER_SYNTAX_LABELS[uid]
  if (known !== undefined) return known
  if (uid.startsWith('1.2.840.10008.1.2.4')) return 'JPEG 压缩（仅元数据）'
  return `未识别（${uid}）`
}

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

export interface DicomViewerProps {
  /** 当前打开的 DICOM 素材 */
  asset: Asset
  /** 素材库中全部 DICOM 素材（用于按 series 聚合统计切片数与切换切片） */
  dicomAssets: readonly Asset[]
  /** 本会话解析得到元数据后批量回写（持久化由上层完成） */
  onMetasParsed: (metas: Record<string, DicomMeta>) => void
  /** 关闭查看器（“关闭”按钮与 Esc 键均触发） */
  onClose: () => void
}

export default function DicomViewer({
  asset,
  dicomAssets,
  onMetasParsed,
  onClose,
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

  const datasetsRef = useRef(new Map<string, DataSet>())
  const completedIdsRef = useRef(new Set<string>())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onMetasParsedRef = useRef(onMetasParsed)
  useEffect(() => {
    onMetasParsedRef.current = onMetasParsed
  }, [onMetasParsed])

  // ---- 批量解析：所有含会话 objectUrl 且未解析过的 DICOM 素材 ----
  // parseKey（素材 ID + objectUrl）变化时重新入队；解析完成的素材记入 completedIdsRef 去重。
  const parseKey = dicomAssets.map((a) => `${a.id}:${a.objectUrl ?? ''}`).join('|')
  useEffect(() => {
    let cancelled = false
    const queue = dicomAssets.filter(
      (a) => a.objectUrl !== undefined && !completedIdsRef.current.has(a.id),
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
      // 全部完成：合并持久化元数据按 series 聚合，为每个解析出的 meta 回写切片数
      const entries: DicomSeriesEntry[] = []
      for (const a of dicomAssets) {
        const meta = metas[a.id] ?? a.dicomMeta
        if (meta !== undefined) entries.push({ assetId: a.id, meta })
      }
      const counts = sliceCountByAsset(entries)
      const updates: Record<string, DicomMeta> = {}
      for (const [id, meta] of Object.entries(metas)) {
        updates[id] = { ...meta, sliceCount: counts[id] ?? meta.sliceCount }
      }
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
  }, [parseKey])

  // ---- 派生：series 分组 / 当前切片 ----
  const assetById = new Map<string, Asset>()
  for (const a of dicomAssets) assetById.set(a.id, a)
  const selectedAsset = assetById.get(selectedAssetId) ?? asset
  const selectedMeta = sessionMetas[selectedAsset.id] ?? selectedAsset.dicomMeta

  const seriesEntries: DicomSeriesEntry[] = []
  for (const a of dicomAssets) {
    const meta = sessionMetas[a.id] ?? a.dicomMeta
    if (meta !== undefined) seriesEntries.push({ assetId: a.id, meta })
  }
  const groups = groupDicomBySeries(seriesEntries)
  const currentGroup = findDicomSeriesGroup(groups, asset.id)
  const orderedSlices = currentGroup?.slices ?? []
  const selectedSliceIndex = Math.max(
    0,
    orderedSlices.findIndex((slice) => slice.assetId === selectedAssetId),
  )

  // ---- 预览：解码所选切片并绘制到 Canvas（失败/不支持 → 降级文案） ----
  useEffect(() => {
    let cancelled = false
    setPreviewRendered(false)
    setPreviewMessage(null)
    setPreviewPending(false)
    const target = selectedAsset
    const targetMeta = sessionMetas[target.id] ?? target.dicomMeta

    if (target.objectUrl === undefined) {
      // 刷新后（objectUrl 为会话字段）：元数据可来自持久化记录，预览不可用
      setPreviewMessage(
        targetMeta !== undefined
          ? '切片预览不可用：刷新后需重新导入该 DICOM 文件'
          : '元数据与切片预览不可用：刷新后需重新导入该 DICOM 文件',
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
      const image = decodeDicomFrame(dataset)
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
      setPreviewRendered(true)
    } catch (error) {
      if (cancelled) return
      setPreviewMessage(error instanceof Error ? error.message : `切片预览失败（${String(error)})`)
    }
    return () => {
      cancelled = true
    }
  }, [selectedAssetId, selectedAsset, sessionMetas, sessionErrors, parseProgress])

  // ---- 弹层交互：打开时聚焦关闭按钮；Esc 关闭 ----
  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleStepSlice = (delta: number): void => {
    const next = orderedSlices[selectedSliceIndex + delta]
    if (next !== undefined) setSelectedAssetId(next.assetId)
  }

  const failedCount = Object.keys(sessionErrors).length
  const metaMissingMessage =
    parseProgress !== null
      ? '正在解析该 DICOM 文件的元数据…'
      : (sessionErrors[selectedAsset.id] ??
        (selectedAsset.objectUrl === undefined
          ? '暂无可展示的元数据：刷新后需重新导入该 DICOM 文件'
          : '该文件暂无可展示的元数据'))

  return (
    <div className="dicom-viewer-overlay">
      <section className="dicom-viewer" role="dialog" aria-modal="true" aria-label="DICOM 详情">
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
                  previewRendered ? 'dicom-viewer__canvas' : 'dicom-viewer__canvas is-hidden'
                }
                aria-label="所选切片的灰度预览"
              />
              {previewMessage !== null ? (
                <p className="dicom-viewer__preview-message" role={previewPending ? 'status' : 'alert'}>
                  {previewMessage}
                </p>
              ) : null}
            </div>
            {orderedSlices.length > 0 ? (
              <div className="dicom-viewer__slice-nav">
                <button
                  type="button"
                  className="dicom-viewer__slice-button"
                  onClick={() => handleStepSlice(-1)}
                  disabled={selectedSliceIndex === 0}
                  aria-label="上一张切片"
                >
                  ‹ 上一张
                </button>
                <label className="dicom-viewer__slice-select-label">
                  <span>切片</span>
                  <select
                    className="dicom-viewer__slice-select"
                    aria-label="选择切片"
                    value={selectedAssetId}
                    onChange={(event) => {
                      setSelectedAssetId(event.target.value)
                    }}
                  >
                    {orderedSlices.map((slice, index) => {
                      const sliceAsset = assetById.get(slice.assetId)
                      return (
                        <option key={slice.assetId} value={slice.assetId}>
                          {`#${slice.instanceNumber ?? index + 1} ${
                            sliceAsset?.file.fileName ?? slice.assetId
                          }`}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <button
                  type="button"
                  className="dicom-viewer__slice-button"
                  onClick={() => handleStepSlice(1)}
                  disabled={selectedSliceIndex >= orderedSlices.length - 1}
                  aria-label="下一张切片"
                >
                  下一张 ›
                </button>
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
