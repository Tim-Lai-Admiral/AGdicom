/**
 * App 启动二进制恢复集成测试（CR-006 T-003 / R-016）。
 *
 * 用 fake-indexeddb（jsdom 无 IndexedDB）+ 预置 localStorage 状态：
 * - 幽灵资产有同名去重键 blob → 启动自动重建 objectUrl（预览可见，无需重导入）；
 * - 删除素材 → IndexedDB blob 同步删除（无残留）；
 * - 恢复不落盘（objectUrl 仍为会话字段）。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import App from './App.tsx'
import type { Asset } from './domain/types.ts'
import { saveState, STORAGE_KEY } from './store/repository.ts'
import { defaultBlobStore } from './store/blobStore.ts'
import { dedupKey } from './features/library/importAssets.ts'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'a1',
    name: 'heart.png',
    kind: 'image',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
    createdAt: '2026-09-05T08:00:00.000Z',
    updatedAt: '2026-09-05T08:00:00.000Z',
    ...overrides,
  }
}

let urlSeq = 0
let originalCreateObjectURL: PropertyDescriptor | undefined

async function seedGhostWithBlob(asset: Asset): Promise<void> {
  const bytes = new Uint8Array(asset.file.fileSize)
  const file = new File([bytes], asset.file.fileName, { type: asset.file.fileType })
  await defaultBlobStore.saveBlob(dedupKey(asset.file.fileName, asset.file.fileSize, asset.kind), file)
  saveState({ assets: { [asset.id]: asset }, tags: {}, reviews: {} })
}

describe('App 启动二进制恢复（R-016）', () => {
  beforeEach(() => {
    localStorage.clear()
    globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory
    urlSeq = 0
    originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => `blob:mock-${++urlSeq}`,
      configurable: true,
      writable: true,
    })
  })

  afterEach(async () => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    if (originalCreateObjectURL === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    }
    localStorage.clear()
    delete (globalThis as { indexedDB?: unknown }).indexedDB
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })

  it('restores ghost asset objectUrls from IndexedDB on startup (preview visible)', async () => {
    await seedGhostWithBlob(makeAsset())
    const { container } = render(<App />)

    // 启动恢复提示
    await screen.findByText('已从本地恢复 1 个素材的预览（无需重新导入）')
    // 左栏行缩略图（objectUrl 重建）
    const thumb = container.querySelector('.asset-row__img') as HTMLImageElement
    expect(thumb).not.toBeNull()
    expect(thumb.src).toBe('blob:mock-1')
    // 点开中央查看区：图片预览可见（不再是“预览不可用”占位）
    fireEvent.click(screen.getByRole('button', { name: /选择“heart.png”加入比较/ }))
    const stageImg = (await screen.findByRole('figure', { name: '图片预览' })).querySelector(
      '.image-stage__img',
    ) as HTMLImageElement
    expect(stageImg).not.toBeNull()
    expect(stageImg.src).toBe('blob:mock-1')
    expect(screen.queryByText('图片预览不可用：会话失效，可重新导入或删除该素材')).toBeNull()
    // 恢复不落盘：objectUrl 仍为会话字段
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(
      (raw as { assets: Record<string, { objectUrl?: string }> }).assets['a1']?.objectUrl,
    ).toBeUndefined()
  })

  it('deletes the persisted blob together with the asset (no residue)', async () => {
    await seedGhostWithBlob(makeAsset())
    const { container } = render(<App />)
    await screen.findByText('已从本地恢复 1 个素材的预览（无需重新导入）')

    // 选中行 → 行内删除 → 二次确认
    fireEvent.click(screen.getByRole('button', { name: /选择“heart.png”加入比较/ }))
    fireEvent.click(screen.getByRole('button', { name: '删除素材 heart.png' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除“heart.png”' }))
    await waitFor(() => {
      expect(screen.queryByText('heart.png')).toBeNull()
    })
    // IndexedDB 无残留
    await waitFor(async () => {
      await expect(defaultBlobStore.listBlobs()).resolves.toEqual([])
    })
    expect(container.querySelector('.asset-row__img')).toBeNull()
  })

  it('keeps ghost assets untouched when no blob matches (no notice)', async () => {
    saveState({ assets: { a1: makeAsset() }, tags: {}, reviews: {} })
    render(<App />)
    // 无 blob 可恢复：不出现恢复提示（素材保持幽灵态，预览占位提示仍在）
    await waitFor(() => {
      expect(screen.getByText('heart.png')).toBeTruthy()
    })
    expect(screen.queryByText(/已从本地恢复/)).toBeNull()
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(screen.queryByText(/已从本地恢复/)).toBeNull()
  })
})
