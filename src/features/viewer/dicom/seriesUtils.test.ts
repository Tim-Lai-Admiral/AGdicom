import { describe, expect, it } from 'vitest'
import type { DicomMeta } from '../../../domain/types.ts'
import {
  findDicomPatientGroup,
  findDicomPatientSeriesGroup,
  findDicomSeriesGroup,
  groupDicomByPatient,
  groupDicomBySeries,
  sliceCountByAsset,
} from './seriesUtils.ts'
import type { DicomSeriesEntry } from './seriesUtils.ts'

function meta(overrides: Partial<DicomMeta> = {}): DicomMeta {
  return {
    seriesInstanceUID: '1.2.3.4',
    instanceNumber: 1,
    sliceCount: 1,
    deidentified: false,
    ...overrides,
  }
}

function entry(assetId: string, overrides: Partial<DicomMeta> = {}): DicomSeriesEntry {
  return { assetId, meta: meta(overrides) }
}

describe('groupDicomBySeries', () => {
  it('groups files by SeriesInstanceUID and counts slices', () => {
    const groups = groupDicomBySeries([
      entry('a', { seriesInstanceUID: 'uid-1', instanceNumber: 2 }),
      entry('b', { seriesInstanceUID: 'uid-2' }),
      entry('c', { seriesInstanceUID: 'uid-1', instanceNumber: 1 }),
      entry('d', { seriesInstanceUID: 'uid-1', instanceNumber: 3 }),
    ])
    expect(groups).toHaveLength(2)
    const series1 = groups.find((group) => group.key === 'uid-1')
    expect(series1?.sliceCount).toBe(3)
    expect(series1?.slices.map((slice) => slice.assetId)).toEqual(['c', 'a', 'd'])
    expect(series1?.seriesInstanceUID).toBe('uid-1')
    const series2 = groups.find((group) => group.key === 'uid-2')
    expect(series2?.sliceCount).toBe(1)
  })

  it('orders slices by InstanceNumber ascending and keeps input order for ties', () => {
    const group = groupDicomBySeries([
      entry('a', { instanceNumber: 10 }),
      entry('b', { instanceNumber: 2 }),
      entry('c', { instanceNumber: 10 }),
      entry('d', { instanceNumber: 5 }),
    ])[0]
    expect(group?.slices.map((slice) => slice.assetId)).toEqual(['b', 'd', 'a', 'c'])
    expect(group?.slices.map((slice) => slice.instanceNumber)).toEqual([2, 5, 10, 10])
  })

  it('sorts slices without InstanceNumber last while preserving their relative order', () => {
    const group = groupDicomBySeries([
      entry('a', { instanceNumber: 2 }),
      entry('b', { instanceNumber: undefined }),
      entry('c', { instanceNumber: 1 }),
      entry('d', { instanceNumber: undefined }),
    ])[0]
    expect(group?.slices.map((slice) => slice.assetId)).toEqual(['c', 'a', 'b', 'd'])
    expect(group?.slices.map((slice) => slice.instanceNumber)).toEqual([1, 2, null, null])
  })

  it('keeps files without SeriesInstanceUID as separate single-slice groups', () => {
    const groups = groupDicomBySeries([
      entry('a', { seriesInstanceUID: undefined }),
      entry('b', { seriesInstanceUID: undefined }),
      entry('c', { seriesInstanceUID: 'uid-1' }),
    ])
    expect(groups).toHaveLength(3)
    for (const group of groups) {
      expect(group.sliceCount).toBe(1)
    }
    expect(groups.map((group) => group.key)).toEqual(
      expect.arrayContaining(['asset:a', 'asset:b', 'uid-1']),
    )
    const orphan = groups.find((group) => group.key === 'asset:a')
    expect(orphan?.seriesInstanceUID).toBeNull()
  })

  it('aggregates missing-UID files into one unknown series when patientKey is given (R-019)', () => {
    const patientKey = 'CHEN^WEI\u0000P2'
    const groups = groupDicomBySeries(
      [
        entry('a', { seriesInstanceUID: undefined, instanceNumber: 2 }),
        entry('b', { seriesInstanceUID: 'uid-1' }),
        entry('c', { seriesInstanceUID: undefined, instanceNumber: 1 }),
        entry('d', { seriesInstanceUID: undefined, instanceNumber: undefined }),
      ],
      { patientKey },
    )
    // 无 UID 文件合并为单个“未知系列”，与有 UID 系列共存（R-019 混合场景）
    expect(groups).toHaveLength(2)
    const unknown = groups.find((group) => group.key === `${patientKey}:unknown-series`)
    expect(unknown?.seriesInstanceUID).toBeNull()
    expect(unknown?.sliceCount).toBe(3)
    // 未知系列内切片按 InstanceNumber 升序，缺失者按文件名排最后
    expect(unknown?.slices.map((slice) => slice.assetId)).toEqual(['c', 'a', 'd'])
    const known = groups.find((group) => group.key === 'uid-1')
    expect(known?.sliceCount).toBe(1)
  })

  it('sorts slices with missing InstanceNumber by file name (R-019)', () => {
    const groups = groupDicomBySeries([
      { assetId: 'a', fileName: 'c.dcm', meta: meta({ instanceNumber: undefined }) },
      { assetId: 'b', fileName: 'a.dcm', meta: meta({ instanceNumber: 2 }) },
      { assetId: 'c', fileName: 'b.dcm', meta: meta({ instanceNumber: undefined }) },
      { assetId: 'd', fileName: 'a.dcm', meta: meta({ instanceNumber: undefined }) },
    ])
    // 有 InstanceNumber 者在前；缺失者之间按文件名升序（a.dcm < b.dcm < c.dcm），同名保持输入相对顺序
    expect(groups[0]?.slices.map((slice) => slice.assetId)).toEqual(['b', 'd', 'c', 'a'])
  })
})

