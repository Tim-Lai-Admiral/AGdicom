import { describe, expect, it } from 'vitest'
import type { DicomMeta } from '../../../domain/types.ts'
import {
  findDicomSeriesGroup,
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
