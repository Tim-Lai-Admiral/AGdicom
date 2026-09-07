import { describe, expect, it } from 'vitest'
import type { Asset, AppState } from '../../domain/types.ts'
import {
  classifyImportFiles,
  EXTENSION_KIND_MAP,
  extensionOf,
  kindForFileName,
  SUPPORTED_TYPES_HINT,
} from './importAssets.ts'
import type { ClassifyOptions } from './importAssets.ts'

const NOW = '2026-09-03T08:00:00.000Z'

let idSeq = 0

/** 注入固定时间与 ID 工厂，保证断言确定性 */
function makeOptions(source?: string): ClassifyOptions {
  return {
    now: NOW,
    createId: () => `new-${++idSeq}`,
    ...(source !== undefined ? { source } : {}),
  }
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
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
    ...overrides,
  }
}

function makeState(assets: Asset[] = []): AppState {
  const assetMap: Record<string, Asset> = {}
  for (const asset of assets) assetMap[asset.id] = asset
  return { assets: assetMap, tags: {}, reviews: {} }
}

describe('extensionOf', () => {
  it('extracts the lowercased extension after the last dot', () => {
    expect(extensionOf('aorta.stl')).toBe('stl')
    expect(extensionOf('photo.PNG')).toBe('png')
    expect(extensionOf('scan.001.dcm')).toBe('dcm')
  })

  it('returns empty string for names without a usable extension', () => {
    expect(extensionOf('noext')).toBe('')
    expect(extensionOf('.gitignore')).toBe('')
    expect(extensionOf('trailing.')).toBe('')
  })
})

describe('kindForFileName', () => {
  it('covers exactly the extensions required by R-001', () => {
    expect([...Object.keys(EXTENSION_KIND_MAP)].sort()).toEqual(
      ['bmp', 'dcm', 'gif', 'glb', 'gltf', 'jpeg', 'jpg', 'obj', 'png', 'stl', 'webp'].sort(),
    )
  })

  it('classifies image extensions case-insensitively', () => {
    for (const name of ['a.png', 'b.jpg', 'c.jpeg', 'd.gif', 'e.webp', 'f.bmp', 'g.PNG']) {
      expect(kindForFileName(name)).toBe('image')
    }
  })

  it('classifies dicom and model extensions', () => {
    expect(kindForFileName('scan.dcm')).toBe('dicom')
    expect(kindForFileName('heart.DCM')).toBe('dicom')
    for (const name of ['aorta.stl', 'mesh.obj', 'scene.glb', 'scene.gltf']) {
      expect(kindForFileName(name)).toBe('model')
    }
  })

  it('returns null for unknown or missing extensions', () => {
    expect(kindForFileName('readme.txt')).toBeNull()
    expect(kindForFileName('virus.exe')).toBeNull()
    expect(kindForFileName('noext')).toBeNull()
    expect(kindForFileName('archive.tar.gz')).toBeNull()
  })
})