describe('findDicomSeriesGroup', () => {
  it('finds the group containing the asset', () => {
    const groups = groupDicomBySeries([
      entry('a', { seriesInstanceUID: 'uid-1' }),
      entry('b', { seriesInstanceUID: 'uid-2' }),
    ])
    expect(findDicomSeriesGroup(groups, 'b')?.key).toBe('uid-2')
    expect(findDicomSeriesGroup(groups, 'missing')).toBeUndefined()
  })
})

describe('sliceCountByAsset', () => {
  it('maps every asset to its series slice count (1 for single-file series)', () => {
    const counts = sliceCountByAsset([
      entry('a', { seriesInstanceUID: 'uid-1', instanceNumber: 1 }),
      entry('b', { seriesInstanceUID: 'uid-1', instanceNumber: 2 }),
      entry('c', { seriesInstanceUID: 'uid-2' }),
    ])
    expect(counts).toEqual({ a: 2, b: 2, c: 1 })
  })

  it('aggregates same-patient missing-UID files into one unknown-series count (R-019)', () => {
    const counts = sliceCountByAsset([
      entry('a', { seriesInstanceUID: undefined }),
      entry('b', { seriesInstanceUID: undefined }),
    ])
    // 默认患者字段均空 → 同一“未知患者”组内的单个未知系列 → 各得 2
    expect(counts).toEqual({ a: 2, b: 2 })
  })

  it('keeps missing-UID files of different patients as separate single-file series', () => {
    const counts = sliceCountByAsset([
      entry('a', { seriesInstanceUID: undefined, patientName: 'P', patientID: '1' }),
      entry('b', { seriesInstanceUID: undefined, patientName: 'P', patientID: '1' }),
      entry('c', { seriesInstanceUID: undefined, patientName: 'Q', patientID: '2' }),
    ])
    expect(counts).toEqual({ a: 2, b: 2, c: 1 })
  })
})

