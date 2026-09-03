import { describe, expect, it } from 'vitest'
import type { Asset, AppState, ReviewHistory, ReviewRecord, Tag } from './types.ts'
import { addAssetTag, applyReview, removeAssetTag, setAssetStatus } from './review.ts'

const NOW = '2026-09-03T08:00:00.000Z'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'aorta.stl',
    kind: 'model',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'aorta.stl', fileSize: 1024, fileType: 'model/stl' },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeState(
  assets: Asset[] = [],
  tags: Record<string, Tag> = {},
  reviews: Record<string, ReviewHistory> = {},
): AppState {
  const assetMap: Record<string, Asset> = {}
  for (const asset of assets) assetMap[asset.id] = asset
  return { assets: assetMap, tags, reviews }
}

describe('applyReview', () => {
  it('appends a review record, updates status and updatedAt atomically', () => {
    const state = makeState(
      [makeAsset()],
      {},
      {
        'asset-1': [
          { status: 'pending', comment: '初审', createdAt: '2026-09-01T00:00:00.000Z' },
        ],
      },
    )
    const next = applyReview(state, 'asset-1', { status: 'passed', comment: ' 结构完整 ' }, NOW)
    const history: ReviewHistory | undefined = next.reviews['asset-1']
    expect(history).toHaveLength(2) // 追加式：旧记录保留
    const latest: ReviewRecord | undefined = history?.[1]
    expect(latest).toEqual({ status: 'passed', comment: '结构完整', createdAt: NOW })
    expect(next.assets['asset-1']?.status).toBe('passed')
    expect(next.assets['asset-1']?.updatedAt).toBe(NOW)
  })

  it('defaults a missing comment to an empty string', () => {
    const next = applyReview(makeState([makeAsset()]), 'asset-1', { status: 'rejected' }, NOW)
    expect(next.reviews['asset-1']).toEqual([{ status: 'rejected', comment: '', createdAt: NOW }])
  })

  it('uses the current time when now is omitted', () => {
    const next = applyReview(makeState([makeAsset()]), 'asset-1', { status: 'passed' })
    const history: ReviewHistory | undefined = next.reviews['asset-1']
    const latest: ReviewRecord | undefined = history?.[0]
    expect(latest?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('returns the input state unchanged when the asset does not exist', () => {
    const state = makeState([makeAsset()])
    expect(applyReview(state, 'missing', { status: 'passed', comment: 'x' }, NOW)).toBe(state)
  })
})

describe('setAssetStatus', () => {
  it('changes the status and leaves a history record with empty comment', () => {
    const next = setAssetStatus(makeState([makeAsset()]), 'asset-1', 'rejected', NOW)
    expect(next.assets['asset-1']?.status).toBe('rejected')
    expect(next.assets['asset-1']?.updatedAt).toBe(NOW)
    expect(next.reviews['asset-1']).toEqual([{ status: 'rejected', comment: '', createdAt: NOW }])
  })

  it('is a no-op for a missing asset', () => {
    const state = makeState([makeAsset()])
    expect(setAssetStatus(state, 'missing', 'passed', NOW)).toBe(state)
  })
})

describe('addAssetTag', () => {
  it('adds the tag and merges a self-created tag into the registry', () => {
    const state = makeState([makeAsset()])
    const next = addAssetTag(state, 'asset-1', '自建标签', NOW)
    expect(next.assets['asset-1']?.tags).toEqual(['自建标签'])
    expect(next.assets['asset-1']?.updatedAt).toBe(NOW)
    expect(next.tags['自建标签']).toEqual({ name: '自建标签', count: 1 })
  })

  it('trims the tag name and recounts usage across assets', () => {
    const state = makeState([makeAsset({ id: 'a1' }), makeAsset({ id: 'a2' })])
    const once = addAssetTag(state, 'a1', '自建标签', NOW)
    const twice = addAssetTag(once, 'a2', '  自建标签  ', NOW)
    expect(twice.assets['a2']?.tags).toEqual(['自建标签'])
    expect(twice.tags['自建标签']).toEqual({ name: '自建标签', count: 2 })
  })

  it('is a no-op when the tag already exists on the asset or the name is blank', () => {
    const state = makeState([makeAsset()])
    const once = addAssetTag(state, 'asset-1', '重复', NOW)
    expect(addAssetTag(once, 'asset-1', '重复', NOW)).toBe(once)
    expect(addAssetTag(once, 'asset-1', '   ', NOW)).toBe(once)
    expect(addAssetTag(once, 'missing', '新标签', NOW)).toBe(once)
  })
})

describe('removeAssetTag', () => {
  it('removes the tag and recounts the registry entry (kept at zero for reuse)', () => {
    const state = makeState([makeAsset({ id: 'a1' }), makeAsset({ id: 'a2' })])
    const both = addAssetTag(addAssetTag(state, 'a1', '标签A', NOW), 'a2', '标签A', NOW)
    const oneLeft = removeAssetTag(both, 'a2', '标签A', NOW)
    expect(oneLeft.assets['a2']?.tags).toEqual([])
    expect(oneLeft.assets['a2']?.updatedAt).toBe(NOW)
    expect(oneLeft.tags['标签A']).toEqual({ name: '标签A', count: 1 })
    const noneLeft = removeAssetTag(oneLeft, 'a1', '标签A', NOW)
    expect(noneLeft.assets['a1']?.tags).toEqual([])
    expect(noneLeft.tags['标签A']).toEqual({ name: '标签A', count: 0 }) // 注册表保留条目
  })

  it('is a no-op when the tag is absent or the asset is missing', () => {
    const state = addAssetTag(makeState([makeAsset()]), 'asset-1', '标签A', NOW)
    expect(removeAssetTag(state, 'asset-1', '不存在', NOW)).toBe(state)
    expect(removeAssetTag(state, 'missing', '标签A', NOW)).toBe(state)
  })
})

describe('purity', () => {
  it('never mutates the input state', () => {
    const state = makeState(
      [makeAsset(), makeAsset({ id: 'a2', tags: ['已有'] })],
      { 已有: { name: '已有', count: 1 } },
      { 'asset-1': [{ status: 'pending', comment: '初审', createdAt: '2026-09-01T00:00:00.000Z' }] },
    )
    const snapshot = JSON.parse(JSON.stringify(state)) as AppState
    applyReview(state, 'a2', { status: 'passed', comment: 'ok' }, NOW)
    setAssetStatus(state, 'a2', 'rejected', NOW)
    addAssetTag(state, 'a2', '新标签', NOW)
    removeAssetTag(state, 'a2', '已有', NOW)
    expect(state).toEqual(snapshot)
  })
})
