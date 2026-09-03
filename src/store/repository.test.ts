import { describe, expect, it } from 'vitest'
import type { Asset, AppState, ReviewHistory, Tag } from '../domain/types.ts'
import {
  loadState,
  RepositorySaveError,
  saveState,
  STORAGE_KEY,
} from './repository.ts'

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

/** 可控的 Storage 桩：可注入读写异常，便于模拟容量/访问失败 */
function createStorage(
  overrides: { getItemError?: Error; setItemError?: Error } = {},
): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      if (overrides.getItemError) throw overrides.getItemError
      const value: string | undefined = map.get(key)
      return value === undefined ? null : value
    },
    key(index: number) {
      const keys = Array.from(map.keys())
      const value: string | undefined = keys[index]
      return value === undefined ? null : value
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      if (overrides.setItemError) throw overrides.setItemError
      map.set(key, value)
    },
  }
}

describe('saveState / loadState round-trip', () => {
  it('persists and restores the full AppState under the single storage key', () => {
    const storage = createStorage()
    const state = makeState(
      [
        makeAsset(),
        makeAsset({
          id: 'asset-2',
          name: 'phantom-1.dcm',
          kind: 'dicom',
          file: { fileName: 'phantom-1.dcm', fileSize: 2048, fileType: 'application/dicom' },
          dicomMeta: {
            modality: 'CT',
            sopClass: '1.2.840.10008.5.1.4.1.1.2',
            transferSyntax: '1.2.840.10008.1.2.1',
            rows: 512,
            columns: 512,
            pixelSpacing: [0.5, 0.5],
            seriesInstanceUID: '1.2.3',
            patientName: '',
            patientID: '',
            sliceCount: 3,
            deidentified: true,
            deidentificationMethod: 'Basic Profile',
          },
        }),
      ],
      { 心脏: { name: '心脏', count: 2 } },
      {
        'asset-1': [
          { status: 'rejected', comment: '噪点过多', createdAt: NOW },
          { status: 'passed', comment: '复审通过', createdAt: NOW },
        ],
      },
    )
    saveState(state, storage)
    expect(storage.length).toBe(1) // 单 key
    const result = loadState(storage)
    expect(result.issue).toBe(null)
    expect(result.state).toEqual(state)
  })

  it('strips the session-only objectUrl field when saving', () => {
    const storage = createStorage()
    saveState(makeState([makeAsset({ objectUrl: 'blob:session' })]), storage)
    const raw = storage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(raw).not.toContain('blob:session')
    const result = loadState(storage)
    expect(result.state.assets['asset-1']?.objectUrl).toBeUndefined()
  })
})

describe('loadState error handling', () => {
  it('returns an empty state without issue when nothing is stored', () => {
    const result = loadState(createStorage())
    expect(result.issue).toBe(null)
    expect(result.state).toEqual({ assets: {}, tags: {}, reviews: {} })
  })

  it('falls back to an empty state when the stored JSON is corrupted', () => {
    const storage = createStorage()
    storage.setItem(STORAGE_KEY, '{oops not json')
    const result = loadState(storage)
    expect(result.issue).toBe('corrupted')
    expect(result.state).toEqual({ assets: {}, tags: {}, reviews: {} })
  })

  it('falls back to an empty state when the stored JSON has the wrong shape', () => {
    for (const bad of ['{"foo":1}', '[]', '{"assets":[],"tags":{},"reviews":{}}']) {
      const storage = createStorage()
      storage.setItem(STORAGE_KEY, bad)
      const result = loadState(storage)
      expect(result.issue).toBe('corrupted')
      expect(result.state).toEqual({ assets: {}, tags: {}, reviews: {} })
    }
  })

  it('reports storage-unavailable when reading throws', () => {
    const storage = createStorage({ getItemError: new Error('SecurityError') })
    const result = loadState(storage)
    expect(result.issue).toBe('storage-unavailable')
    expect(result.state).toEqual({ assets: {}, tags: {}, reviews: {} })
  })
})

describe('saveState error handling', () => {
  it('throws a readable RepositorySaveError (with cause) when writes fail', () => {
    const storage = createStorage({ setItemError: new Error('QuotaExceededError') })
    let thrown: unknown
    try {
      saveState(makeState([makeAsset()]), storage)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RepositorySaveError)
    const error = thrown as RepositorySaveError
    expect(error.message).toContain('保存失败')
    expect(error.cause).toBeInstanceOf(Error)
  })
})

describe('default storage wiring', () => {
  it('uses the global localStorage when no storage is provided', () => {
    const globalStorage = globalThis.localStorage
    globalStorage.removeItem(STORAGE_KEY)
    const state = makeState([makeAsset()])
    saveState(state)
    const result = loadState()
    expect(result.issue).toBe(null)
    expect(result.state).toEqual(state)
    globalStorage.removeItem(STORAGE_KEY)
  })
})
