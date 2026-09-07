import { describe, expect, it } from 'vitest'
import type { Asset, AppState, ReviewHistory, ReviewRecord, Tag } from './types.ts'
import { addAssetTag, applyReview, removeAsset, removeAssetTag, setAssetStatus, updateAssetName, updateAssetNote } from './review.ts'

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

describe('removeAsset', () => {
  it('deletes the asset, its review history and recounts shared tags (no orphans)', () => {
    const state = makeState(
      [
        makeAsset({ id: 'a1', tags: ['共享', '独占'], dicomMeta: { sliceCount: 1, deidentified: true } }),
        makeAsset({ id: 'a2', name: 'scan.dcm', kind: 'dicom', tags: ['共享'] }),
      ],
      { 共享: { name: '共享', count: 2 }, 独占: { name: '独占', count: 1 } },
      {
        a1: [{ status: 'passed', comment: '初审', createdAt: NOW }],
        a2: [{ status: 'pending', comment: '', createdAt: NOW }],
      },
    )
    const next = removeAsset(state, 'a1')
    // 资产本体（含挂在资产上的 DICOM 元数据）消失
    expect(next.assets['a1']).toBeUndefined()
    // 评审历史无孤儿：a1 的历史被清除，a2 的历史保留
    expect(next.reviews['a1']).toBeUndefined()
    expect(next.reviews['a2']).toEqual(state.reviews['a2'])
    // 标签计数按剩余素材重算：共享 → 1；独占 → 0（注册表保留条目便于复用）
    expect(next.tags['共享']).toEqual({ name: '共享', count: 1 })
    expect(next.tags['独占']).toEqual({ name: '独占', count: 0 })
    // 其余素材不受影响
    expect(next.assets['a2']).toEqual(state.assets['a2'])
  })

  it('leaves the registry untouched for tags the deleted asset no longer registers (stale tag)', () => {
    const state = makeState([makeAsset({ tags: ['陈旧标签'] })])
    const next = removeAsset(state, 'asset-1')
    expect(next.assets).toEqual({})
    expect(next.tags).toBe(state.tags) // 注册表本无该条目：不新增、不改动
    expect(next.reviews).toEqual({})
  })

  it('is a no-op for a missing asset', () => {
    const state = makeState([makeAsset()])
    expect(removeAsset(state, 'missing')).toBe(state)
  })
})

describe('updateAssetNote', () => {
  it('updates the note and updatedAt without appending a review record', () => {
    const state = makeState(
      [makeAsset()],
      {},
      { 'asset-1': [{ status: 'pending', comment: '', createdAt: NOW }] },
    )
    const next = updateAssetNote(state, 'asset-1', '结构清晰', NOW)
    expect(next.assets['asset-1']?.note).toBe('结构清晰')
    expect(next.assets['asset-1']?.updatedAt).toBe(NOW)
    // 备注不进评审历史（历史仅记录评审结论）
    expect(next.reviews['asset-1']).toEqual(state.reviews['asset-1'])
  })

  it('is a no-op when the note is unchanged or the asset is missing', () => {
    const state = makeState([makeAsset({ note: '原备注' })])
    expect(updateAssetNote(state, 'asset-1', '原备注', NOW)).toBe(state)
    expect(updateAssetNote(state, 'missing', '新备注', NOW)).toBe(state)
  })
})

describe('updateAssetName', () => {
  it('renames the asset, trims the name and refreshes updatedAt', () => {
    const state = makeState([makeAsset({ name: 'aorta.stl' })])
    const next = updateAssetName(state, 'asset-1', '  主动脉模型  ', NOW)
    expect(next.assets['asset-1']?.name).toBe('主动脉模型')
    expect(next.assets['asset-1']?.updatedAt).toBe(NOW)
    // 其余字段不变
    expect(next.assets['asset-1']?.tags).toEqual(state.assets['asset-1']?.tags)
    expect(next.tags).toBe(state.tags)
  })

  it('is a no-op when the name is blank, unchanged or the asset is missing', () => {
    const state = makeState([makeAsset({ name: 'aorta.stl' })])
    expect(updateAssetName(state, 'asset-1', '   ', NOW)).toBe(state)
    expect(updateAssetName(state, 'asset-1', 'aorta.stl', NOW)).toBe(state)
    expect(updateAssetName(state, 'missing', '新名称', NOW)).toBe(state)
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
    updateAssetNote(state, 'a2', '新备注', NOW)
    updateAssetName(state, 'a2', '新名称', NOW)
    removeAsset(state, 'a2')
    expect(state).toEqual(snapshot)
  })
})
