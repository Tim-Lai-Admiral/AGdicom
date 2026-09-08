/**
 * 远程 AI provider 测试（CR-012 T-002 / R-028）。
 *
 * 覆盖任务卡 Test requirements 的 remote 部分（mock fetch，不发真实网络请求）：
 * - 成功：POST {baseURL}/suggest、Bearer 鉴权头、body 仅含名称/类型/元数据/文件描述
 *   （不含二进制）；响应归一化为 AiSuggestion；
 * - 部分响应：可选字段缺失逐项降级（name→null、tags 过滤去重、summary→''）；
 * - 失败分类：非 2xx / 连接失败 / 超时（AbortController）/ JSON 解析失败 /
 *   结构不符 → 抛 RemoteProviderError（错误消息不携带 API Key）；
 * - selectAiProvider：未启用/配置不完整 → 全本地 Mock；启用且配置完整 →
 *   remote（fallbackToMock 决定是否附带 mock 兜底）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import { mockProvider } from './mockProvider.ts'
import type { AiSuggestion } from './types.ts'
import {
  RemoteProviderError,
  createRemoteProvider,
  selectAiProvider,
} from './remoteProvider.ts'
import { DEFAULT_API_SETTINGS } from '../settings/settingsStore.ts'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'file1.dcm',
    kind: 'dicom',
    status: 'pending',
    tags: ['CT'],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'file1.dcm', fileSize: 524288, fileType: '' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    dicomMeta: {
      modality: 'CT',
      seriesInstanceUID: '1.2.840.10008',
      sliceCount: 12,
      deidentified: true,
    },
    ...overrides,
  }
}

interface CapturedRequest {
  url: unknown
  method: string | undefined
  headers: Record<string, string>
  body: string
  signal: AbortSignal
}

/** 记录请求参数并以给定响应应答的 fetch 替身 */
function stubFetch(respond: (request: CapturedRequest) => Promise<unknown>): {
  requests: CapturedRequest[]
} {
  const requests: CapturedRequest[] = []
  const fetchMock = vi.fn((_url: unknown, init: RequestInit): Promise<unknown> => {
    const request: CapturedRequest = {
      url: _url,
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: String(init.body ?? ''),
      signal: init.signal as AbortSignal,
    }
    requests.push(request)
    return respond(request)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { requests }
}

function jsonResponse(payload: unknown, ok = true, status = 200): Promise<unknown> {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(payload),
  } as Response)
}

const provider = createRemoteProvider({ baseURL: 'https://api.example.com/', apiKey: 'sk-secret-1' })

