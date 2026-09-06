import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AppState } from '../../domain/types.ts'
import { createEmptyState, loadState, STORAGE_KEY } from '../../store/repository.ts'
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
  }
}

/** jsdom 未实现 URL.createObjectURL：注入可控桩并保留原描述符以便恢复 */
const createObjectURLMock = vi.fn<(blob: Blob) => string>()
let urlSeq = 0
let originalCreateObjectURL: PropertyDescriptor | undefined

/** 组织 hook：维护 currentState，并可同步给 hook（模拟 App 的 setState → rerender 回写） */
function setup(initial: AppState) {
  let currentState = initial
  const onStateChange = vi.fn((next: AppState) => {
    currentState = next
  })
  const utils = renderHook(({ state }: { state: AppState }) => useImport({ state, onStateChange }), {
    initialProps: { state: initial },
  })
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
    state.assets['existing-1'] = makeExistingAsset()
    const h = setup(state)
    await act(async () => {
      await h.result.current.importFiles([makeFile('aorta.stl', 512)])
    })
    expect(h.onStateChange).not.toHaveBeenCalled()
    expect(h.result.current.feedback?.created).toHaveLength(0)
    expect(h.result.current.feedback?.duplicates).toEqual([
      { fileName: 'aorta.stl', fileSize: 512, kind: 'model' },
    ])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
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
})
