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

// ---------------------------------------------------------------------------
// 患者分组（CR-005 T-002 / R-012）
// ---------------------------------------------------------------------------

/** 一个患者分组：PatientName + PatientID 完全相同的素材归入同组（R-012） */
export interface DicomPatientGroup {
  /**
   * 分组键：`姓名\0ID`（\0 分隔避免字段拼接歧义）；
   * 姓名与 ID 均缺失的素材共用 'unknown' 键（已知键含 \0 分隔符，'unknown' 不含 \0，不会冲突）。
   */
  key: string
  /** 患者姓名；缺失为 null */
  patientName: string | null
  /** 患者 ID；缺失为 null */
  patientID: string | null
  /** true = 姓名与 ID 均缺失（“未知患者”组，置于末尾） */
  unknown: boolean
  /** 组内 series（SeriesInstanceUID 升序，缺失 UID 排最后；切片按 InstanceNumber 排序） */
  series: readonly DicomSeriesGroup[]
  /** series 数（= series.length） */
  seriesCount: number
  /** 该患者全部切片数（组内各 series 切片数之和） */
  sliceCount: number
}

/** SeriesInstanceUID 升序；null（无 UID 的孤立文件组）排最后并保持输入相对顺序 */
function sortSeriesByUID(series: readonly DicomSeriesGroup[]): DicomSeriesGroup[] {
  return [...series].sort((a, b) => {
    if (a.seriesInstanceUID === null && b.seriesInstanceUID === null) return 0
    if (a.seriesInstanceUID === null) return 1
    if (b.seriesInstanceUID === null) return -1
    if (a.seriesInstanceUID !== b.seriesInstanceUID) {
      return a.seriesInstanceUID < b.seriesInstanceUID ? -1 : 1
    }
    return 0
  })
}

/**
 * 按 PatientName + PatientID 分组（R-012）：
 * - 两者完全相同的素材同组（缺失一侧归一为空串参与键，parseDicom 已把空值归一为 undefined）；
 * - 姓名与 ID 均缺失者（去标识化常见形态，同 'empty-patient-fields' 依据）共用一个
 *   “未知患者”组（unknown=true），置于末尾；
 * - 仅缺其一者按现有值参与键（不并入未知组，保留部分归属信息）；
 * - 组间按（姓名, ID）升序（码点序，确定性优先）；组内 series 复用 groupDicomBySeries
 *   （切片沿用 InstanceNumber 排序）并按 SeriesInstanceUID 升序排，缺失 UID 最后。
 */
export function groupDicomByPatient(entries: readonly DicomSeriesEntry[]): DicomPatientGroup[] {
  const buckets = new Map<string, DicomSeriesEntry[]>()
  for (const entry of entries) {
    const name = entry.meta.patientName ?? ''
    const id = entry.meta.patientID ?? ''
    const key = name === '' && id === '' ? 'unknown' : `${name}\u0000${id}`
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [entry])
    else bucket.push(entry)
  }
  const groups: DicomPatientGroup[] = []
  for (const [key, bucket] of buckets) {
    const series = sortSeriesByUID(groupDicomBySeries(bucket))
    const firstName = bucket[0]?.meta.patientName
    const firstID = bucket[0]?.meta.patientID
    groups.push({
      key,
      patientName: firstName !== undefined && firstName !== '' ? firstName : null,
      patientID: firstID !== undefined && firstID !== '' ? firstID : null,
      unknown: key === 'unknown',
      series,
      seriesCount: series.length,
      sliceCount: series.reduce((sum, group) => sum + group.sliceCount, 0),
    })
  }
  const known = groups.filter((group) => !group.unknown)
  const unknowns = groups.filter((group) => group.unknown)
  known.sort((a, b) => {
    const aName = a.patientName ?? ''
    const bName = b.patientName ?? ''
    if (aName !== bName) return aName < bName ? -1 : 1
    const aId = a.patientID ?? ''
    const bId = b.patientID ?? ''
    if (aId !== bId) return aId < bId ? -1 : 1
    return 0
  })
  return [...known, ...unknowns]
}

/** 找到某素材所属的患者分组（素材无可用元数据时为 undefined） */
export function findDicomPatientGroup(
  groups: readonly DicomPatientGroup[],
  assetId: string,
): DicomPatientGroup | undefined {
  return groups.find((group) =>
    group.series.some((series) => series.slices.some((slice) => slice.assetId === assetId)),
  )
}
