/**
 * 评审领域纯函数（CR-001 T-002 / R-005）。
 *
 * 约定：
 * - 全部为纯函数：不修改入参，返回新的 AppState（沿变更路径浅拷贝）；
 * - 评审历史为追加式（append-only）：每次状态变更或评审提交都追加一条留痕记录；
 * - 资产不存在或输入无效（如空白标签名）时原样返回入参状态（同一引用），不抛错，
 *   保证调用方（UI/存储层）不会因边界输入崩溃。
 */
import type { AppState, Asset, AssetStatus, ReviewHistory, ReviewRecord, Tag } from './types.ts'

/** 一次评审提交：目标状态 + 可选评审意见 */
export interface ReviewDecision {
  status: AssetStatus
  comment?: string
}

/** 归一化时间戳：缺省取当前时间 */
function toTimestamp(now?: string | Date): string {
  if (now === undefined) return new Date().toISOString()
  return typeof now === 'string' ? now : now.toISOString()
}

/** 统计当前使用某标签的素材数（以实际使用情况为准，可修复陈旧计数） */
function countTagUsage(assets: Record<string, Asset>, tagName: string): number {
  let count = 0
  for (const asset of Object.values(assets)) {
    if (asset.tags.includes(tagName)) count += 1
  }
  return count
}

/**
 * 提交一次评审：更新素材状态、追加评审历史记录并刷新 updatedAt（原子操作）。
 * 评审意见去除首尾空白，未填写时记为空字符串。
 */
export function applyReview(
  state: AppState,
  assetId: string,
  decision: ReviewDecision,
  now?: string | Date,
): AppState {
  const asset: Asset | undefined = state.assets[assetId]
  if (asset === undefined) return state
  const at = toTimestamp(now)
  const record: ReviewRecord = {
    status: decision.status,
    comment: decision.comment?.trim() ?? '',
    createdAt: at,
  }
  const history: ReviewHistory | undefined = state.reviews[assetId]
  const nextHistory: ReviewHistory = history === undefined ? [record] : [...history, record]
  return {
    assets: {
      ...state.assets,
      [assetId]: { ...asset, status: decision.status, updatedAt: at },
    },
    tags: state.tags,
    reviews: { ...state.reviews, [assetId]: nextHistory },
  }
}

/**
 * 仅变更素材状态：等价于不带意见的评审提交，同样在历史中留痕。
 */
export function setAssetStatus(
  state: AppState,
  assetId: string,
  status: AssetStatus,
  now?: string | Date,
): AppState {
  return applyReview(state, assetId, { status }, now)
}

/**
 * 为素材添加标签：标签名去除首尾空白；自建标签自动并入标签注册表，
 * 计数按实际使用情况重算。重复添加或空白标签名为 no-op（返回原状态引用）。
 */
export function addAssetTag(
  state: AppState,
  assetId: string,
  rawTagName: string,
  now?: string | Date,
): AppState {
  const asset: Asset | undefined = state.assets[assetId]
  if (asset === undefined) return state
  const tagName = rawTagName.trim()
  if (tagName === '' || asset.tags.includes(tagName)) return state
  const at = toTimestamp(now)
  const assets: Record<string, Asset> = {
    ...state.assets,
    [assetId]: { ...asset, tags: [...asset.tags, tagName], updatedAt: at },
  }
  return {
    assets,
    tags: {
      ...state.tags,
      [tagName]: { name: tagName, count: countTagUsage(assets, tagName) },
    },
    reviews: state.reviews,
  }
}

/**
 * 保存素材备注：更新 asset.note 并刷新 updatedAt。
 * 备注属于标注信息，不追加评审历史（历史仅记录评审结论）；
 * 内容与原值完全相同或素材不存在时为 no-op（返回原状态引用）。
 */
export function updateAssetNote(
  state: AppState,
  assetId: string,
  note: string,
  now?: string | Date,
): AppState {
  const asset: Asset | undefined = state.assets[assetId]
  if (asset === undefined || asset.note === note) return state
  const at = toTimestamp(now)
  return {
    assets: { ...state.assets, [assetId]: { ...asset, note, updatedAt: at } },
    tags: state.tags,
    reviews: state.reviews,
  }
}

/**
 * 移除素材标签：计数按实际使用情况重算，注册表保留条目（计数可为 0）便于复用。
 * 标签不存在或名称为空白时为 no-op（返回原状态引用）。
 */
export function removeAssetTag(
  state: AppState,
  assetId: string,
  rawTagName: string,
  now?: string | Date,
): AppState {
  const asset: Asset | undefined = state.assets[assetId]
  if (asset === undefined) return state
  const tagName = rawTagName.trim()
  if (tagName === '' || !asset.tags.includes(tagName)) return state
  const at = toTimestamp(now)
  const assets: Record<string, Asset> = {
    ...state.assets,
    [assetId]: {
      ...asset,
      tags: asset.tags.filter((tag) => tag !== tagName),
      updatedAt: at,
    },
  }
  const existing: Tag | undefined = state.tags[tagName]
  const tags: Record<string, Tag> =
    existing === undefined
      ? state.tags
      : { ...state.tags, [tagName]: { ...existing, count: countTagUsage(assets, tagName) } }
  return { assets, tags, reviews: state.reviews }
}
