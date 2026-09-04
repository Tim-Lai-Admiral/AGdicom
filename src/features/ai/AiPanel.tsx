/**
 * AI 建议面板（CR-002 T-008 / R-006）。
 *
 * 嵌入评审面板的"AI 建议"区（评审按钮打开面板即可达）：
 * - 明示"Mock 生成"：建议由本地确定性规则产生，非真实 AI，无网络调用；
 * - 命名建议：点击"采纳命名"填入素材名称（上层重命名并持久化，绝不自动改名）；
 * - 标签建议：点击"采纳标签"把未存在的标签合并进素材（去重，复用上层添加标签链路）；
 * - 摘要：仅供参考展示，无采纳动作；
 * - 忽略：不产生任何变更（忽略后可重新查看，确定性规则下结果一致）。
 *
 * 交互参考 ReviewPanel：role="status" 反馈文案数秒后自动消失；
 * 建议生成异常（provider 抛错）时显示"暂无建议"，不崩溃、不影响素材数据。
 */
import { useEffect, useMemo, useState } from 'react'
import type { Asset } from '../../domain/types.ts'
import { mockProvider } from './mockProvider.ts'
import type { AIProvider, AiSuggestion } from './types.ts'

/** 反馈自动消失的时长（与 ReviewPanel 一致） */
const FEEDBACK_MS = 3000

export interface AiPanelProps {
  /** 当前素材（建议的输入） */
  asset: Asset
  /** 建议提供方（缺省为内置 Mock provider；测试可注入抛错实现验证降级） */
  provider?: AIProvider
  /** 添加标签（合并去重与持久化由上层完成，与评审面板共用链路） */
  onAddTag: (tagName: string) => void
  /** 采纳命名建议（上层重命名并持久化；未提供时命名建议仅展示，不可采纳） */
  onAcceptName?: (name: string) => void
}

/** 一次建议生成结果：suggestion 为 null 表示生成失败或不可用 */
interface Generation {
  suggestion: AiSuggestion | null
  failed: boolean
}

function generate(provider: AIProvider, asset: Asset): Generation {
  try {
    const suggestion = provider.suggest(asset)
    return { suggestion, failed: false }
  } catch {
    // 生成异常：降级为空建议，面板与素材数据均不受影响（R-006 验收）
    return { suggestion: null, failed: true }
  }
}

export default function AiPanel({ asset, provider, onAddTag, onAcceptName }: AiPanelProps) {
  const resolvedProvider = provider ?? mockProvider
  const [ignored, setIgnored] = useState(false)
  const [attempt, setAttempt] = useState(0) // 重新生成计数（确定性规则下结果一致）
  const [feedback, setFeedback] = useState<string | null>(null)

  // 建议生成：纯计算 + 异常兜底；素材或提供方变化时重算
  const generation = useMemo<Generation>(
    () => generate(resolvedProvider, asset),
    // attempt 仅用于触发重新生成（确定性规则下结果一致）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asset, resolvedProvider, attempt],
  )

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

  const suggestion = generation.suggestion
  // 标签建议中尚未加到素材上的标签（采纳时仅合并这些，重复忽略）
  const newTags =
    suggestion === null
      ? []
      : [...new Set(suggestion.tags)].filter((tag) => !asset.tags.includes(tag))
  // 命名建议是否可采纳：有建议、与当前名不同、且上层提供重命名链路
  const canAcceptName =
    suggestion?.name != null && suggestion.name !== asset.name && onAcceptName !== undefined

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
        <span className="ai-panel__mock-badge">Mock 生成</span>
      </h3>
      <p className="ai-panel__hint">
        本区建议由本地确定性规则（Mock）生成，非真实 AI、无网络调用：请核对后采纳，也可忽略或手动修改，均不影响素材数据。
      </p>

      {feedback !== null ? (
        <p className="review-panel__feedback" role="status">
          {feedback}
        </p>
      ) : null}

      {ignored ? (
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
