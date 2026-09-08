/**
 * AI 建议面板（CR-002 T-008 / R-006；CR-012 T-002 / R-028 扩展）。
 *
 * 嵌入评审面板的"AI 建议"区（评审按钮打开面板即可达）：
 * - 来源明示：标题旁徽标按实际生成来源展示——本地 Mock 规则为「Mock 生成」、
 *   远程服务（provider.id 'remote'）为「真实 API」，其余自定义 provider 展示其 label；
 *   远程失败回退 Mock 时徽标为「Mock 生成」并以提示文案明示回退（R-028 验收）；
 * - 异步建议（CR-012 T-002）：provider 可返回 Promise（远程 fetch），等待期间呈现
 *   加载态；同步 provider（Mock）行为与既有版本一致；
 * - 命名建议：点击"采纳命名"填入素材名称（上层重命名并持久化，绝不自动改名）；
 * - 标签建议：点击"采纳标签"把未存在的标签合并进素材（去重，复用上层添加标签链路）；
 * - 摘要：仅供参考展示，无采纳动作；
 * - 忽略：不产生任何变更（忽略后可重新查看，Mock 确定性规则下结果一致）。
 *
 * 交互参考 ReviewPanel：role="status" 反馈文案数秒后自动消失；
 * 建议生成异常（provider 抛错/拒绝且无 fallbackProvider，或兜底也失败）时显示
 * "暂无建议"，不崩溃、不影响素材数据。
 */
import { useEffect, useState } from 'react'
import type { Asset } from '../../domain/types.ts'
import { mockProvider } from './mockProvider.ts'
import type { AIProvider, AiSuggestion } from './types.ts'

/** 反馈自动消失的时长（与 ReviewPanel 一致） */
const FEEDBACK_MS = 3000

export interface AiPanelProps {
  /** 当前素材（建议的输入） */
  asset: Asset
  /** 建议提供方（缺省为内置 Mock provider；上层按设置注入远程实现，测试可注入） */
  provider?: AIProvider
  /**
   * 失败兜底提供方（CR-012 T-002）：主 provider 抛错/拒绝时尝试它，成功则
   * 徽标明示「Mock 生成」+ 回退提示；缺省或兜底也失败 → 按生成失败降级
   * （保持既有"暂无建议"行为，不影响既有注入用法的语义）。
   */
  fallbackProvider?: AIProvider
  /** 添加标签（合并去重与持久化由上层完成，与评审面板共用链路） */
  onAddTag: (tagName: string) => void
  /** 采纳命名建议（上层重命名并持久化；未提供时命名建议仅展示，不可采纳） */
  onAcceptName?: (name: string) => void
}

/** 一次建议生成结果：suggestion 为 null 表示生成失败或不可用；fallbackUsed 标记回退来源 */
interface Generation {
  suggestion: AiSuggestion | null
  failed: boolean
  fallbackUsed: boolean
}

/** 面板生成状态：loading = Promise 等待中；done = 已有结果（含失败降级） */
type PanelPhase = { phase: 'loading' } | { phase: 'done'; generation: Generation }

/** 失败降级结果（生成失败，未回退） */
const FAILED_GENERATION: Generation = { suggestion: null, failed: true, fallbackUsed: false }

function isPromise(value: AiSuggestion | Promise<AiSuggestion>): value is Promise<AiSuggestion> {
  return typeof (value as Promise<AiSuggestion>).then === 'function'
}

/**
 * 主 provider 失败后的同步兜底：尝试 fallbackProvider（当前为同步 Mock），
 * 成功 → 回退结果（fallbackUsed）；兜底也抛错/为异步/未提供 → 保持失败降级。
 */
function resolveFailure(
  primary: AIProvider,
  fallback: AIProvider | undefined,
  asset: Asset,
): Generation {
  if (fallback === undefined || fallback === primary) return FAILED_GENERATION
  try {
    const outcome = fallback.suggest(asset)
    if (isPromise(outcome)) return FAILED_GENERATION // 异步兜底不在本路径等待（当前 mock 为同步）
    return { suggestion: outcome, failed: false, fallbackUsed: true }
  } catch {
    return FAILED_GENERATION
  }
}

