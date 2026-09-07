/**
 * DICOM series 聚合纯函数（CR-001 T-005 / R-003；CR-007 T-001 / R-018 / R-019）。
 *
 * 给定多个 DICOM 素材的 DicomMeta，按 SeriesInstanceUID 分组统计切片数
 * （R-003“按 series 分组统计切片数”）；多文件同一 series 的切片按
 * InstanceNumber 升序排列（缺失/相同时按来源文件名排序，R-019），供查看器的
 * 切片切换使用。
 *
 * 患者分组语义（groupDicomByPatient / R-019）下，同患者内 SeriesInstanceUID
 * 缺失的文件聚合为单个“未知系列”（key = `<patientKey>:unknown-series`）。
 */
import type { DicomMeta } from '../../../domain/types.ts'

/** 聚合输入：素材 ID + 该素材解析得到的元数据 */
export interface DicomSeriesEntry {
  assetId: string
  meta: DicomMeta
  /** 来源文件名（可选）：切片 InstanceNumber 缺失/相同时的排序依据（R-019） */
  fileName?: string
}

/** 组内单个切片（一个 DICOM 文件） */
export interface DicomSeriesSlice {
  assetId: string
  /** InstanceNumber；缺失为 null（排序时排在有值之后） */
  instanceNumber: number | null
  /** 来源文件名（可选）：排序兜底依据，见 DicomSeriesEntry.fileName */
  fileName?: string
}

/** 一个 series 分组 */
export interface DicomSeriesGroup {
  /**
   * 分组键：有 SeriesInstanceUID 时为 UID；缺失时——提供 patientKey 选项则为
   * `<patientKey>:unknown-series`（患者组内聚合的“未知系列”，R-019），
   * 否则为 asset:<id>（无法确认归属的文件单独成组，保持平铺语义）。
   */
  key: string
  /** SeriesInstanceUID；文件缺失该字段时为 null */
  seriesInstanceUID: string | null
  /** 按 InstanceNumber 升序（缺失/相同按文件名）的切片列表 */
  slices: readonly DicomSeriesSlice[]
  /** 该 series 的切片数（= slices.length） */
  sliceCount: number
}

/** 可选字符串比较：任一方缺失或相等时视为等序（Array#sort 稳定，保持输入相对顺序） */
function compareOptionalString(a: string | undefined, b: string | undefined): number {
  if (a === undefined || b === undefined || a === b) return 0
  return a < b ? -1 : 1
}

/**
 * 切片排序（R-019）：InstanceNumber 升序；缺失排最后，缺失之间以及
 * InstanceNumber 相同者按来源文件名排序（无文件名时保持输入相对顺序，
 * Array#sort 为稳定排序）。
 */
function sortSlicesByInstanceNumber(slices: readonly DicomSeriesSlice[]): DicomSeriesSlice[] {
  return [...slices].sort((a, b) => {
    if (a.instanceNumber === null && b.instanceNumber === null) {
      return compareOptionalString(a.fileName, b.fileName)
    }
    if (a.instanceNumber === null) return 1
    if (b.instanceNumber === null) return -1
    if (a.instanceNumber !== b.instanceNumber) return a.instanceNumber - b.instanceNumber
    return compareOptionalString(a.fileName, b.fileName)
  })
}

/** groupDicomBySeries 的可选项 */
export interface GroupDicomBySeriesOptions {
  /**
   * 患者分组键（groupDicomByPatient 传入，R-012 键语义）：提供时，缺
   * SeriesInstanceUID 的素材聚合为该患者组内单个“未知系列”
   * （key = `<patientKey>:unknown-series`，R-019）；缺省时保持平铺语义
   * （缺 UID 的文件各自单独成组）。
   */
  patientKey?: string
}

/**
 * 按 SeriesInstanceUID 分组。SeriesInstanceUID 缺失的文件：
 * - 传入 options.patientKey 时聚合为该患者组内单个“未知系列”（R-019）；
 * - 未传时各自单独成组（无法确认其归属，不并入其他序列，保持既有平铺语义）。
 */
export function groupDicomBySeries(
  entries: readonly DicomSeriesEntry[],
  options?: GroupDicomBySeriesOptions,
): DicomSeriesGroup[] {
  const unknownKey =
    options?.patientKey !== undefined ? `${options.patientKey}:unknown-series` : null
  const groups = new Map<string, DicomSeriesGroup>()
  for (const entry of entries) {
    const uid = entry.meta.seriesInstanceUID
    const key = uid ?? unknownKey ?? `asset:${entry.assetId}`
    const group = groups.get(key)
    const slice: DicomSeriesSlice = {
      assetId: entry.assetId,
      instanceNumber: entry.meta.instanceNumber ?? null,
      fileName: entry.fileName,
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
 * 口径为患者分组语义（R-019）：同患者内缺 UID 的文件聚合为“未知系列”后统计；
 * 不同患者的缺 UID 文件互不合并。
 */
export function sliceCountByAsset(entries: readonly DicomSeriesEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const patientGroup of groupDicomByPatient(entries)) {
    for (const series of patientGroup.series) {
      for (const slice of series.slices) counts[slice.assetId] = series.sliceCount
    }
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
  /**
   * 组内 series（SeriesInstanceUID 升序，无 UID 聚合为单个“未知系列”排最后，R-019；
   * 切片按 InstanceNumber → 文件名排序）
   */
  series: readonly DicomSeriesGroup[]
  /** series 数（= series.length） */
  seriesCount: number
  /** 该患者全部切片数（组内各 series 切片数之和） */
  sliceCount: number
}

/** SeriesInstanceUID 升序；null（聚合后的“未知系列”，至多一个）排最后并保持输入相对顺序 */
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
 *   并传入患者键（R-019：缺 UID 文件聚合为该组内单个“未知系列”，键为
 *   `<patientKey>:unknown-series`），按 SeriesInstanceUID 升序排，未知系列最后。
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
    const series = sortSeriesByUID(groupDicomBySeries(bucket, { patientKey: key }))
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

/**
 * 找到某素材在其患者分组语义下所属的 series 分组（R-018 / R-019）：
 * 与左栏患者分组展开（groupDicomByPatient）同一套分组口径，含缺 UID 文件
 * 聚合后的“未知系列”；素材无可用元数据或不属于任何分组时为 undefined。
 * 供查看器确定“所属 series 的文件集合”（解析范围）与当前切片列表。
 */
export function findDicomPatientSeriesGroup(
  entries: readonly DicomSeriesEntry[],
  assetId: string,
): DicomSeriesGroup | undefined {
  const patientGroup = findDicomPatientGroup(groupDicomByPatient(entries), assetId)
  return patientGroup?.series.find((series) =>
    series.slices.some((slice) => slice.assetId === assetId),
  )
}
