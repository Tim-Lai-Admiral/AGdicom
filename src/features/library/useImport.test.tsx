import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import type { Asset, AppState } from '../../domain/types.ts'
import { createEmptyState, loadState, STORAGE_KEY } from '../../store/repository.ts'
import { defaultBlobStore } from '../../store/blobStore.ts'
import type { BlobStore } from '../../store/blobStore.ts'
import { dedupKey } from './importAssets.ts'
import { useImport } from './useImport.ts'

function makeFile(name: string, size = 32, type = ''): File {
  return new File([new Uint8Array(size)], name, { type })
}

function makeExistingAsset(): Asset {
  return {
    id: 'existing-1',
    name: 'aorta.stl',
    kind: 'model',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    objectUrl: 'blob:existing', // 非幽灵：objectUrl 可用
  }
}

/** 幽灵资产：记录存在但会话字段 objectUrl 已丢失（刷新后场景，R-014） */
function makeGhostAsset(): Asset {
  const asset = makeExistingAsset()
  delete asset.objectUrl
  return asset
}

/** jsdom 未实现 URL.createObjectURL：注入可控桩并保留原描述符以便恢复 */
const createObjectURLMock = vi.fn<(blob: Blob) => string>()
let urlSeq = 0
let originalCreateObjectURL: PropertyDescriptor | undefined

/** 组织 hook：维护 currentState，并可同步给 hook（模拟 App 的 setState → rerender 回写） */
function setup(initial: AppState, blobStore?: BlobStore) {
  let currentState = initial
  const onStateChange = vi.fn((next: AppState) => {
    currentState = next
  })
  const utils = renderHook(
    ({ state }: { state: AppState }) =>
      useImport({ state, onStateChange, ...(blobStore !== undefined ? { blobStore } : {}) }),
    {
      initialProps: { state: initial },
    },
  )
  return {
    ...utils,
    onStateChange,
    getState: () => currentState,
    syncState: () => utils.rerender({ state: currentState }),
  }
}