describe('classifyImportFiles', () => {
  it('registers one asset per supported kind with pending status and injected timestamps', () => {
    const result = classifyImportFiles(
      makeState(),
      [
        { fileName: 'heart.png', fileSize: 100, fileType: 'image/png' },
        { fileName: 'scan.dcm', fileSize: 200, fileType: '' },
        { fileName: 'aorta.stl', fileSize: 300, fileType: '' },
      ],
      makeOptions(),
    )
    expect(result.created).toHaveLength(3)
    expect(result.duplicates).toHaveLength(0)
    expect(result.unknown).toHaveLength(0)
    for (const asset of result.created) {
      expect(asset.status).toBe('pending')
      expect(asset.tags).toEqual([])
      expect(asset.note).toBe('')
      expect(asset.createdAt).toBe(NOW)
      expect(asset.updatedAt).toBe(NOW)
    }
    expect(result.created.map((asset) => asset.kind)).toEqual(['image', 'dicom', 'model'])
    // 状态与返回的 created 一致：每个新素材都按其 id 注册
    for (const asset of result.created) {
      expect(result.state.assets[asset.id]).toBe(asset)
    }
    expect(Object.values(result.state.assets)).toHaveLength(3)
  })

  it('records source, generated id and file info on created assets', () => {
    const result = classifyImportFiles(
      makeState(),
      [{ fileName: 'heart.png', fileSize: 10, fileType: 'image/png' }],
      makeOptions('文件选择导入'),
    )
    const asset = result.created[0]
    expect(asset?.source).toBe('文件选择导入')
    expect(asset?.id).toMatch(/^new-\d+$/)
    expect(asset?.name).toBe('heart.png')
    expect(asset?.file).toEqual({ fileName: 'heart.png', fileSize: 10, fileType: 'image/png' })
  })

  it('defaults source to 拖拽导入 when omitted', () => {
    const result = classifyImportFiles(
      makeState(),
      [{ fileName: 'heart.png', fileSize: 10, fileType: '' }],
      makeOptions(),
    )
    expect(result.created[0]?.source).toBe('拖拽导入')
  })

  it('rejects unknown extensions with an explicit message and registers nothing', () => {
    const base = makeState()
    const result = classifyImportFiles(
      base,
      [
        { fileName: 'readme.txt', fileSize: 10, fileType: 'text/plain' },
        { fileName: 'noext', fileSize: 10, fileType: '' },
      ],
      makeOptions(),
    )
    expect(result.created).toHaveLength(0)
    expect(result.unknown).toHaveLength(2)
    expect(result.unknown[0]?.extension).toBe('txt')
    expect(result.unknown[0]?.message).toContain('readme.txt')
    expect(result.unknown[0]?.message).toContain(SUPPORTED_TYPES_HINT)
    expect(result.unknown[1]?.extension).toBe('')
    // 无新增时状态保持同一引用（未发生修改）
    expect(result.state).toBe(base)
  })

  it('detects duplicates against existing assets by fileName + fileSize + kind', () => {
    const base = makeState([
      makeAsset({
        file: { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
        kind: 'model',
        objectUrl: 'blob:existing', // 非幽灵：objectUrl 可用 → 命中即重复
      }),
    ])
    const result = classifyImportFiles(
      base,
      [{ fileName: 'aorta.stl', fileSize: 512, fileType: '' }],
      makeOptions(),
    )
    expect(result.created).toHaveLength(0)
    expect(result.hydrated).toHaveLength(0)
    expect(result.duplicates).toEqual([
      { fileName: 'aorta.stl', fileSize: 512, kind: 'model' },
    ])
    expect(result.state).toBe(base)
  })

  it('detects duplicates within a single batch', () => {
    const result = classifyImportFiles(
      makeState(),
      [
        { fileName: 'heart.png', fileSize: 5, fileType: '' },
        { fileName: 'heart.png', fileSize: 5, fileType: '' },
      ],
      makeOptions(),
    )
    expect(result.created).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0]).toEqual({
      fileName: 'heart.png',
      fileSize: 5,
      kind: 'image',
    })
  })

  it('treats same name with different size as different files', () => {
    const result = classifyImportFiles(
      makeState(),
      [
        { fileName: 'heart.png', fileSize: 5, fileType: '' },
        { fileName: 'heart.png', fileSize: 6, fileType: '' },
      ],
      makeOptions(),
    )
    expect(result.created).toHaveLength(2)
    expect(result.duplicates).toHaveLength(0)
  })

  it('handles a mixed batch into all three outcome lists', () => {
    const base = makeState([
      makeAsset({
        id: 'existing-2',
        name: 'scan.dcm',
        kind: 'dicom',
        file: { fileName: 'scan.dcm', fileSize: 2048, fileType: '' },
        objectUrl: 'blob:existing-2', // 非幽灵：命中按重复处理
      }),
    ])
    const result = classifyImportFiles(
      base,
      [
        { fileName: 'heart.png', fileSize: 10, fileType: 'image/png' }, // 成功
        { fileName: 'scan.dcm', fileSize: 2048, fileType: '' }, // 重复
        { fileName: 'notes.txt', fileSize: 3, fileType: 'text/plain' }, // 未知
      ],
      makeOptions(),
    )
    expect(result.created).toHaveLength(1)
    expect(result.hydrated).toHaveLength(0)
    expect(result.duplicates).toHaveLength(1)
    expect(result.unknown).toHaveLength(1)
    expect(Object.values(result.state.assets)).toHaveLength(2)
  })

  it('does not mutate the input state', () => {
    const base = makeState([
      makeAsset({ file: { fileName: 'old.stl', fileSize: 1, fileType: '' }, kind: 'model' }),
    ])
    const snapshot = JSON.stringify(base)
    classifyImportFiles(base, [{ fileName: 'new.stl', fileSize: 2, fileType: '' }], makeOptions())
    expect(JSON.stringify(base)).toBe(snapshot)
    expect(Object.keys(base.assets)).toHaveLength(1)
  })
})

