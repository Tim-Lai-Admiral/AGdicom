/**
 * 左栏 DICOM 患者分组展开区（CR-005 T-002 / R-012；CR-007 T-001 / R-019）。
 *
 * DICOM 素材行下方可展开为两级层级：患者组头（PatientName + PatientID，复用
 * seriesUtils 的 groupDicomByPatient / findDicomPatientGroup）→ series 行
 * （组内 series 按 SeriesInstanceUID 升序，复用 groupDicomBySeries 的分组结果；
 * 同患者内缺 UID 的文件聚合为单个“未知系列”，文案“未知系列（N 个文件）”）→
 * 切片缩略图（按 InstanceNumber 排序、缺失按文件名）：已解析且像素可解码的切片
 * 显示真实首帧像素（sliceThumb 生成的会话级 dataURL，R-017），未生成/生成失败时
 * 回退 ThumbSVG 风格的占位示意 SVG（非像素解码）。
 * 患者组默认折叠（open 由 App 层 expandedDicomId 控制）；series 行默认折叠，
 * 当前在中央查看器打开的素材所属 series 自动展开（含患者组头 is-active 高亮、
 * 当前切片缩略图 is-active）。点击切片缩略图 → onOpenSlice(sliceAssetId)：
 * App 以该切片素材为当前素材打开中央 DICOM 查看器。
 *
 * 缩略图生成（R-017，按需懒生成）：series 行展开后，对其中已解析（dicomMeta 存在）
 * 且有会话 objectUrl 的切片自动生成首帧缩略图；会话级缓存由 sliceThumb 承担
 * （不持久化、不入导出）。无元数据（刚导入尚未解析 / 刷新后未打开查看器）时显示
 * 占位提示，不崩溃。
 */
import { useEffect, useRef, useState } from 'react'
import type { Asset } from '../../domain/types.ts'
import { findDicomPatientGroup, groupDicomByPatient } from '../viewer/dicom/seriesUtils.ts'
import type { DicomSeriesEntry } from '../viewer/dicom/seriesUtils.ts'
import { generateSliceThumb, getCachedSliceThumb } from '../viewer/dicom/sliceThumb.ts'
import type { SliceThumbSource } from '../viewer/dicom/sliceThumb.ts'

/** 切片占位缩略图（ThumbSVG 风格：0~1 的相对位置 t 决定示意形态） */
function SliceThumb({ t }: { t: number }) {
  const bodyRx = 22 + 6 * Math.sin(t * Math.PI)
  const lungAlpha = Math.min(1, 4 * Math.min(t, 1 - t))
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="64" height="64" fill="#050808" />
      <ellipse cx="32" cy="34" rx={bodyRx} ry={bodyRx * 0.88} fill="#262626" />
      {t > 0.1 && t < 0.9 ? (
        <>
          <ellipse cx="24" cy="32" rx="7" ry="9" fill="#0b1212" opacity={lungAlpha} />
          <ellipse cx="40" cy="32" rx="7" ry="9" fill="#0b1212" opacity={lungAlpha} />
        </>
      ) : null}
      <ellipse cx="32" cy="48" rx="4" ry="3.5" fill="#ccc" />
      <line x1="32" y1="0" x2="32" y2="64" stroke="rgba(0,196,216,0.15)" strokeWidth="0.5" />
      <line x1="0" y1="32" x2="64" y2="32" stroke="rgba(0,196,216,0.15)" strokeWidth="0.5" />
    </svg>
  )
}

export interface DicomSeriesExpansionProps {
  /** 展开入口所在的 DICOM 素材 */
  asset: Asset
  /** 素材库中全部 DICOM 素材（患者分组的数据源） */
  dicomAssets: readonly Asset[]
  /** 是否展开患者组面板 */
  open: boolean
  /** 当前在中央查看器打开的切片素材 ID（自动展开所在 series + 高亮；null = 无） */
  activeSliceAssetId: string | null
  onToggle: () => void
  /** 点击切片缩略图：以该切片素材打开中央查看器 */
  onOpenSlice: (sliceAssetId: string) => void
}

