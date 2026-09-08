/**
 * 远程 AI 建议提供方 + provider 选择逻辑（CR-012 T-002 / R-028）。
 *
 * 远程契约（自定，见 AI_USAGE.md）：
 * - 请求：POST `{baseURL}/suggest`，头 `Authorization: Bearer <apiKey>`、
 *   `Content-Type: application/json`；
 * - body：`{ name, kind, dicomMeta?, file: { fileName, fileSize, fileType } }`——
 *   仅素材名称/类型/元数据，**不含文件二进制与像素数据**；
 * - 期望响应：`{ name?, tags?, summary? }`（字段均可选，缺失逐项降级）；
 * - 超时 10s（AbortController 中止）；非 2xx / 网络失败 / 超时 / JSON 或结构解析失败
 *   → 抛出 RemoteProviderError → 上层（AiPanel 的 fallbackProvider 机制）回退
 *   mockProvider 并在界面明示，provider 自身不做静默兜底。
 *
 * 选择逻辑（selectAiProvider）：设置.enabled && baseURL && apiKey 齐备 → remote
 * （fallbackToMock 时附带 mock 兜底），否则一律本地 Mock（provider 为 undefined，
 * 由 AiPanel 默认 mockProvider 承接）。
 */
import type { Asset } from '../../domain/types.ts'
import { mockProvider } from './mockProvider.ts'
import type { AIProvider, AiSuggestion } from './types.ts'
import type { ApiSettings } from '../settings/settingsStore.ts'

/** 默认超时（毫秒）：10 秒无响应视为失败 */
export const REMOTE_TIMEOUT_MS = 10_000

/** 远程调用失败（网络/超时/状态码/解析）：message 为可直接展示的中文提示，不携带 Key */
export class RemoteProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RemoteProviderError'
  }
}

export interface RemoteProviderConfig {
  /** 服务 Base URL（已去首尾空白与结尾斜杠） */
  baseURL: string
  /** API Key（仅用于 Authorization 头，不写入任何日志） */
  apiKey: string
  /** 超时毫秒数（缺省 10s；测试可注入更小值） */
  timeoutMs?: number
}

/** base URL 规整：去首尾空白与结尾 `/`，拼出 `{baseURL}/suggest` */
function suggestUrl(baseURL: string): string {
  return `${baseURL.trim().replace(/\/+$/, '')}/suggest`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 响应 → AiSuggestion 归一化：可选字段缺失逐项降级；结构不符抛 RemoteProviderError */
function normalizeSuggestion(payload: unknown): AiSuggestion {
  if (!isPlainObject(payload)) {
    throw new RemoteProviderError('远程 AI 服务响应结构不符合约定（应为对象）')
  }
  const rawName = payload.name
  const name = typeof rawName === 'string' && rawName.trim() !== '' ? rawName.trim() : null
  const rawTags = payload.tags
  const tags = Array.isArray(rawTags)
    ? [
        ...new Set(
          rawTags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter((tag) => tag !== ''),
        ),
      ]
    : []
  const rawSummary = payload.summary
  const summary = typeof rawSummary === 'string' ? rawSummary.trim() : ''
  return { name, tags, summary }
}

/** 创建远程 provider（每次设置变更创建新实例，捕获当时的 baseURL/apiKey） */
export function createRemoteProvider(config: RemoteProviderConfig): AIProvider {
  const url = suggestUrl(config.baseURL)
  const timeoutMs = config.timeoutMs ?? REMOTE_TIMEOUT_MS
  return {
    id: 'remote',
    label: '真实 API（远程服务）',
    async suggest(asset: Asset): Promise<AiSuggestion> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            name: asset.name,
            kind: asset.kind,
            ...(asset.kind === 'dicom' && asset.dicomMeta !== undefined
              ? { dicomMeta: asset.dicomMeta }
              : {}),
            file: {
              fileName: asset.file.fileName,
              fileSize: asset.file.fileSize,
              fileType: asset.file.fileType,
            },
          }),
          signal: controller.signal,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          throw new RemoteProviderError(`远程 AI 服务超时（${Math.round(timeoutMs / 1000)} 秒无响应）`, {
            cause: error,
          })
        }
        const reason = error instanceof Error ? error.message : String(error)
        throw new RemoteProviderError(`远程 AI 服务连接失败：${reason}`, { cause: error })
      } finally {
        clearTimeout(timer)
      }
      if (!response.ok) {
        throw new RemoteProviderError(`远程 AI 服务返回异常状态（HTTP ${response.status}）`)
      }
      let payload: unknown
      try {
        payload = await response.json()
      } catch (error) {
        throw new RemoteProviderError('远程 AI 服务响应不是有效的 JSON', { cause: error })
      }
      return normalizeSuggestion(payload)
    },
  }
}

/** provider 选择结果：provider 为 undefined 表示未配置远程（使用本地 Mock） */
export interface AiProviderSelection {
  /** 主 provider（undefined = 未启用/配置不完整 → AiPanel 默认 mockProvider） */
  provider: AIProvider | undefined
  /** 失败兜底 provider（仅 remote 已配置且 fallbackToMock 开启时为 mockProvider） */
  fallbackProvider: AIProvider | undefined
}

/**
 * 按设置选择 provider（纯函数）：
 * - 未启用 / baseURL 为空 / apiKey 为空 → 全本地 Mock（无兜底语义）；
 * - 启用且配置完整 → remote；fallbackToMock 开启时附带 mock 兜底（失败明示回退），
 *   关闭时失败按「暂无建议」降级（不悄悄换源）。
 */
export function selectAiProvider(settings: ApiSettings): AiProviderSelection {
  const baseURL = settings.baseURL.trim()
  const apiKey = settings.apiKey.trim()
  if (settings.enabled !== true || baseURL === '' || apiKey === '') {
    return { provider: undefined, fallbackProvider: undefined }
  }
  return {
    provider: createRemoteProvider({ baseURL, apiKey }),
    fallbackProvider: settings.fallbackToMock ? mockProvider : undefined,
  }
}
