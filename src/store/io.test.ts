import { describe, expect, it } from 'vitest'
import type { Asset, AppState, DicomMeta, ReviewHistory, Tag } from '../domain/types.ts'
import {
  buildExportFile,
  EXPORT_SCHEMA_VERSION,
  findNameConflicts,
  ImportFormatError,
  parseImportFile,
  serializeExport,
} from './io.ts'

const NOW = '2026-09-03T08:00:00.000Z'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'aorta.stl',
    kind: 'model',
    status: 'pending',
    tags: ['心脏'],
    note: '主动脉模型',
    source: '拖拽导入',
    file: { fileName: 'aorta.stl', fileSize: 1024, fileType: 'model/stl' },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeDicomMeta(overrides: Partial<DicomMeta> = {}): DicomMeta {
  return {
    modality: 'CT',
    sopClass: '1.2.840.10008.5.1.4.1.1.2',
    transferSyntax: '1.2.840.10008.1.2.1',
    rows: 512,
    columns: 512,
    pixelSpacing: [0.5, 0.5],
    seriesInstanceUID: '1.2.3.4',
    patientName: '',
    patientID: '',
    sliceCount: 3,
    deidentified: true,
    deidentificationMethod: 'Basic Profile',
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

function makeFullState(): AppState {
  return makeState(
    [
      makeAsset(),
      makeAsset({
        id: 'asset-2',
        name: 'phantom-1.dcm',
        kind: 'dicom',
        file: { fileName: 'phantom-1.dcm', fileSize: 2048, fileType: 'application/dicom' },
        dicomMeta: makeDicomMeta(),
      }),
    ],
    { 心脏: { name: '心脏', count: 1 } },
    {
      'asset-1': [{ status: 'passed', comment: '结构完整', createdAt: NOW }],
    },
  )
}

describe('export', () => {
  it('builds a file with schemaVersion, exportedAt and the full state', () => {
    const state = makeFullState()
    const file = buildExportFile(state, NOW)
    expect(file.schemaVersion).toBe(EXPORT_SCHEMA_VERSION)
    expect(file.schemaVersion).toBe(1)
    expect(file.exportedAt).toBe(NOW)
    expect(file.state).toEqual(state)
  })

  it('serializes pretty-printed JSON that parses back identically', () => {
    const text = serializeExport(makeFullState(), NOW)
    expect(text).toContain('\n  "schemaVersion": 1')
    expect(JSON.parse(text)).toEqual(buildExportFile(makeFullState(), NOW))
  })

  it('strips the session-only objectUrl field', () => {
    const file = buildExportFile(makeState([makeAsset({ objectUrl: 'blob:session' })]), NOW)
    expect(file.state.assets['asset-1']?.objectUrl).toBeUndefined()
    expect(serializeExport(makeState([makeAsset({ objectUrl: 'blob:session' })]), NOW)).not.toContain('blob:')
  })

  it('uses the current time for exportedAt when now is omitted', () => {
    expect(buildExportFile(makeState()).exportedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
  })
})

describe('parseImportFile round-trip', () => {
  it('restores the exported state', () => {
    const state = makeFullState()
    const restored = parseImportFile(serializeExport(state, NOW))
    expect(restored).toEqual(state)
  })

  it('strips objectUrl fields found in the file', () => {
    const file = JSON.stringify({
      schemaVersion: 1,
      exportedAt: NOW,
      state: {
        assets: { a1: { ...makeAsset({ id: 'a1' }), objectUrl: 'blob:stale' } },
        tags: {},
        reviews: {},
      },
    })
    const restored = parseImportFile(file)
    expect(restored.assets['a1']?.objectUrl).toBeUndefined()
  })
})

describe('parseImportFile rejects invalid files', () => {
  it('rejects text that is not valid JSON', () => {
    expect(() => parseImportFile('{not json')).toThrow(ImportFormatError)
    expect(() => parseImportFile('{not json')).toThrow(/不是有效的 JSON/)
  })

  it('rejects a top-level value that is not an object', () => {
    for (const text of ['[]', '"text"', '42']) {
      expect(() => parseImportFile(text)).toThrow(ImportFormatError)
      expect(() => parseImportFile(text)).toThrow(/顶层应为 JSON 对象/)
    }
  })

  it('rejects a mismatched or missing schemaVersion', () => {
    const wrongVersion = JSON.stringify({
      schemaVersion: 2,
      exportedAt: NOW,
      state: makeState(),
    })
    expect(() => parseImportFile(wrongVersion)).toThrow(ImportFormatError)
    expect(() => parseImportFile(wrongVersion)).toThrow(/schema 版本不符/)
    expect(() => parseImportFile(wrongVersion)).toThrow(/版本 1/)

    const stringVersion = JSON.stringify({
      schemaVersion: '1',
      exportedAt: NOW,
      state: makeState(),
    })
    expect(() => parseImportFile(stringVersion)).toThrow(/schema 版本不符/)

    const missingVersion = JSON.stringify({ exportedAt: NOW, state: makeState() })
    expect(() => parseImportFile(missingVersion)).toThrow(/schema 版本不符/)
    expect(() => parseImportFile(missingVersion)).toThrow(/缺失/)
  })

  it('rejects a missing or invalid exportedAt', () => {
    for (const exportedAt of [undefined, 123, '   ']) {
      const file = JSON.stringify({ schemaVersion: 1, exportedAt, state: makeState() })
      expect(() => parseImportFile(file)).toThrow(ImportFormatError)
      expect(() => parseImportFile(file)).toThrow(/exportedAt/)
    }
  })

  it('rejects an invalid state structure and reports every issue', () => {
    const file = JSON.stringify({
      schemaVersion: 1,
      exportedAt: NOW,
      state: {
        assets: {
          a1: {
            id: 'a1',
            name: 'x',
            kind: 'video', // 非法 kind
            status: 'done', // 非法 status
            tags: 'not-array',
            note: '',
            source: 's',
            file: { fileName: 'x', fileSize: -1, fileType: '' }, // fileSize 为负
            createdAt: '',
            updatedAt: '2026-09-01T00:00:00.000Z',
          },
        },
        tags: { bad: { name: 'bad', count: -2 } },
        reviews: { a1: 'not-an-array' },
      },
    })
    const act = (): AppState => parseImportFile(file)
    expect(act).toThrow(ImportFormatError)
    expect(act).toThrow(/数据结构校验未通过/)
    let issues: readonly string[] = []
    try {
      act()
    } catch (error) {
      issues = (error as ImportFormatError).issues
    }
    expect(issues.some((issue) => issue.includes('kind 应为'))).toBe(true)
    expect(issues.some((issue) => issue.includes('status 应为'))).toBe(true)
    expect(issues.some((issue) => issue.includes('tags 应为数组'))).toBe(true)
    expect(issues.some((issue) => issue.includes('fileSize 不应小于'))).toBe(true)
    expect(issues.some((issue) => issue.includes('createdAt 不应为空'))).toBe(true)
    expect(issues.some((issue) => issue.includes('count 不应小于'))).toBe(true)
    expect(issues.some((issue) => issue.includes('reviews[a1] 应为数组'))).toBe(true)
  })

  it('rejects an invalid dicomMeta (missing required verification fields)', () => {
    const file = JSON.stringify({
      schemaVersion: 1,
      exportedAt: NOW,
      state: {
        assets: {
          a1: {
            ...makeAsset({ id: 'a1', kind: 'dicom' }),
            dicomMeta: { modality: 'CT' }, // 缺 sliceCount / deidentified
          },
        },
        tags: {},
        reviews: {},
      },
    })
    expect(() => parseImportFile(file)).toThrow(/数据结构校验未通过/)
    try {
      parseImportFile(file)
    } catch (error) {
      const issues = (error as ImportFormatError).issues
      expect(issues.some((issue) => issue.includes('sliceCount 应为'))).toBe(true)
      expect(issues.some((issue) => issue.includes('deidentified 应为'))).toBe(true)
    }
  })

  it('round-trips the T-005 optional meta fields (instanceNumber / deidentifiedEvidence)', () => {
    const state = makeState([
      makeAsset({
        id: 'asset-2',
        kind: 'dicom',
        dicomMeta: makeDicomMeta({
          instanceNumber: 7,
          deidentifiedEvidence: ['patient-identity-removed', 'empty-patient-fields'],
        }),
      }),
    ])
    const restored = parseImportFile(serializeExport(state, NOW))
    expect(restored.assets['asset-2']?.dicomMeta?.instanceNumber).toBe(7)
    expect(restored.assets['asset-2']?.dicomMeta?.deidentifiedEvidence).toEqual([
      'patient-identity-removed',
      'empty-patient-fields',
    ])
  })

  it('rejects invalid T-005 optional meta fields', () => {
    const base = (dicomMeta: Record<string, unknown>): string =>
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: NOW,
        state: {
          assets: {
            a1: { ...makeAsset({ id: 'a1', kind: 'dicom' }), dicomMeta },
          },
          tags: {},
          reviews: {},
        },
      })
    for (const dicomMeta of [
      { sliceCount: 1, deidentified: false, instanceNumber: '7' },
      { sliceCount: 1, deidentified: false, instanceNumber: Number.NaN },
      { sliceCount: 1, deidentified: false, deidentifiedEvidence: 'not-array' },
      {
        sliceCount: 1,
        deidentified: false,
        deidentifiedEvidence: ['made-up-evidence'],
      },
    ]) {
      expect(() => parseImportFile(base(dicomMeta))).toThrow(/数据结构校验未通过/)
    }
  })
})

describe('findNameConflicts', () => {
  it('returns sorted unique names present in both states', () => {
    const current = makeState([
      makeAsset({ id: 'a1', name: 'aorta.stl' }),
      makeAsset({ id: 'a2', name: 'LV.stl' }),
    ])
    const incoming = makeState([
      makeAsset({ id: 'b1', name: 'aorta.stl' }),
      makeAsset({ id: 'b2', name: 'LA.stl' }),
      makeAsset({ id: 'b3', name: 'LV.stl' }),
    ])
    expect(findNameConflicts(current, incoming)).toEqual(['LV.stl', 'aorta.stl'])
  })

  it('returns an empty list when there is no overlap', () => {
    const current = makeState([makeAsset({ id: 'a1', name: 'aorta.stl' })])
    const incoming = makeState([makeAsset({ id: 'b1', name: 'LA.stl' })])
    expect(findNameConflicts(current, incoming)).toEqual([])
  })
})