export default function DicomSeriesExpansion({
  asset,
  dicomAssets,
  open,
  activeSliceAssetId,
  onToggle,
  onOpenSlice,
}: DicomSeriesExpansionProps) {
  const entries: DicomSeriesEntry[] = []
  for (const a of dicomAssets) {
    if (a.dicomMeta !== undefined) {
      entries.push({ assetId: a.id, meta: a.dicomMeta, fileName: a.file.fileName })
    }
  }
  const patientGroup = open
    ? findDicomPatientGroup(groupDicomByPatient(entries), asset.id)
    : undefined

  /** 当前切片素材所属的 series 键（自动展开与患者组头高亮的依据；不在本组时为 undefined） */
  const activeSeriesKey =
    patientGroup !== undefined && activeSliceAssetId !== null
      ? patientGroup.series.find((series) =>
          series.slices.some((slice) => slice.assetId === activeSliceAssetId),
        )?.key
      : undefined

  /** 手动展开过的 series 行（默认全部折叠；当前素材所在 series 经 effect 自动展开） */
  const [openSeriesKeys, setOpenSeriesKeys] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (activeSeriesKey === undefined) return
    setOpenSeriesKeys((prev) =>
      prev.has(activeSeriesKey) ? prev : new Set([...prev, activeSeriesKey]),
    )
  }, [activeSeriesKey])

  // ---- 切片真实缩略图（R-017）：展开中的 series 自动生成，有缓存即像素，否则占位 ----
  const [sliceThumbs, setSliceThumbs] = useState<Record<string, string>>({})
  const sliceThumbsRef = useRef(sliceThumbs)
  const putSliceThumb = (assetId: string, dataUrl: string): void => {
    sliceThumbsRef.current = { ...sliceThumbsRef.current, [assetId]: dataUrl }
    setSliceThumbs(sliceThumbsRef.current)
  }
  /** 面板内素材 ID → 素材（取切片的会话 objectUrl 作为生成字节来源） */
  const assetById = new Map<string, Asset>()
  for (const a of dicomAssets) assetById.set(a.id, a)
  /**
   * 展开中的 series 内、可生成缩略图的切片（已解析 + 有会话 objectUrl，按需懒生成）；
   * 键编码 id + objectUrl：objectUrl 恢复（blob 水合）或变化时重新触发。
   */
  const visibleThumbTargets: SliceThumbSource[] = []
  if (open && patientGroup !== undefined) {
    for (const series of patientGroup.series) {
      if (!openSeriesKeys.has(series.key)) continue
      for (const slice of series.slices) {
        const target = assetById.get(slice.assetId)
        if (
          target === undefined ||
          target.dicomMeta === undefined ||
          target.objectUrl === undefined
        ) {
          continue
        }
        visibleThumbTargets.push({ id: target.id, objectUrl: target.objectUrl })
      }
    }
  }
  const visibleThumbKey = visibleThumbTargets
    .map((target) => `${target.id}:${target.objectUrl ?? ''}`)
    .join('|')
  useEffect(() => {
    let cancelled = false
    let cacheHit = false
    for (const target of visibleThumbTargets) {
      if (sliceThumbsRef.current[target.id] !== undefined) continue
      const cached = getCachedSliceThumb(target.id)
      if (cached !== undefined) {
        // 其他入口（素材行缩略图）已生成过：直接采用会话缓存，不再生成
        cacheHit = true
        sliceThumbsRef.current = { ...sliceThumbsRef.current, [target.id]: cached }
        continue
      }
      void generateSliceThumb(target).then((dataUrl) => {
        if (cancelled || dataUrl === null) return
        putSliceThumb(target.id, dataUrl)
      })
    }
    if (cacheHit) setSliceThumbs(sliceThumbsRef.current)
    return () => {
      cancelled = true
    }
    // oxlint 不启用 exhaustive-deps：visibleThumbKey 编码目标集合（含 objectUrl 变化）
  }, [visibleThumbKey])

  const toggleSeries = (key: string): void => {
    setOpenSeriesKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="dicom-expand">
      <button
        type="button"
        className="dicom-expand__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? '收起切片' : '展开切片'}
      </button>
      {open ? (
        patientGroup === undefined ? (
          <p className="dicom-expand__empty">
            暂无切片数据：在中央查看器打开解析后，此处按患者分组展示 series 与切片缩略图。
          </p>
        ) : (
          <>
            <p
              className={
                activeSeriesKey !== undefined
                  ? 'dicom-expand__patient-head is-active'
                  : 'dicom-expand__patient-head'
              }
            >
              <span className="dicom-expand__patient-name">
                {patientGroup.unknown ? '未知患者' : (patientGroup.patientName ?? '已置空')}
              </span>
              <span className="dicom-expand__patient-id">
                {patientGroup.patientID ?? '已置空'}
              </span>
              <span className="dicom-expand__patient-count">
                {patientGroup.seriesCount} 序列 · {patientGroup.sliceCount} 张
              </span>
            </p>
            {patientGroup.series.map((series) => {
              const expanded = openSeriesKeys.has(series.key)
              return (
                <div key={series.key} className="dicom-expand__series">
                  <button
                    type="button"
                    className="dicom-expand__series-toggle"
                    aria-expanded={expanded}
                    onClick={() => toggleSeries(series.key)}
                  >
                    <span className="dicom-expand__series-title">Series</span>
                    <span
                      className="dicom-expand__series-uid"
                      title={series.seriesInstanceUID ?? undefined}
                    >
                      {series.seriesInstanceUID === null
                        ? `未知系列（${series.sliceCount} 个文件）`
                        : series.seriesInstanceUID}
                    </span>
                    <span className="dicom-expand__series-count">{series.sliceCount} 张</span>
                  </button>
                  {expanded ? (
                    <div className="dicom-expand__thumbs">
                      {series.slices.map((slice, index) => {
                        const t = series.sliceCount > 1 ? (index + 1) / series.sliceCount : 0.5
                        const active = slice.assetId === activeSliceAssetId
                        // 真实像素（会话缓存/本组件已生成）优先；未生成/失败 → 占位 SVG
                        const thumbUrl =
                          sliceThumbs[slice.assetId] ?? getCachedSliceThumb(slice.assetId)
                        return (
                          <button
                            key={slice.assetId}
                            type="button"
                            className={
                              active ? 'dicom-expand__thumb is-active' : 'dicom-expand__thumb'
                            }
                            aria-pressed={active}
                            aria-label={`查看切片 #${slice.instanceNumber ?? index + 1}`}
                            onClick={() => onOpenSlice(slice.assetId)}
                          >
                            {thumbUrl !== undefined ? (
                              <img
                                className="dicom-expand__thumb-img"
                                src={thumbUrl}
                                alt=""
                                aria-hidden="true"
                              />
                            ) : (
                              <SliceThumb t={t} />
                            )}
                            <span className="dicom-expand__thumb-index" aria-hidden="true">
                              {slice.instanceNumber ?? index + 1}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </>
        )
      ) : null}
    </div>
  )
}
