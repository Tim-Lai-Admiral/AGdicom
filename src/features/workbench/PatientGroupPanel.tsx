/**
 * 左栏 DICOM 患者分组独立面板（CR-008 T-001 / R-021）。
 *
 * 患者分组展示从"逐行挂载"（DicomSeriesExpansion，已于本任务移除）改为左栏
 * 素材列表下方的独立区块：一次渲染素材库全部患者组（按 R-012 排序，复用
 * seriesUtils 的 groupDicomByPatient）——分组头（PatientName + PatientID，可折叠，
 * 展开状态由 App 层 openGroupKeys 独立持有）→ series 行（组内 series 按
 * SeriesInstanceUID 升序；同患者内缺 UID 的文件聚合为单个"未知系列"，文案
 * "未知系列（N 个文件）"，行内可折叠）→ 切片缩略图（按 InstanceNumber 排序、
 * 缺失按文件名）：已解析且像素可解码的切片显示真实首帧像素（sliceThumb 生成的
 * 会话级 dataURL，R-017），未生成/生成失败时回退 ThumbSVG 风格的占位示意 SVG。
 *
 * 与素材行解耦（R-021）：点击面板中的切片缩略图 → onOpenSlice(sliceAssetId)
 * 仅切换中央查看器与高亮；分组/系列的展开状态不因切片点击改变（当前切片所属
 * 分组必然已展开，onOpenGroup 幂等无副作用）。
 *
 * 自动展开联动：当前在中央查看器打开的素材所属患者组经 onOpenGroup 自动展开
 * （幂等：元数据解析晚于选中时也能补开）；当前素材所属 series 自动展开并高亮
 * （患者组头 is-active、当前切片缩略图 is-active）。
 *
 * 缩略图生成（R-017，按需懒生成）：展开中的 series 内，对已解析（dicomMeta 存在）
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

/** 素材库 DICOM 素材 → seriesUtils 分组输入（App 与面板共用同一构建口径） */
export function buildDicomSeriesEntries(dicomAssets: readonly Asset[]): DicomSeriesEntry[] {
  const entries: DicomSeriesEntry[] = []
  for (const asset of dicomAssets) {
    if (asset.dicomMeta !== undefined) {
      entries.push({ assetId: asset.id, meta: asset.dicomMeta, fileName: asset.file.fileName })
    }
  }
  return entries
}

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

export interface PatientGroupPanelProps {
  /** 素材库中全部 DICOM 素材（患者分组的数据源；与素材行筛选解耦） */
  dicomAssets: readonly Asset[]
  /** 当前在中央查看器打开的切片素材 ID（自动展开所在分组/series + 高亮；null = 无） */
  activeSliceAssetId: string | null
  /** 处于展开态的患者组键集合（App 层独立管理；点击切片不改变，R-021） */
  openGroupKeys: ReadonlySet<string>
  /** 分组头点击：切换该组展开/折叠 */
  onToggleGroup: (groupKey: string) => void
  /** 当前切片所属分组自动展开（幂等；选中素材/解析完成后的联动） */
  onOpenGroup: (groupKey: string) => void
  /** 点击切片缩略图：以该切片素材打开中央查看器（面板位置与展开状态不变） */
  onOpenSlice: (sliceAssetId: string) => void
}