describe('remoteProvider（CR-012 T-002 / R-028）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功：POST {baseURL}/suggest + Bearer 头；body 仅含元数据（无二进制）', async () => {
    const { requests } = stubFetch(() =>
      jsonResponse({ name: 'CT 胸部序列', tags: ['CT', '胸部'], summary: '胸部 CT 序列。' }),
    )
    const suggestion = await provider.suggest(makeAsset())
    expect(suggestion).toEqual({
      name: 'CT 胸部序列',
      tags: ['CT', '胸部'],
      summary: '胸部 CT 序列。',
    })
    expect(requests).toHaveLength(1)
    const request = requests[0] as CapturedRequest
    expect(request.url).toBe('https://api.example.com/suggest') // 结尾斜杠已规整
    expect(request.method).toBe('POST')
    expect(request.headers.Authorization).toBe('Bearer sk-secret-1')
    expect(request.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(request.body) as Record<string, unknown>
    expect(body).toEqual({
      name: 'file1.dcm',
      kind: 'dicom',
      dicomMeta: { modality: 'CT', seriesInstanceUID: '1.2.840.10008', sliceCount: 12, deidentified: true },
      file: { fileName: 'file1.dcm', fileSize: 524288, fileType: '' },
    })
  })

  it('非 DICOM 素材不带 dicomMeta 字段；部分响应逐项降级并清洗标签', async () => {
    const { requests } = stubFetch(() =>
      jsonResponse({ name: '  ', tags: ['PNG', 'PNG', 42, '  胸片 '], extra: 'ignored' }),
    )
    const suggestion = await provider.suggest(
      makeAsset({ kind: 'image', file: { fileName: 'a.png', fileSize: 10, fileType: 'image/png' } }),
    )
    expect(requests[0]?.body).not.toContain('dicomMeta')
    expect(suggestion).toEqual({ name: null, tags: ['PNG', '胸片'], summary: '' })
  })

  it('非 2xx 抛 RemoteProviderError（含状态码，不含 API Key）', async () => {
    stubFetch(() => jsonResponse({ message: 'boom' }, false, 503))
    // suggest 契约允许返回 Promise（远程实现）；此处按远程形态收窄后断言拒绝
    const error = await (provider.suggest(makeAsset()) as Promise<AiSuggestion>).catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(RemoteProviderError)
    expect((error as Error).message).toContain('HTTP 503')
    expect((error as Error).message).not.toContain('sk-secret-1')
  })

  it('连接失败（fetch 拒绝）抛 RemoteProviderError', async () => {
    stubFetch(() => Promise.reject(new TypeError('network down')))
    await expect(provider.suggest(makeAsset())).rejects.toThrowError(/远程 AI 服务连接失败/)
  })

  it('超时：abort 后 fetch 拒绝 → 抛超时错误', async () => {
    const timely = createRemoteProvider({
      baseURL: 'https://api.example.com',
      apiKey: 'sk-secret-1',
      timeoutMs: 20, // 测试注入短超时，避免 fake timers
    })
    stubFetch(
      (request) =>
        new Promise((_resolve, reject) => {
          request.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted')
            abortError.name = 'AbortError'
            reject(abortError)
          })
        }),
    )
    await expect(timely.suggest(makeAsset())).rejects.toThrowError(/超时/)
  })

  it('JSON 解析失败（响应体非 JSON）抛 RemoteProviderError', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as Response),
    )
    await expect(provider.suggest(makeAsset())).rejects.toThrowError(/不是有效的 JSON/)
  })

  it('响应结构不符（数组/原始值）抛 RemoteProviderError', async () => {
    stubFetch(() => jsonResponse(['not', 'an', 'object']))
    await expect(provider.suggest(makeAsset())).rejects.toThrowError(/结构不符合约定/)
    stubFetch(() => jsonResponse('just a string'))
    await expect(provider.suggest(makeAsset())).rejects.toThrowError(/结构不符合约定/)
  })
})

describe('selectAiProvider（CR-012 T-002）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('未启用或配置不完整 → 无远程 provider（AiPanel 默认本地 Mock）', () => {
    expect(selectAiProvider(DEFAULT_API_SETTINGS)).toEqual({
      provider: undefined,
      fallbackProvider: undefined,
    })
    expect(
      selectAiProvider({ ...DEFAULT_API_SETTINGS, enabled: true, baseURL: 'https://x', apiKey: '' }),
    ).toEqual({ provider: undefined, fallbackProvider: undefined })
    expect(
      selectAiProvider({ ...DEFAULT_API_SETTINGS, enabled: true, baseURL: '  ', apiKey: 'k' }),
    ).toEqual({ provider: undefined, fallbackProvider: undefined })
  })

  it('启用且配置完整 → remote provider；fallbackToMock 开启时附带 mock 兜底', () => {
    const selection = selectAiProvider({
      baseURL: 'https://api.example.com',
      apiKey: 'sk-1',
      enabled: true,
      fallbackToMock: true,
    })
    expect(selection.provider?.id).toBe('remote')
    expect(selection.provider?.suggest(makeAsset())).toBeInstanceOf(Promise) // 远程为异步建议
    expect(selection.fallbackProvider).toBe(mockProvider)
  })

  it('启用但 fallbackToMock 关闭 → remote 失败不悄悄换源（无兜底）', () => {
    const selection = selectAiProvider({
      baseURL: 'https://api.example.com',
      apiKey: 'sk-1',
      enabled: true,
      fallbackToMock: false,
    })
    expect(selection.provider?.id).toBe('remote')
    expect(selection.fallbackProvider).toBeUndefined()
  })
})
