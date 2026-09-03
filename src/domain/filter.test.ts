import { describe, expect, it } from 'vitest'
import type { Asset, AppState, Tag } from './types.ts'
import {
  collectTagNames,
  DEFAULT_ASSET_FILTER,
  filterAssets,
  isDefaultAssetFilter,
} from './filter.ts'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'heart.png',
    kind: 'image',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    ...overrides,
  }
}

/** 三个维度的混合样例：图片（待评审/心脏）、DICOM（通过/复查）、模型（驳回/心脏+复查） */
const SAMPLE_ASSETS: Asset[] = [
  makeAsset({
    id: 'a1',
    name: 'Heart.PNG',
    kind: 'image',
    status: 'pending',
    tags: ['心脏'],
  }),
  makeAsset({
    id: 'a2',
    name: 'scan.dcm',
    kind: 'dicom',
    status: 'passed',
    tags: ['复查'],
  }),
  makeAsset({
    id: 'a3',
    name: 'aorta.stl',
    kind: 'model',
    status: 'rejected',
    tags: ['心脏', '复查'],
  }),
]

function makeTagState(assets: Asset[], tags: Record<string, Tag>): AppState {
  const assetMap: Record<string, Asset> = {}
  for (const asset of assets) assetMap[asset.id] = asset
  return { assets: assetMap, tags, reviews: {} }
}

describe('filterAssets', () => {
  it('returns all assets in original order under the default filter', () => {
    const result = filterAssets(SAMPLE_ASSETS, DEFAULT_ASSET_FILTER)
    expect(result.map((asset) => asset.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('filters by kind', () => {
    const result = filterAssets(SAMPLE_ASSETS, { ...DEFAULT_ASSET_FILTER, kind: 'dicom' })
    expect(result.map((asset) => asset.id)).toEqual(['a2'])
  })

  it('filters by status', () => {
    const result = filterAssets(SAMPLE_ASSETS, { ...DEFAULT_ASSET_FILTER, status: 'rejected' })
    expect(result.map((asset) => asset.id)).toEqual(['a3'])
  })

  it('filters by tag (asset must carry the exact tag)', () => {
    const result = filterAssets(SAMPLE_ASSETS, { ...DEFAULT_ASSET_FILTER, tag: '心脏' })
    expect(result.map((asset) => asset.id)).toEqual(['a1', 'a3'])
  })

  it('matches names case-insensitively and trims the keyword', () => {
    // 名称为 “Heart.PNG”，关键字 “ heart ”（空白 + 大小写混合）应命中
    const result = filterAssets(SAMPLE_ASSETS, { ...DEFAULT_ASSET_FILTER, search: '  HeArT  ' })
    expect(result.map((asset) => asset.id)).toEqual(['a1'])
    // 空白关键字 = 不搜索，返回全部
    expect(filterAssets(SAMPLE_ASSETS, { ...DEFAULT_ASSET_FILTER, search: '   ' })).toHaveLength(3)
  })

  it('combines all conditions with AND', () => {
    const result = filterAssets(SAMPLE_ASSETS, {
      kind: 'image',
      status: 'pending',
      tag: '心脏',
      search: 'heart',
    })
    expect(result.map((asset) => asset.id)).toEqual(['a1'])
    // 组合中任一条件不满足即被排除：模型虽带“心脏”标签，但类型不符
    const wider = filterAssets(SAMPLE_ASSETS, { ...DEFAULT_ASSET_FILTER, tag: '心脏' })
    expect(wider.map((asset) => asset.id)).toEqual(['a1', 'a3'])
  })

  it('returns an empty array when nothing matches', () => {
    const result = filterAssets(SAMPLE_ASSETS, {
      ...DEFAULT_ASSET_FILTER,
      kind: 'dicom',
      status: 'rejected',
    })
    expect(result).toEqual([])
  })

  it('returns a new array and never mutates the input', () => {
    const snapshot = JSON.parse(JSON.stringify(SAMPLE_ASSETS)) as Asset[]
    const result = filterAssets(SAMPLE_ASSETS, { ...DEFAULT_ASSET_FILTER, kind: 'image' })
    expect(result).not.toBe(SAMPLE_ASSETS)
    expect(SAMPLE_ASSETS).toEqual(snapshot)
    expect(result.map((asset) => asset.id)).toEqual(['a1'])
  })
})

describe('isDefaultAssetFilter', () => {
  it('recognizes the default filter and whitespace-only search as default', () => {
    expect(isDefaultAssetFilter(DEFAULT_ASSET_FILTER)).toBe(true)
    expect(isDefaultAssetFilter({ ...DEFAULT_ASSET_FILTER, search: '   ' })).toBe(true)
  })

  it('detects any active condition', () => {
    expect(isDefaultAssetFilter({ ...DEFAULT_ASSET_FILTER, kind: 'image' })).toBe(false)
    expect(isDefaultAssetFilter({ ...DEFAULT_ASSET_FILTER, status: 'passed' })).toBe(false)
    expect(isDefaultAssetFilter({ ...DEFAULT_ASSET_FILTER, tag: '心脏' })).toBe(false)
    expect(isDefaultAssetFilter({ ...DEFAULT_ASSET_FILTER, search: 'heart' })).toBe(false)
  })
})

describe('collectTagNames', () => {
  it('merges the registry and in-use tags, deduped and sorted by code point', () => {
    const state = makeTagState(
      [
        makeAsset({ id: 'a1', tags: ['zeta'] }),
        makeAsset({ id: 'a2', tags: ['beta', 'zeta'] }),
      ],
      { archive: { name: 'archive', count: 0 }, zeta: { name: 'zeta', count: 2 } },
    )
    // archive 仅在注册表（计数 0）也列出；注册表与在用标签去重
    expect(collectTagNames(state)).toEqual(['archive', 'beta', 'zeta'])
  })

  it('sorts CJK tag names after ASCII by code point (deterministic across environments)', () => {
    const state = makeTagState([makeAsset({ id: 'a1', tags: ['心脏', '复查'] })], {})
    expect(collectTagNames(state)).toEqual(['复查', '心脏'])
  })

  it('returns an empty list for an empty state', () => {
    expect(collectTagNames(makeTagState([], {}))).toEqual([])
  })

  it('does not mutate the input state', () => {
    const state = makeTagState(
      [makeAsset({ id: 'a1', tags: ['beta'] })],
      { beta: { name: 'beta', count: 1 } },
    )
    const snapshot = JSON.parse(JSON.stringify(state)) as AppState
    collectTagNames(state)
    expect(state).toEqual(snapshot)
  })
})