export default function PatientGroupPanel({
  dicomAssets,
  activeSliceAssetId,
  openGroupKeys,
  onToggleGroup,
  onOpenGroup,
  onOpenSlice,
}: PatientGroupPanelProps) {
  const groups = groupDicomByPatient(buildDicomSeriesEntries(dicomAssets))

  /** 当前切片素材所属的患者组（自动展开与分组头高亮的依据） */
  const activeGroup =
    activeSliceAssetId !== null ? findDicomPatientGroup(groups, activeSliceAssetId) : undefined
  const activeGroupKey = activeGroup?.key

  /** 当前切片素材所属的 series 键（自动展开与高亮的依据；不在本组时为 undefined） */
  const activeSeriesKey =
    activeGroup !== undefined && activeSliceAssetId !== null
      ? activeGroup.series.find((series) =>
          series.slices.some((slice) => slice.assetId === activeSliceAssetId),
        )?.key
      : undefined

  // 当前素材所属患者组自动展开（幂等：元数据解析晚于选中时也能补开；
  // 点击面板内切片时该组必然已展开 → 状态不变，R-021）
  const onOpenGroupRef = useRef(onOpenGroup)
  onOpenGroupRef.current = onOpenGroup
  useEffect(() => {
    if (activeGroupKey === undefined || openGroupKeys.has(activeGroupKey)) return
    onOpenGroupRef.current(activeGroupKey)
  }, [activeGroupKey, openGroupKeys])

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
   * 展开中的分组+series 内、可生成缩略图的切片（已解析 + 有会话 objectUrl，按需懒生成）；
   * 键编码 id + objectUrl：objectUrl 恢复（blob 水合）或变化时重新触发。
   */
  const visibleThumbTargets: SliceThumbSource[] = []
  for (const group of groups) {
    if (!openGroupKeys.has(group.key)) continue
    for (const series of group.series) {
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
    <section className="dicom-panel" aria-label="DICOM 患者分组">
      <h3 className="dicom-panel__title">DICOM 患者分组</h3>
      {groups.length === 0 ? (
        <p className="dicom-panel__empty">
          暂无切片数据：在中央查看器打开解析后，此处按患者分组展示 series 与切片缩略图。
        </p>
      ) : (
        groups.map((group) => {
          const groupOpen = openGroupKeys.has(group.key)
          const groupActive = group.key === activeGroupKey
          return (
            <div key={group.key} className="dicom-panel__group">
              <button
                type="button"
                className={
                  groupActive ? 'dicom-panel__group-head is-active' : 'dicom-panel__group-head'
                }
                aria-expanded={groupOpen}
                onClick={() => onToggleGroup(group.key)}
              >
                <span className="dicom-panel__group-name">
                  {group.unknown ? '未知患者' : (group.patientName ?? '已置空')}
                </span>
                <span className="dicom-panel__group-id">{group.patientID ?? '已置空'}</span>
                <span className="dicom-panel__group-count">
                  {group.seriesCount} 序列 · {group.sliceCount} 张
                </span>
              </button>
              {groupOpen
                ? group.series.map((series) => {
                    const expanded = openSeriesKeys.has(series.key)
                    return (
                      <div key={series.key} className="dicom-panel__series">
                        <button
                          type="button"
                          className="dicom-panel__series-toggle"
                          aria-expanded={expanded}
                          onClick={() => toggleSeries(series.key)}
                        >
                          <span className="dicom-panel__series-title">Series</span>
                          <span
                            className="dicom-panel__series-uid"
                            title={series.seriesInstanceUID ?? undefined}
                          >
                            {series.seriesInstanceUID === null
                              ? `未知系列（${series.sliceCount} 个文件）`
                              : series.seriesInstanceUID}
                          </span>
                          <span className="dicom-panel__series-count">{series.sliceCount} 张</span>
                        </button>
                        {expanded ? (
                          <div className="dicom-panel__thumbs">
                            {series.slices.map((slice, index) => {
                              const t =
                                series.sliceCount > 1 ? (index + 1) / series.sliceCount : 0.5
                              const active = slice.assetId === activeSliceAssetId
                              // 真实像素（会话缓存/本组件已生成）优先；未生成/失败 → 占位 SVG
                              const thumbUrl =
                                sliceThumbs[slice.assetId] ?? getCachedSliceThumb(slice.assetId)
                              return (
                                <button
                                  key={slice.assetId}
                                  type="button"
                                  className={
                                    active
                                      ? 'dicom-panel__thumb is-active'
                                      : 'dicom-panel__thumb'
                                  }
                                  aria-pressed={active}
                                  aria-label={`查看切片 #${slice.instanceNumber ?? index + 1}`}
                                  onClick={() => onOpenSlice(slice.assetId)}
                                >
                                  {thumbUrl !== undefined ? (
                                    <img
                                      className="dicom-panel__thumb-img"
                                      src={thumbUrl}
                                      alt=""
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <SliceThumb t={t} />
                                  )}
                                  <span className="dicom-panel__thumb-index" aria-hidden="true">
                                    {slice.instanceNumber ?? index + 1}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                : null}
            </div>
          )
        })
      )}
    </section>
  )
}
