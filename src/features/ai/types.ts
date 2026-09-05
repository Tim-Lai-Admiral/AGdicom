/**
 * AI 能力契约（CR-002 T-008 / R-006）。
 *
 * 本文件是 AI 建议能力的公共接口：面板与上层只依赖 AIProvider 抽象，
 * 不感知具体实现（当前为 Mock 确定性规则，未来可替换为真实 AI 服务）。
 * 字段一经发布不得静默变更。
 */
import type { Asset } from '../../domain/types.ts'

/** 一次 AI 建议：命名 + 标签 + 摘要（name 可为 null，tags 可为空数组，面板降级展示） */
export interface AiSuggestion {
  /** 建议名称（null = 该素材无法给出命名建议） */
  name: string | null
  /** 建议标签（建议合并进素材时需去重） */
  tags: string[]
  /** 素材关键信息的一句话概述（仅供参考，无采纳动作） */
  summary: string
}

/**
 * AI 建议提供方接口：输入素材（含元数据），输出一组建议。
 * 实现须为纯计算（无网络调用、无副作用），保证同输入同输出（R-006 确定性）。
 */
export interface AIProvider {
  /** 提供方标识（如 'mock'；接入真实服务时用新 id 并在界面明示来源） */
  readonly id: string
  /** 提供方展示名（面板用于明示建议来源，如 "Mock（本地规则）"） */
  readonly label: string
  /** 基于素材元数据生成建议；实现内部异常应自行兜底，面板同时对抛错降级 */
  suggest(asset: Asset): AiSuggestion
}