/** 来源徽标文案：按 provider.id 映射约定来源，未知 provider 展示其 label */
function sourceBadge(provider: AIProvider): string {
  if (provider.id === 'mock') return 'Mock 生成'
  if (provider.id === 'remote') return '真实 API'
  return provider.label
}

export default function AiPanel({
  asset,
  provider,
  fallbackProvider,
  onAddTag,
  onAcceptName,
}: AiPanelProps) {
  const resolvedProvider = provider ?? mockProvider
  const [ignored, setIgnored] = useState(false)
  const [attempt, setAttempt] = useState(0) // 重新生成计数（Mock 确定性规则下结果一致）
  const [feedback, setFeedback] = useState<string | null>(null)
  // 初始为加载态：同步 provider 在首个 effect 内即时出结果（act 内同步完成，
  // 既有同步用法的可观测行为不变），异步 provider 保持加载态直至 Promise 落定
  const [panel, setPanel] = useState<PanelPhase>({ phase: 'loading' })

  // 建议生成：同步结果即时呈现；Promise 呈现加载态，落定（含拒绝）后呈现结果。
  // provider/兜底/素材/重新生成任一变化时重跑；过期结果经 cancelled 丢弃（防串台）
  useEffect(() => {
    let cancelled = false
    let outcome: AiSuggestion | Promise<AiSuggestion>
    try {
      outcome = resolvedProvider.suggest(asset)
    } catch {
      if (!cancelled) {
        setPanel({ phase: 'done', generation: resolveFailure(resolvedProvider, fallbackProvider, asset) })
      }
      return () => {
        cancelled = true
      }
    }
    if (!isPromise(outcome)) {
      if (!cancelled) {
        setPanel({ phase: 'done', generation: { suggestion: outcome, failed: false, fallbackUsed: false } })
      }
      return () => {
        cancelled = true
      }
    }
    setPanel({ phase: 'loading' })
    outcome.then(
      (suggestion) => {
        if (!cancelled) {
          setPanel({ phase: 'done', generation: { suggestion, failed: false, fallbackUsed: false } })
        }
      },
      () => {
        // 远程失败：按设置回退 mock（明示）或降级为失败提示；素材数据不受影响
        if (!cancelled) {
          setPanel({ phase: 'done', generation: resolveFailure(resolvedProvider, fallbackProvider, asset) })
        }
      },
    )
    return () => {
      cancelled = true
    }
    // attempt 仅用于触发重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, resolvedProvider, fallbackProvider, attempt])

  // 切换素材时重置忽略/反馈状态
  useEffect(() => {
    setIgnored(false)
    setFeedback(null)
  }, [asset.id])

  // 反馈数秒后自动消失（卸载时清理定时器）
  useEffect(() => {
    if (feedback === null) return
    const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [feedback])

  const loading = panel.phase === 'loading'
  const generation: Generation = panel.phase === 'done' ? panel.generation : FAILED_GENERATION
  const suggestion = generation.suggestion
  // 标签建议中尚未加到素材上的标签（采纳时仅合并这些，重复忽略）
  const newTags =
    suggestion === null
      ? []
      : [...new Set(suggestion.tags)].filter((tag) => !asset.tags.includes(tag))
  // 命名建议是否可采纳：有建议、与当前名不同、且上层提供重命名链路
  const canAcceptName =
    suggestion?.name != null && suggestion.name !== asset.name && onAcceptName !== undefined

  // 徽标与提示：回退时明示「Mock 生成」+ 回退文案；否则按 provider 来源明示
  const badge = generation.fallbackUsed ? 'Mock 生成' : sourceBadge(resolvedProvider)
  const hint = generation.fallbackUsed
    ? '远程 AI 服务调用失败，本次建议已回退为本地 Mock 规则生成：请核对后采纳，也可忽略或重试。'
    : resolvedProvider.id === 'remote'
      ? '本区建议由远程 AI 服务（真实 API）生成：请求仅发送素材名称、类型与元数据（不含文件二进制），请核对后采纳，也可忽略或手动修改，均不影响素材数据。'
      : '本区建议由本地确定性规则（Mock）生成，非真实 AI、无网络调用：请核对后采纳，也可忽略或手动修改，均不影响素材数据。'

  const handleAcceptName = (): void => {
    if (suggestion?.name == null || !canAcceptName) return
    onAcceptName?.(suggestion.name)
    setFeedback('已采纳命名建议（可在需要时手动再改）')
  }

  const handleAcceptTags = (): void => {
    if (newTags.length === 0) return
    for (const tag of newTags) onAddTag(tag)
    setFeedback(`已合并 ${newTags.length} 个标签建议（可随时移除）`)
  }

  const handleIgnore = (): void => {
    // 忽略：仅收起本区建议，不产生任何数据变更（R-006）
    setIgnored(true)
    setFeedback('已忽略本次建议：未产生任何变更')
  }

  const handleRegenerate = (): void => {
    setIgnored(false)
    setAttempt((value) => value + 1)
  }

  return (
    <section className="ai-panel" aria-label="AI 建议">
      <h3 className="review-panel__section-title">
        AI 建议
        <span className="ai-panel__mock-badge">{badge}</span>
      </h3>
      <p className="ai-panel__hint">{hint}</p>

      {feedback !== null ? (
        <p className="review-panel__feedback" role="status">
          {feedback}
        </p>
      ) : null}

      {loading ? (
        <p className="ai-panel__empty" role="status">
          正在生成 AI 建议…
        </p>
      ) : ignored ? (
        <>
          <p className="ai-panel__empty">已忽略本次建议：未产生任何变更。</p>
          <button type="button" className="review-panel__save" onClick={handleRegenerate}>
            重新查看建议
          </button>
        </>
      ) : suggestion === null ? (
        <>
          <p className="ai-panel__empty">
            {generation.failed ? '暂无建议：生成失败，素材数据不受影响。' : '暂无建议。'}
          </p>
          <button type="button" className="review-panel__save" onClick={handleRegenerate}>
            重新生成
          </button>
        </>
      ) : (
        <>
          <div className="ai-panel__block">
            <p className="ai-panel__block-label">命名建议</p>
            <p className="ai-panel__name" title={suggestion.name ?? undefined}>
              {suggestion.name ?? '（无法给出命名建议）'}
            </p>
            {onAcceptName !== undefined ? (
              <button
                type="button"
                className="review-panel__save"
                disabled={!canAcceptName}
                onClick={handleAcceptName}
              >
                {canAcceptName ? '采纳命名（填入名称）' : '名称已符合建议'}
              </button>
            ) : null}
          </div>

          <div className="ai-panel__block">
            <p className="ai-panel__block-label">标签建议</p>
            {suggestion.tags.length > 0 ? (
              <ul className="review-panel__tag-list">
                {[...new Set(suggestion.tags)].map((tag) => (
                  <li key={tag} className="ai-panel__tag">
                    {tag}
                    {asset.tags.includes(tag) ? <span className="ai-panel__tag-note">（已存在）</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ai-panel__empty">（无标签建议）</p>
            )}
            <button
              type="button"
              className="review-panel__save"
              disabled={newTags.length === 0}
              onClick={handleAcceptTags}
            >
              {newTags.length > 0 ? `采纳标签（合并 ${newTags.length} 个）` : '标签均已存在'}
            </button>
          </div>

          <div className="ai-panel__block">
            <p className="ai-panel__block-label">摘要（仅供参考）</p>
            <p className="ai-panel__summary">{suggestion.summary}</p>
          </div>

          <div className="ai-panel__actions">
            <button type="button" className="review-panel__save" onClick={handleIgnore}>
              忽略建议
            </button>
            <button type="button" className="review-panel__save" onClick={handleRegenerate}>
              重新生成
            </button>
          </div>
        </>
      )}
    </section>
  )
}
