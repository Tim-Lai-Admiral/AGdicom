/**
 * DICOM series 聚合纯函数（CR-001 T-005 / R-003）。
 *
 * 给定多个 DICOM 素材的 DicomMeta，按 SeriesInstanceUID 分组统计切片数
 * （R-003“按 series 分组统计切片数”）；多文件同一 series 的切片按
 * InstanceNumber 升序排列（缺失排最后，稳定排序），供查看器的切片切换使用。
 */
import type { DicomMeta } from '../../../domain/types.ts'

/** 聚合输入：素材 ID + 该素材解析得到的元数据 */
export interface DicomSeriesEntry {
  assetId: string
  meta: DicomMeta
}

/** 组内单个切片（一个 DICOM 文件） */
export interface DicomSeriesSlice {
  assetId: string
  /** InstanceNumber；缺失为 null（排序时排在有值之后） */
  instanceNumber: number | null
}

/** 一个 series 分组 */
export interface DicomSeriesGroup {
  /** 分组键：有 SeriesInstanceUID 时为 UID，否则 asset:<id>（无法确认归属的文件单独成组） */
  key: string
  /** SeriesInstanceUID；文件缺失该字段时为 null */
  seriesInstanceUID: string | null
  /** 按 InstanceNumber 升序的切片列表 */
  slices: readonly DicomSeriesSlice[]
  /** 该 series 的切片数（= slices.length） */
  sliceCount: number
}

/** InstanceNumber 升序；null 排最后并保持输入相对顺序（Array#sort 为稳定排序） */
function sortSlicesByInstanceNumber(slices: readonly DicomSeriesSlice[]): DicomSeriesSlice[] {
  return [...slices].sort((a, b) => {
    if (a.instanceNumber === null && b.instanceNumber === null) return 0
    if (a.instanceNumber === null) return 1
    if (b.instanceNumber === null) return -1
    return a.instanceNumber - b.instanceNumber
  })
}

/**
 * 按 SeriesInstanceUID 分组；SeriesInstanceUID 缺失的文件各自单独成组
 * （无法确认其归属，不并入其他序列，也不与未知序列合并）。
 */
export function groupDicomBySeries(entries: readonly DicomSeriesEntry[]): DicomSeriesGroup[] {
  const groups = new Map<string, DicomSeriesGroup>()
  for (const entry of entries) {
    const uid = entry.meta.seriesInstanceUID
    const key = uid ?? `asset:${entry.assetId}`
    const group = groups.get(key)
    const slice: DicomSeriesSlice = {
      assetId: entry.assetId,
      instanceNumber: entry.meta.instanceNumber ?? null,
    }
    if (group === undefined) {
      groups.set(key, { key, seriesInstanceUID: uid ?? null, slices: [slice], sliceCount: 1 })
    } else {
      groups.set(key, {
        ...group,
        slices: [...group.slices, slice],
        sliceCount: group.slices.length + 1,
      })
    }
  }
  for (const [key, group] of groups) {
    const slices = sortSlicesByInstanceNumber(group.slices)
    groups.set(key, { ...group, slices, sliceCount: slices.length })
  }
  return Array.from(groups.values())
}

/** 找到某素材所在的 series 分组（该素材无可用元数据时为 undefined） */
export function findDicomSeriesGroup(
  groups: readonly DicomSeriesGroup[],
  assetId: string,
): DicomSeriesGroup | undefined {
  return groups.find((group) => group.slices.some((slice) => slice.assetId === assetId))
}

/**
 * 每个素材所属 series 的切片数（供回写 DicomMeta.sliceCount；
 * 单文件 series 为 1，与分组统计口径一致）。
 */
export function sliceCountByAsset(entries: readonly DicomSeriesEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const group of groupDicomBySeries(entries)) {
    for (const slice of group.slices) counts[slice.assetId] = group.sliceCount
  }
  return counts
}
