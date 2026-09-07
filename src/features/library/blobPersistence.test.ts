/**
 * 资产 ↔ blob 桥接助手单测（CR-006 T-003 / R-016）。
 *
 * 注入式 BlobStore 桩覆盖：命中恢复 / 已有 objectUrl 跳过 / 无匹配跳过 /
 * 单资产失败跳过 / 存储不可用降级 / 删除级联与失败兜底。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import { dedupKey } from './importAssets.ts'
import { deleteAssetBlob, restoreAssetBlobs } from './blobPersistence.ts'
import type { BlobStore } from '../../store/blobStore.ts'

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

/** 可编程桩：按需覆写各方法 */
function makeStore(overrides: Partial<BlobStore> = {}): BlobStore & {
  saveBlob: ReturnType<typeof vi.fn>
  loadBlob: ReturnType<typeof vi.fn>
  deleteBlob: ReturnType<typeof vi.fn>
  listBlobs: ReturnType<typeof vi.fn>
} {
  const store = {
    saveBlob: vi.fn().mockResolvedValue(undefined),
    loadBlob: vi.fn().mockResolvedValue(null),
    deleteBlob: vi.fn().mockResolvedValue(undefined),
    listBlobs: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
  return store as BlobStore & {
    saveBlob: ReturnType<typeof vi.fn>
    loadBlob: ReturnType<typeof vi.fn>
    deleteBlob: ReturnType<typeof vi.fn>
    listBlobs: ReturnType<typeof vi.fn>
  }
}

describe('restoreAssetBlobs', () => {
  let urlSeq: number
  let originalCreateObjectURL: PropertyDescriptor | undefined

  beforeEach(() => {
    urlSeq = 0
    // jsdom 未实现 URL.createObjectURL：注入可控桩并保留原描述符以便恢复
    originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => `blob:mock-${++urlSeq}`,
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
  })

  it('rebuilds objectUrls for ghost assets whose dedup key has a blob', async () => {
    const ghost = makeAsset({ id: 'ghost-1' })
    delete ghost.objectUrl
    const store = makeStore({
      listBlobs: vi.fn().mockResolvedValue([dedupKey('heart.png', 64, 'image')]),
      loadBlob: vi.fn().mockResolvedValue(new File([new Uint8Array(64)], 'heart.png')),
    })
    const result = await restoreAssetBlobs({ 'ghost-1': ghost }, store)
    expect(result.error).toBeNull()
    expect(result.objectUrls).toEqual({ 'ghost-1': 'blob:mock-1' })
    expect(store.loadBlob).toHaveBeenCalledWith(dedupKey('heart.png', 64, 'image'))
  })

  it('skips assets that already have an objectUrl (session-fresh)', async () => {
    const fresh = makeAsset({ id: 'fresh-1', objectUrl: 'blob:existing' })
    const store = makeStore({
      listBlobs: vi.fn().mockResolvedValue([dedupKey('heart.png', 64, 'image')]),
    })
    const result = await restoreAssetBlobs({ 'fresh-1': fresh }, store)
    expect(result.objectUrls).toEqual({})
    expect(store.loadBlob).not.toHaveBeenCalled()
  })

  it('skips assets without a matching blob key', async () => {
    const ghost = makeAsset({ id: 'ghost-1' })
    delete ghost.objectUrl
    const store = makeStore({
      listBlobs: vi.fn().mockResolvedValue([dedupKey('other.dcm', 8, 'dicom')]),
    })
    const result = await restoreAssetBlobs({ 'ghost-1': ghost }, store)
    expect(result.objectUrls).toEqual({})
    expect(store.loadBlob).not.toHaveBeenCalled()
  })

  it('degrades to null-url when the environment lacks createObjectURL', async () => {
    const ghost = makeAsset({ id: 'ghost-1' })
    delete ghost.objectUrl
    delete (URL as { createObjectURL?: unknown }).createObjectURL
    const store = makeStore({
      listBlobs: vi.fn().mockResolvedValue([dedupKey('heart.png', 64, 'image')]),
      loadBlob: vi.fn().mockResolvedValue(new File([new Uint8Array(64)], 'heart.png')),
    })
    const result = await restoreAssetBlobs({ 'ghost-1': ghost }, store)
    expect(result.objectUrls).toEqual({})
    expect(result.error).toBeNull()
  })

  it('skips a single failing asset without aborting the whole restore', async () => {
    const ghostA = makeAsset({ id: 'a', name: 'a.png' })
    delete ghostA.objectUrl
    const ghostB = makeAsset({ id: 'b', name: 'b.png', file: { fileName: 'b.png', fileSize: 8, fileType: '' } })
    delete ghostB.objectUrl
    const keyA = dedupKey('a.png', 64, 'image')
    const keyB = dedupKey('b.png', 8, 'image')
    const store = makeStore({
      listBlobs: vi.fn().mockResolvedValue([keyA, keyB]),
      loadBlob: vi.fn((key: string) =>
        key === keyA ? Promise.reject(new Error('read failed')) : Promise.resolve(new File([new Uint8Array(8)], 'b.png')),
      ),
    })
    const result = await restoreAssetBlobs({ a: ghostA, b: ghostB }, store)
    expect(result.error).toBeNull()
    expect(result.objectUrls).toEqual({ b: 'blob:mock-1' })
  })

  it('returns a readable error and no urls when the store is unavailable', async () => {
    const store = makeStore({
      listBlobs: vi.fn().mockRejectedValue(new Error('本地二进制存储不可用')),
    })
    const result = await restoreAssetBlobs({ a: makeAsset() }, store)
    expect(result.objectUrls).toEqual({})
    expect(result.error).toContain('不可用')
  })
})

describe('deleteAssetBlob', () => {
  it('deletes the blob by the asset dedup key', async () => {
    const store = makeStore()
    const asset = makeAsset({ kind: 'dicom', file: { fileName: 'scan.dcm', fileSize: 8, fileType: '' } })
    await deleteAssetBlob(asset, store)
    expect(store.deleteBlob).toHaveBeenCalledTimes(1)
    expect(store.deleteBlob).toHaveBeenCalledWith(dedupKey('scan.dcm', 8, 'dicom'))
  })

  it('swallows deletion failures (delete flow must not be blocked)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = makeStore({
      deleteBlob: vi.fn().mockRejectedValue(new Error('boom')),
    })
    await expect(deleteAssetBlob(makeAsset(), store)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