describe('groupDicomByPatient', () => {
  it('groups by patient name+ID and orders groups by (name, ID) ascending', () => {
    const groups = groupDicomByPatient([
      entry('a', { patientName: 'CHEN^WEI', patientID: 'P2', seriesInstanceUID: 'uid-2' }),
      entry('b', { patientName: 'ADAMS^J', patientID: 'P1' }),
      entry('c', { patientName: 'CHEN^WEI', patientID: 'P2', seriesInstanceUID: 'uid-1' }),
      entry('d', { patientName: 'CHEN^WEI', patientID: 'P1' }),
    ])
    // 同名不同 ID 是不同患者；组间按（姓名, ID）码点升序
    expect(groups.map((group) => group.key)).toEqual([
      'ADAMS^J\u0000P1',
      'CHEN^WEI\u0000P1',
      'CHEN^WEI\u0000P2',
    ])
    const chen2 = groups[2]
    expect(chen2?.patientName).toBe('CHEN^WEI')
    expect(chen2?.patientID).toBe('P2')
    expect(chen2?.seriesCount).toBe(2)
    expect(chen2?.sliceCount).toBe(2)
    expect(chen2?.unknown).toBe(false)
  })

  it('merges files with both patient fields missing into one unknown group placed last', () => {
    const groups = groupDicomByPatient([
      entry('a', { patientName: undefined, patientID: undefined, seriesInstanceUID: 'uid-1' }),
      entry('b', { patientName: 'CHEN^WEI', patientID: 'P2' }),
      entry('c', { patientName: undefined, patientID: undefined, seriesInstanceUID: 'uid-2' }),
    ])
    expect(groups).toHaveLength(2)
    const known = groups[0]
    expect(known?.patientName).toBe('CHEN^WEI')
    expect(known?.unknown).toBe(false)
    // 去标识化文件（姓名/ID 均空）同入一个“未知患者”组，置于末尾
    const unknown = groups[1]
    expect(unknown?.unknown).toBe(true)
    expect(unknown?.patientName).toBeNull()
    expect(unknown?.patientID).toBeNull()
    expect(unknown?.seriesCount).toBe(2)
    expect(unknown?.sliceCount).toBe(2)
  })

  it('keeps partially missing fields as keyed groups (missing side treated as empty)', () => {
    const groups = groupDicomByPatient([
      entry('a', { patientName: 'CHEN^WEI', patientID: undefined }),
      entry('b', { patientName: 'CHEN^WEI', patientID: undefined }),
      entry('c', { patientName: undefined, patientID: 'P9' }),
    ])
    // 仅缺其一者不并入“未知患者”组：按现有值参与键，缺失一侧视为空串
    expect(groups.map((group) => group.key)).toEqual(['\u0000P9', 'CHEN^WEI\u0000'])
    const byId = groups[0]
    expect(byId?.patientName).toBeNull()
    expect(byId?.patientID).toBe('P9')
    expect(byId?.unknown).toBe(false)
    const byName = groups[1]
    expect(byName?.patientName).toBe('CHEN^WEI')
    expect(byName?.patientID).toBeNull()
    // 同键素材并入同组（默认同 series → 1 组 2 切片）
    expect(byName?.seriesCount).toBe(1)
    expect(byName?.sliceCount).toBe(2)
  })

  it('sorts series by SeriesInstanceUID ascending with the aggregated unknown series last', () => {
    const groups = groupDicomByPatient([
      entry('a', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-2' }),
      entry('b', { patientName: 'P', patientID: '1', seriesInstanceUID: undefined, instanceNumber: 2 }),
      entry('c', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-10' }),
      entry('d', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-1' }),
    ])
    const group = groups[0]
    // 字符串码点升序：uid-1 < uid-10 < uid-2；无 UID 文件聚合为单个“未知系列”排最后（R-019）
    expect(group?.series.map((series) => series.key)).toEqual([
      'uid-1',
      'uid-10',
      'uid-2',
      'P\u00001:unknown-series',
    ])
    expect(group?.sliceCount).toBe(4)
  })

  it('returns an empty list for no entries', () => {
    expect(groupDicomByPatient([])).toEqual([])
  })

  it('aggregates 10 same-patient no-UID files into 1 group + 1 unknown series + 10 slices (R-019)', () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      entry(`a${index}`, {
        patientName: 'CHEN^WEI',
        patientID: 'P2',
        seriesInstanceUID: undefined,
        instanceNumber: index + 1,
      }),
    )
    const groups = groupDicomByPatient(entries)
    expect(groups).toHaveLength(1)
    const patient = groups[0]
    expect(patient?.unknown).toBe(false)
    expect(patient?.seriesCount).toBe(1)
    expect(patient?.sliceCount).toBe(10)
    const unknown = patient?.series[0]
    expect(unknown?.key).toBe('CHEN^WEI\u0000P2:unknown-series')
    expect(unknown?.seriesInstanceUID).toBeNull()
    expect(unknown?.slices).toHaveLength(10)
  })

  it('lets a known series and the unknown series coexist in one patient group (R-019)', () => {
    const groups = groupDicomByPatient([
      entry('a', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-1', instanceNumber: 1 }),
      entry('b', { patientName: 'P', patientID: '1', seriesInstanceUID: undefined, instanceNumber: 2 }),
      entry('c', { patientName: 'P', patientID: '1', seriesInstanceUID: undefined, instanceNumber: 1 }),
    ])
    expect(groups).toHaveLength(1)
    const patient = groups[0]
    expect(patient?.seriesCount).toBe(2)
    expect(patient?.sliceCount).toBe(3)
    // 有 UID 系列在前，未知系列最后
    expect(patient?.series.map((series) => series.key)).toEqual([
      'uid-1',
      'P\u00001:unknown-series',
    ])
    expect(patient?.series[1]?.slices.map((slice) => slice.assetId)).toEqual(['c', 'b'])
  })
})

describe('findDicomPatientGroup', () => {
  it('finds the patient group containing the asset', () => {
    const groups = groupDicomByPatient([
      entry('a', { patientName: 'CHEN^WEI', patientID: 'P2' }),
      entry('b', { patientName: undefined, patientID: undefined }),
    ])
    expect(findDicomPatientGroup(groups, 'a')?.key).toBe('CHEN^WEI\u0000P2')
    expect(findDicomPatientGroup(groups, 'b')?.unknown).toBe(true)
    expect(findDicomPatientGroup(groups, 'missing')).toBeUndefined()
  })
})

describe('findDicomPatientSeriesGroup', () => {
  it('finds the UID series of the asset within its patient group', () => {
    const group = findDicomPatientSeriesGroup(
      [
        entry('a', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-1', instanceNumber: 1 }),
        entry('b', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-1', instanceNumber: 2 }),
        entry('c', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-2' }),
      ],
      'b',
    )
    expect(group?.key).toBe('uid-1')
    expect(group?.slices.map((slice) => slice.assetId)).toEqual(['a', 'b'])
  })

  it('finds the aggregated unknown series of the asset (R-019)', () => {
    const group = findDicomPatientSeriesGroup(
      [
        entry('a', { patientName: 'P', patientID: '1', seriesInstanceUID: undefined }),
        entry('b', { patientName: 'P', patientID: '1', seriesInstanceUID: undefined }),
        entry('c', { patientName: 'Q', patientID: '2', seriesInstanceUID: undefined }),
      ],
      'b',
    )
    // 同患者无 UID 文件聚合命中；其他患者的无 UID 文件不在其中
    expect(group?.key).toBe('P\u00001:unknown-series')
    expect(group?.sliceCount).toBe(2)
  })

  it('returns undefined for assets without metadata or group membership', () => {
    expect(findDicomPatientSeriesGroup([entry('a')], 'missing')).toBeUndefined()
    expect(findDicomPatientSeriesGroup([], 'a')).toBeUndefined()
  })
})
