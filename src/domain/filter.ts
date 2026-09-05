/**
 * 素材筛选纯函数（CR-001 T-004 / R-002）。
 *
 * 约定：
 * - 纯函数：不修改入参，返回新数组；各筛选条件之间为 AND 组合；
 * - 条件值为 null 表示该维度“全部”（不限制）；
 * - 名称搜索对关键字去首尾空白并忽略大小写，按子串匹配 asset.name；
 * - 标签选项列表来自标签注册表 ∪ 素材实际使用的标签，排序保证跨环境确定性。
 */
import type { AppState, Asset, AssetKind, AssetStatus } from './types.ts'

/** 筛选条件：每个维度为 null 表示不限制（“全部”） */
export interface AssetFilter {
  /** 素材类型；null = 全部类型 */
  kind: AssetKind | null
  /** 评审状态；null = 全部状态 */
  status: AssetStatus | null
  /** 标签名（精确匹配）；null = 全部标签 */
  tag: string | null
  /** 名称搜索关键字（大小写不敏感、去首尾空白；空白表示不搜索） */
  search: string
}

/** 默认筛选：不限制任何维度 */
export const DEFAULT_ASSET_FILTER: AssetFilter = {
  kind: null,
  status: null,
  tag: null,
  search: '',
}

/** 是否为默认（无任何限制）筛选 */
export function isDefaultAssetFilter(filter: AssetFilter): boolean {
  return (
    filter.kind === null &&
    filter.status === null &&
    filter.tag === null &&
    filter.search.trim() === ''
  )
}

/**
 * 按条件筛选素材（各条件 AND 组合，保持原顺序）：
 * - kind / status 为 null 表示全部；
 * - tag 为 null 表示全部，非 null 时素材必须携带该标签；
 * - search 去首尾空白并忽略大小写，按名称子串匹配；空白关键字不筛选。
 * 返回新数组，不修改入参。
 */
export function filterAssets(assets: readonly Asset[], filter: AssetFilter): Asset[] {
  const keyword = filter.search.trim().toLowerCase()
  return assets.filter((asset) => {
    if (filter.kind !== null && asset.kind !== filter.kind) return false
    if (filter.status !== null && asset.status !== filter.status) return false
    if (filter.tag !== null && !asset.tags.includes(filter.tag)) return false
    if (keyword !== '' && !asset.name.toLowerCase().includes(keyword)) return false
    return true
  })
}

/**
 * 汇总可选标签名：标签注册表 ∪ 素材实际使用的标签。
 * 按码点排序（避免 localeCompare 的跨环境差异，保证测试与界面顺序确定）；
 * 注册表中计数为 0 的条目仍列出，便于复用（见 review.ts removeAssetTag 的注册表保留约定）。
 */
export function collectTagNames(state: AppState): string[] {
  const names = new Set<string>()
  for (const tag of Object.values(state.tags)) names.add(tag.name)
  for (const asset of Object.values(state.assets)) {
    for (const tag of asset.tags) names.add(tag)
  }
  return Array.from(names).sort()
}
