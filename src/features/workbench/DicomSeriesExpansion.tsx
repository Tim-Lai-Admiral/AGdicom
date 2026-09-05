/**
 * 左栏 DICOM series 展开区（CR-003 T-002 / UI-001）。
 *
 * DICOM 素材卡片下方可展开：按 SeriesInstanceUID 分组（复用 seriesUtils 的
 * groupDicomBySeries / findDicomSeriesGroup，数据来自已回写的 dicomMeta）展示
 * 该素材所属 series 与切片缩略图（ThumbSVG 风格的占位示意 SVG，非像素解码）。
 * 点击切片缩略图 → onOpenSlice(sliceAssetId)：App 以该切片素材为当前素材打开
 * 中央 DICOM 查看器（每个切片即一个 DICOM 文件），并高亮当前切片。
 *
 * 无元数据（刚导入尚未解析 / 刷新后未打开查看器）时显示占位提示，不崩溃。
 */
import type { Asset } from '../../domain/types.ts'
import { findDicomSeriesGroup, groupDicomBySeries } from '../viewer/dicom/seriesUtils.ts'
import type { DicomSeriesEntry } from '../viewer/dicom/seriesUtils.ts'

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
  /** 素材库中全部 DICOM 素材（series 聚合的数据源） */
  dicomAssets: readonly Asset[]
  /** 是否展开 */
  open: boolean
  /** 当前在中央查看器打开的切片素材 ID（高亮；null = 无） */
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
    if (a.dicomMeta !== undefined) entries.push({ assetId: a.id, meta: a.dicomMeta })
  }
  const group = open ? findDicomSeriesGroup(groupDicomBySeries(entries), asset.id) : undefined

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
        group === undefined ? (
          <p className="dicom-expand__empty">
            暂无切片数据：在中央查看器打开解析后，此处按 series 展示切片缩略图。
          </p>
        ) : (
          <>
            <p className="dicom-expand__series-head">
              <span className="dicom-expand__series-title">Series</span>
              <span className="dicom-expand__series-uid" title={group.seriesInstanceUID ?? undefined}>
                {group.seriesInstanceUID === null ? '未提供 UID' : group.seriesInstanceUID}
              </span>
              <span className="dicom-expand__series-count">{group.sliceCount} 张</span>
            </p>
            <div className="dicom-expand__thumbs">
              {group.slices.map((slice, index) => {
                const t = group.sliceCount > 1 ? (index + 1) / group.sliceCount : 0.5
                const active = slice.assetId === activeSliceAssetId
                return (
                  <button
                    key={slice.assetId}
                    type="button"
                    className={active ? 'dicom-expand__thumb is-active' : 'dicom-expand__thumb'}
                    aria-pressed={active}
                    aria-label={`查看切片 #${slice.instanceNumber ?? index + 1}`}
                    onClick={() => onOpenSlice(slice.assetId)}
                  >
                    <SliceThumb t={t} />
                    <span className="dicom-expand__thumb-index" aria-hidden="true">
                      {slice.instanceNumber ?? index + 1}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )
      ) : null}
    </div>
  )
}