describe('classifyImportFiles 幽灵水合（CR-006 R-014）', () => {
  it('reports a ghost hit as hydration instead of a duplicate', () => {
    const base = makeState([
      makeAsset({
        id: 'ghost-1',
        name: 'aorta.stl',
        file: { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
        kind: 'model',
        // 无 objectUrl：刷新后会话字段丢失的幽灵资产
      }),
    ])
    const result = classifyImportFiles(
      base,
      [{ fileName: 'aorta.stl', fileSize: 512, fileType: '' }],
      makeOptions(),
    )
    expect(result.created).toHaveLength(0)
    expect(result.duplicates).toHaveLength(0)
    expect(result.hydrated).toEqual([
      { assetId: 'ghost-1', fileName: 'aorta.stl', fileSize: 512, kind: 'model' },
    ])
    // 不新增记录、不修改入参：水合回写由 useImport 负责
    expect(result.state).toBe(base)
    expect(Object.keys(base.assets)).toEqual(['ghost-1'])
  })

  it('keeps non-ghost hits as duplicates', () => {
    const base = makeState([
      makeAsset({
        id: 'alive-1',
        name: 'heart.png',
        kind: 'image',
        file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
        objectUrl: 'blob:alive-1',
      }),
    ])
    const result = classifyImportFiles(
      base,
      [{ fileName: 'heart.png', fileSize: 64, fileType: 'image/png' }],
      makeOptions(),
    )
    expect(result.hydrated).toHaveLength(0)
    expect(result.duplicates).toEqual([{ fileName: 'heart.png', fileSize: 64, kind: 'image' }])
    expect(result.state).toBe(base)
  })

  it('handles a mixed batch with created, hydrated, duplicate and unknown in one call', () => {
    const base = makeState([
      makeAsset({
        id: 'ghost-1',
        name: 'aorta.stl',
        file: { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
        kind: 'model',
      }),
      makeAsset({
        id: 'alive-1',
        name: 'scan.dcm',
        kind: 'dicom',
        file: { fileName: 'scan.dcm', fileSize: 2048, fileType: '' },
        objectUrl: 'blob:alive-1',
      }),
    ])
    const result = classifyImportFiles(
      base,
      [
        { fileName: 'heart.png', fileSize: 10, fileType: 'image/png' }, // 新建
        { fileName: 'aorta.stl', fileSize: 512, fileType: '' }, // 幽灵 → 水合
        { fileName: 'scan.dcm', fileSize: 2048, fileType: '' }, // 非幽灵 → 重复
        { fileName: 'notes.txt', fileSize: 3, fileType: 'text/plain' }, // 未知
      ],
      makeOptions(),
    )
    expect(result.created).toHaveLength(1)
    expect(result.created[0]?.id).toMatch(/^new-\d+$/)
    expect(result.hydrated).toEqual([
      { assetId: 'ghost-1', fileName: 'aorta.stl', fileSize: 512, kind: 'model' },
    ])
    expect(result.duplicates).toEqual([{ fileName: 'scan.dcm', fileSize: 2048, kind: 'dicom' }])
    expect(result.unknown).toHaveLength(1)
    // 仅新增 1 条记录：水合不产生新资产
    const keys = Object.keys(result.state.assets)
    expect(keys).toHaveLength(3)
    expect(keys).toContain('alive-1')
    expect(keys).toContain('ghost-1')
    expect(keys).toContain(result.created[0]?.id)
  })

  it('hydrates the same ghost key once per batch and treats later hits as duplicates', () => {
    const base = makeState([
      makeAsset({
        id: 'ghost-1',
        name: 'aorta.stl',
        file: { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
        kind: 'model',
      }),
    ])
    const result = classifyImportFiles(
      base,
      [
        { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
        { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
      ],
      makeOptions(),
    )
    expect(result.hydrated).toEqual([
      { assetId: 'ghost-1', fileName: 'aorta.stl', fileSize: 512, kind: 'model' },
    ])
    expect(result.duplicates).toEqual([{ fileName: 'aorta.stl', fileSize: 512, kind: 'model' }])
    expect(result.created).toHaveLength(0)
  })

  it('does not mutate the input state during a hydration-only batch', () => {
    const base = makeState([
      makeAsset({
        id: 'ghost-1',
        name: 'aorta.stl',
        file: { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
        kind: 'model',
      }),
    ])
    const snapshot = JSON.stringify(base)
    const result = classifyImportFiles(
      base,
      [{ fileName: 'aorta.stl', fileSize: 512, fileType: '' }],
      makeOptions(),
    )
    expect(JSON.stringify(base)).toBe(snapshot)
    expect(result.state).toBe(base)
  })
})
