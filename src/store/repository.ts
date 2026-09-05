/**
 * localStorage 仓储（CR-001 T-002 / R-005）。
 *
 * 单 key 存储完整 AppState（JSON 序列化）；key 内嵌 v1 版本号，
 * 未来的破坏性数据结构变更应递增 key 版本（旧数据自然回退空状态），而非改写字段含义。
 *
 * 容错策略：
 * - JSON 损坏 / 结构不符 → 回退空状态并标记 'corrupted'，绝不抛错；
 * - localStorage 不可访问（隐私模式等）→ 回退空状态并标记 'storage-unavailable'；
 * - 保存失败（容量满等）→ 抛出带可读中文消息的 RepositorySaveError，由 UI 捕获提示。
 */
import type { AppState, Asset } from '../domain/types.ts'

export const STORAGE_KEY = 'ag-review-workbench:v1'

/** 读取问题的可提示类型 */
export type LoadIssue = 'corrupted' | 'storage-unavailable'

export interface LoadResult {
  state: AppState
  /** null 表示正常读取（含无数据的空状态） */
  issue: LoadIssue | null
}

/** 保存失败（容量不足 / 存储不可用等）：message 为可直接展示的中文提示 */
export class RepositorySaveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RepositorySaveError'
  }
}

/** 空状态（每次返回新对象，避免共享引用被意外修改） */
export function createEmptyState(): AppState {
  return { assets: {}, tags: {}, reviews: {} }
}

/**
 * 剥离会话字段（objectUrl）后的可持久化状态。
 * 导出（store/io.ts）复用同一规则，保证“导出 → 导入 → 保存”的数据一致。
 */
export function toPersistableState(state: AppState): AppState {
  const assets: Record<string, Asset> = {}
  for (const [id, asset] of Object.entries(state.assets)) {
    if (asset.objectUrl === undefined) {
      assets[id] = asset
      continue
    }
    const persistable: Asset = { ...asset }
    delete persistable.objectUrl
    assets[id] = persistable
  }
  return { assets, tags: state.tags, reviews: state.reviews }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 轻量结构校验：localStorage 由本应用自身写入，只需防御性确认三大容器形状；
 * 不受信任的外部文件（导入 JSON）由 io.ts 做深度校验。
 */
function looksLikeAppState(value: unknown): value is AppState {
  return (
    isPlainRecord(value) &&
    isPlainRecord(value.assets) &&
    isPlainRecord(value.tags) &&
    isPlainRecord(value.reviews)
  )
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

/**
 * 读取并还原 AppState：
 * - 无数据或结构合法 → 正常返回（issue 为 null）；
 * - JSON 损坏 / 结构不符 → 回退空状态（issue: 'corrupted'），不抛错；
 * - localStorage 不可访问 → 回退空状态（issue: 'storage-unavailable'），不抛错。
 */
export function loadState(storage?: Storage): LoadResult {
  const store = resolveStorage(storage)
  if (store === null) return { state: createEmptyState(), issue: 'storage-unavailable' }
  let raw: string | null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    return { state: createEmptyState(), issue: 'storage-unavailable' }
  }
  if (raw === null) return { state: createEmptyState(), issue: null }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (looksLikeAppState(parsed)) return { state: toPersistableState(parsed), issue: null }
    return { state: createEmptyState(), issue: 'corrupted' }
  } catch {
    return { state: createEmptyState(), issue: 'corrupted' }
  }
}

/**
 * 保存完整 AppState（自动剥离会话字段）。
 * 容量不足或写入异常时抛出 RepositorySaveError（可读中文消息，保留 cause）。
 */
export function saveState(state: AppState, storage?: Storage): void {
  const store = resolveStorage(storage)
  if (store === null) {
    throw new RepositorySaveError('保存失败：浏览器本地存储不可用')
  }
  const payload = JSON.stringify(toPersistableState(state))
  try {
    store.setItem(STORAGE_KEY, payload)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new RepositorySaveError(
      `保存失败：本地存储容量不足或暂时不可用（${reason}）。可先“导出 JSON”备份评审数据。`,
      { cause: error },
    )
  }
}
