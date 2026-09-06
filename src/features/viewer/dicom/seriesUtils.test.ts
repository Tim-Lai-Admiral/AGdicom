import { describe, expect, it } from 'vitest'
import type { DicomMeta } from '../../../domain/types.ts'
import {
  findDicomPatientGroup,
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

  it('counts missing-UID files as their own single-file series', () => {
    const counts = sliceCountByAsset([
      entry('a', { seriesInstanceUID: undefined }),
      entry('b', { seriesInstanceUID: undefined }),
    ])
    expect(counts).toEqual({ a: 1, b: 1 })
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

  it('sorts series by SeriesInstanceUID ascending with missing UID last', () => {
    const groups = groupDicomByPatient([
      entry('a', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-2' }),
      entry('b', { patientName: 'P', patientID: '1', seriesInstanceUID: undefined, instanceNumber: 2 }),
      entry('c', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-10' }),
      entry('d', { patientName: 'P', patientID: '1', seriesInstanceUID: 'uid-1' }),
    ])
    const group = groups[0]
    // 字符串码点升序：uid-1 < uid-10 < uid-2；无 UID 的孤立文件组排最后
    expect(group?.series.map((series) => series.key)).toEqual([
      'uid-1',
      'uid-10',
      'uid-2',
      'asset:b',
    ])
    expect(group?.sliceCount).toBe(4)
  })

  it('returns an empty list for no entries', () => {
    expect(groupDicomByPatient([])).toEqual([])
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