describe('useImport', () => {
  beforeEach(() => {
    localStorage.clear()
    // jsdom 无 IndexedDB：装 fake-indexeddb（每用例新库，保证隔离）
    globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory
    urlSeq = 0
    createObjectURLMock.mockReset()
    createObjectURLMock.mockImplementation(() => `blob:mock-${++urlSeq}`)
    originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURLMock,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    delete (globalThis as { indexedDB?: unknown }).indexedDB
    if (originalCreateObjectURL === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    }
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('registers assets with session objectUrl and persists them (refresh-safe)', async () => {
    const h = setup(createEmptyState())
    await act(async () => {
      await h.result.current.importFiles([makeFile('heart.png', 64, 'image/png')], '拖拽导入')
    })
    expect(h.result.current.importing).toBe(false)
    expect(h.onStateChange).toHaveBeenCalledTimes(1)
    const assets = Object.values(h.getState().assets)
    expect(assets).toHaveLength(1)
    expect(assets[0]?.kind).toBe('image')
    expect(assets[0]?.objectUrl).toBe('blob:mock-1')
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    // 持久化：刷新后素材仍在（objectUrl 为会话字段，保存时被剥离）
    const stored = loadState()
    expect(stored.issue).toBeNull()
    expect(Object.keys(stored.state.assets)).toHaveLength(1)
    expect(Object.values(stored.state.assets)[0]?.objectUrl).toBeUndefined()
    expect(h.result.current.feedback?.created).toHaveLength(1)
    expect(h.result.current.feedback?.error).toBeNull()
  })

  it('classifies multiple kinds in one batch and keeps submission order', async () => {
    const h = setup(createEmptyState())
    await act(async () => {
      await h.result.current.importFiles([
        makeFile('heart.png'),
        makeFile('scan.dcm'),
        makeFile('aorta.stl'),
      ])
    })
    const assets = Object.values(h.getState().assets)
    expect(assets.map((asset) => asset.kind)).toEqual(['image', 'dicom', 'model'])
    expect(assets.every((asset) => asset.source === '拖拽导入')).toBe(true)
    expect(h.result.current.feedback?.created).toHaveLength(3)
  })

  it('dedupes against state updates from a previous import', async () => {
    const h = setup(createEmptyState())
    await act(async () => {
      await h.result.current.importFiles([makeFile('heart.png', 64)])
    })
    expect(Object.values(h.getState().assets)).toHaveLength(1)
    h.syncState() // 模拟 App rerender 后 hook 拿到最新 state
    await act(async () => {
      await h.result.current.importFiles([makeFile('heart.png', 64)])
    })
    expect(h.result.current.feedback?.duplicates).toHaveLength(1)
    expect(Object.values(h.getState().assets)).toHaveLength(1)
  })

  it('reports duplicates without re-registering or saving', async () => {
    const state = createEmptyState()
    state.assets['existing-1'] = makeExistingAsset() // 非幽灵：objectUrl 可用
    const h = setup(state)
    await act(async () => {
      await h.result.current.importFiles([makeFile('aorta.stl', 512)])
    })
    expect(h.onStateChange).not.toHaveBeenCalled()
    expect(h.result.current.feedback?.created).toHaveLength(0)
    expect(h.result.current.feedback?.hydrated).toHaveLength(0)
    expect(h.result.current.feedback?.duplicates).toEqual([
      { fileName: 'aorta.stl', fileSize: 512, kind: 'model' },
    ])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('revives a ghost asset by rebuilding its objectUrl without adding a record', async () => {
    const state = createEmptyState()
    state.assets['existing-1'] = makeGhostAsset()
    const h = setup(state)
    await act(async () => {
      await h.result.current.importFiles([makeFile('aorta.stl', 512)])
    })
    expect(h.onStateChange).toHaveBeenCalledTimes(1)
    const assets = Object.values(h.getState().assets)
    expect(assets).toHaveLength(1) // 不新增记录
    expect(assets[0]?.id).toBe('existing-1')
    expect(assets[0]?.objectUrl).toBe('blob:mock-1') // objectUrl 重建，预览恢复
    // 元数据不变：水合仅回写会话字段
    expect(assets[0]?.createdAt).toBe('2026-09-01T00:00:00.000Z')
    expect(assets[0]?.updatedAt).toBe('2026-09-01T00:00:00.000Z')
    expect(h.result.current.feedback?.created).toHaveLength(0)
    expect(h.result.current.feedback?.hydrated).toEqual([
      { assetId: 'existing-1', fileName: 'aorta.stl', fileSize: 512, kind: 'model' },
    ])
    expect(h.result.current.feedback?.duplicates).toHaveLength(0)
    // 持久化：记录仍在库，但 objectUrl 不落盘（会话字段被 saveState 剥离）
    const stored = loadState()
    expect(stored.issue).toBeNull()
    expect(Object.keys(stored.state.assets)).toEqual(['existing-1'])
    expect(Object.values(stored.state.assets)[0]?.objectUrl).toBeUndefined()
  })

  it('handles a mixed batch with a ghost revive, a duplicate and a new import', async () => {
    const state = createEmptyState()
    state.assets['existing-1'] = makeExistingAsset() // aorta.stl：非幽灵 → 重复
    const ghost: Asset = {
      id: 'ghost-1',
      name: 'heart.png',
      kind: 'image',
      status: 'passed',
      tags: ['reviewed'],
      note: '',
      source: '文件选择导入',
      file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      // 无 objectUrl：幽灵 → 水合
    }
    state.assets['ghost-1'] = ghost
    const h = setup(state)
    await act(async () => {
      await h.result.current.importFiles([
        makeFile('heart.png', 64, 'image/png'), // 幽灵 → 水合
        makeFile('aorta.stl', 512), // 非幽灵 → 重复
        makeFile('scan.dcm', 128), // 新建
      ])
    })
    const feedback = h.result.current.feedback
    expect(feedback?.created).toHaveLength(1)
    expect(feedback?.hydrated).toEqual([
      { assetId: 'ghost-1', fileName: 'heart.png', fileSize: 64, kind: 'image' },
    ])
    expect(feedback?.duplicates).toEqual([{ fileName: 'aorta.stl', fileSize: 512, kind: 'model' }])
    // 水合不新增记录：ghost-1 回写原资产，仅 scan.dcm 新建
    const assets = h.getState().assets
    expect(Object.keys(assets)).toHaveLength(3)
    const revived = assets['ghost-1']
    expect(revived?.objectUrl).toBe('blob:mock-2') // 新素材先分配 blob:mock-1
    expect(revived?.status).toBe('passed') // 元数据原样保留
    expect(revived?.tags).toEqual(['reviewed'])
    expect(revived?.updatedAt).toBe('2026-09-02T00:00:00.000Z')
    const fresh = Object.values(assets).find((asset) => asset.kind === 'dicom')
    expect(fresh?.objectUrl).toBe('blob:mock-1')
  })

  it('reports unknown extensions with a readable message', async () => {
    const h = setup(createEmptyState())
    await act(async () => {
      await h.result.current.importFiles([makeFile('readme.txt', 12, 'text/plain')])
    })
    expect(h.onStateChange).not.toHaveBeenCalled()
    const unknown = h.result.current.feedback?.unknown
    expect(unknown).toHaveLength(1)
    expect(unknown?.[0]?.message).toContain('readme.txt')
    expect(unknown?.[0]?.message).toContain('png')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('surfaces a save failure as feedback error while keeping in-memory state', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('mock quota exceeded', 'QuotaExceededError')
    })
    const h = setup(createEmptyState())
    await act(async () => {
      await h.result.current.importFiles([makeFile('heart.png')])
    })
    expect(h.onStateChange).toHaveBeenCalledTimes(1) // 内存状态仍更新
    const feedback = h.result.current.feedback
    expect(feedback?.created).toHaveLength(1)
    expect(feedback?.error).toContain('保存失败')
    setItemSpy.mockRestore()
  })

  it('persists created asset blobs to IndexedDB under the dedup key (≤20MB, R-016)', async () => {
    const h = setup(createEmptyState())
    await act(async () => {
      await h.result.current.importFiles([makeFile('heart.png', 64, 'image/png')], '拖拽导入')
    })
    const key = dedupKey('heart.png', 64, 'image')
    await expect(defaultBlobStore.listBlobs()).resolves.toEqual([key])
    const blob = await defaultBlobStore.loadBlob(key)
    expect(blob?.name).toBe('heart.png')
    expect(blob?.size).toBe(64)
  })

  it('persists hydrated ghost blobs so a refresh can auto-restore (R-016 × R-014)', async () => {
    const state = createEmptyState()
    state.assets['existing-1'] = makeGhostAsset()
    const h = setup(state)
    await act(async () => {
      await h.result.current.importFiles([makeFile('aorta.stl', 512)])
    })
    expect(h.result.current.feedback?.hydrated).toHaveLength(1)
    const key = dedupKey('aorta.stl', 512, 'model')
    await expect(defaultBlobStore.listBlobs()).resolves.toEqual([key])
    const blob = await defaultBlobStore.loadBlob(key)
    expect(blob?.name).toBe('aorta.stl')
    expect(blob?.size).toBe(512)
  })

  it('skips IndexedDB persistence for >20MB files and reports the oversize hint (R-016)', async () => {
    const bigFile = makeFile('big-scan.dcm', 20 * 1024 * 1024 + 1)
    const h = setup(createEmptyState())
    await act(async () => {
      await h.result.current.importFiles([bigFile])
    })
    // 注册成功（会话内可用）
    const assets = Object.values(h.getState().assets)
    expect(assets).toHaveLength(1)
    expect(assets[0]?.objectUrl).toBe('blob:mock-1')
    // 未入库 + 反馈提示
    await expect(defaultBlobStore.listBlobs()).resolves.toEqual([])
    const oversize = h.result.current.feedback?.oversize
    expect(oversize).toEqual([{ fileName: 'big-scan.dcm', fileSize: 20 * 1024 * 1024 + 1, kind: 'dicom' }])
    expect(h.result.current.feedback?.error).toBeNull()
  })

  it('degrades to session state with a notice when blob saving fails (R-016)', async () => {
    const failingStore: BlobStore = {
      saveBlob: vi.fn().mockRejectedValue(new Error('配额已满')),
      loadBlob: vi.fn().mockResolvedValue(null),
      deleteBlob: vi.fn().mockResolvedValue(undefined),
      listBlobs: vi.fn().mockResolvedValue([]),
    }
    const h = setup(createEmptyState(), failingStore)
    await act(async () => {
      await h.result.current.importFiles([makeFile('heart.png', 64, 'image/png')], '拖拽导入')
    })
    // 导入不阻塞：素材已注册且 objectUrl 可用
    const assets = Object.values(h.getState().assets)
    expect(assets).toHaveLength(1)
    expect(assets[0]?.objectUrl).toBe('blob:mock-1')
    const feedback = h.result.current.feedback
    expect(feedback?.created).toHaveLength(1)
    expect(feedback?.error).toContain('本地二进制保存失败')
    expect(feedback?.error).toContain('配额已满')
    // localStorage 元数据持久化不受 blob 失败影响
    expect(loadState().issue).toBeNull()
  })
})
