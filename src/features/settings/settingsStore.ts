/**
 * AI API 设置存储（CR-012 T-002 / R-027、R-028）。
 *
 * 独立 localStorage key `ag-review-workbench:settings`：设置与素材评审数据
 * （`ag-review-workbench:v1`）完全隔离，**不进入 io.ts 导出 JSON**——
 * 导出文件仅含 AppState（素材/标签/评审），API Key 等敏感配置绝不随素材导出。
 *
 * 容错策略（与 store/repository.ts 同风格，绝不抛错读取）：
 * - JSON 损坏 / 结构不符 / 字段类型异常 → 逐字段回退默认值；
 * - localStorage 不可访问（隐私模式等）→ 返回默认值；
 * - 保存失败（容量满等）→ 抛出带可读中文消息的 SettingsSaveError，由上层提示。
 */

export const SETTINGS_STORAGE_KEY = 'ag-review-workbench:settings'

/** AI API 设置（R-027 四字段；enabled/fallbackToMock 为显式布尔，字符串等非法值按 false 处理） */
export interface ApiSettings {
  /** 服务 Base URL（保存时去首尾空白；请求地址为 `{baseURL}/suggest`） */
  baseURL: string
  /** API Key（仅存本机 localStorage；保存时去首尾空白；绝不写入日志/导出） */
  apiKey: string
  /** 是否启用远程 AI（默认关闭：未启用一律使用本地 Mock 规则） */
  enabled: boolean
  /** 远程调用失败时是否回退本地 Mock（默认 true：保证建议能力始终可用且界面明示） */
  fallbackToMock: boolean
}

/** 默认设置：远程 AI 默认关闭；回退 Mock 默认开启（失败安全兜底） */
export const DEFAULT_API_SETTINGS: ApiSettings = {
  baseURL: '',
  apiKey: '',
  enabled: false,
  fallbackToMock: true,
}

/** 保存失败（存储不可用 / 容量不足等）：message 为可直接展示的中文提示 */
export class SettingsSaveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SettingsSaveError'
  }
}

/** 未显式传入 storage 时使用全局 localStorage；访问异常（如沙箱 iframe）时返回 null */
function resolveStorage(explicit?: Storage): Storage | null {
  if (explicit !== undefined) return explicit
  try {
    const storage: Storage | undefined = globalThis.localStorage
    return storage === undefined ? null : storage
  } catch {
    return null
  }
}

/** 逐字段防御性归一化：结构不符（非对象/数组/null）返回 null（调用方回退默认值） */
function sanitizeSettings(value: unknown): ApiSettings | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  return {
    baseURL: typeof raw.baseURL === 'string' ? raw.baseURL : DEFAULT_API_SETTINGS.baseURL,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : DEFAULT_API_SETTINGS.apiKey,
    enabled: raw.enabled === true,
    fallbackToMock: raw.fallbackToMock !== false,
  }
}

/**
 * 读取设置：
 * - 无数据 → 默认值（不视为异常）；
 * - JSON 损坏 / 结构不符 → 默认值（console.warn 提示，不输出任何字段内容）；
 * - localStorage 不可访问 → 默认值。
 */
export function loadSettings(storage?: Storage): ApiSettings {
  const store = resolveStorage(storage)
  if (store === null) return { ...DEFAULT_API_SETTINGS }
  let raw: string | null
  try {
    raw = store.getItem(SETTINGS_STORAGE_KEY)
  } catch {
    return { ...DEFAULT_API_SETTINGS }
  }
  if (raw === null) return { ...DEFAULT_API_SETTINGS }
  try {
    return sanitizeSettings(JSON.parse(raw)) ?? { ...DEFAULT_API_SETTINGS }
  } catch {
    console.warn('AI 设置数据异常，已恢复默认配置')
    return { ...DEFAULT_API_SETTINGS }
  }
}

/**
 * 保存设置（baseURL/apiKey 去首尾空白后写入）。
 * 存储不可用或写入异常时抛出 SettingsSaveError（可读中文消息，保留 cause）。
 */
export function saveSettings(settings: ApiSettings, storage?: Storage): void {
  const store = resolveStorage(storage)
  if (store === null) {
    throw new SettingsSaveError('设置保存失败：浏览器本地存储不可用')
  }
  const payload: ApiSettings = {
    baseURL: settings.baseURL.trim(),
    apiKey: settings.apiKey.trim(),
    enabled: settings.enabled === true,
    fallbackToMock: settings.fallbackToMock === true,
  }
  try {
    store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new SettingsSaveError(`设置保存失败：本地存储容量不足或暂时不可用（${reason}）`, {
      cause: error,
    })
  }
}
