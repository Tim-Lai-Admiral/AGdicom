/**
 * 评审面板（CR-001 T-007 / R-005）。
 *
 * 工作台右栏信息面板内嵌（非路由、非模态，可与查看器并存——查看器位于中央区，
 * 互不覆盖；CR-003 T-002 布局壳 / T-004 归位）：
 * - 评审结论：状态单选（待评审/通过/驳回，草稿态，随外部变更同步）+
 *   评审意见 → “保存评审”一次提交（每次保存追加一条评审历史并留痕）；
 *   CR-004 T-001 起状态修改入口唯一：选中素材 → 本面板（左栏行内状态仅展示）。
 * - 标签：当前标签可移除；输入框可新建自建标签（由领域层自动并入全局标签库）；
 *   全局标签库（注册表 ∪ 实际使用）一键复用；
 * - 备注：独立保存（不追加评审历史）；
 * - AI 建议：内嵌 AiPanel（CR-002 T-008 / R-006，Mock 生成，采纳命名/标签或忽略）；
 * - 评审历史：ReviewHistory 只读列表（最新在前）；
 * - 删除素材：面板末尾入口 + 内联二次确认（CR-006 T-001 / R-015）。
 *
 * 交互与可访问性：Esc 关闭；可折叠为仅标题栏（aria-expanded）；
 * 保存成功以 role="status" 文案反馈并数秒后自动消失。
 * 领域计算与持久化（saveState）由上层（App）完成；保存失败提示由 App 呈现。
 */
import { useEffect, useRef, useState } from 'react'
import type { Asset, AssetStatus, ReviewHistory as ReviewHistoryData } from '../../domain/types.ts'
import { ASSET_KIND_LABELS, ASSET_STATUS_LABELS } from '../../domain/types.ts'
import AiPanel from '../ai/AiPanel.tsx'
import StatusDot from '../library/StatusDot.tsx'
import ReviewHistory from './ReviewHistory.tsx'

/** 状态单选的固定顺序（与状态徽标循环一致） */
const STATUS_OPTIONS: readonly AssetStatus[] = ['pending', 'passed', 'rejected']

/** 保存反馈自动消失的时长 */
const FEEDBACK_MS = 3000

export interface ReviewPanelProps {
  /** 当前评审的素材 */
  asset: Asset
  /** 该素材的追加式评审历史（undefined = 无历史） */
  history: ReviewHistoryData | undefined
  /** 全局标签库名单（注册表 ∪ 实际使用），供一键复用 */
  tagNames: readonly string[]
  /** 添加标签（含自建；注册表合并与持久化由上层完成） */
  onAddTag: (tagName: string) => void
  /** 移除标签（持久化由上层完成） */
  onRemoveTag: (tagName: string) => void
  /** 提交一次评审：更新状态 + 追加历史（持久化由上层完成） */
  onSubmitReview: (status: AssetStatus, comment: string) => void
  /** 保存备注（不追加评审历史，持久化由上层完成） */
  onSaveNote: (note: string) => void
  /** 采纳 AI 命名建议：重命名素材（持久化由上层完成；缺省时命名建议仅展示） */
  onAcceptAiName?: (name: string) => void
  /** 删除素材（CR-006 T-001 / R-015，二次确认由面板内联确认态完成，
   *  级联清理与持久化由上层负责）；缺省时不渲染删除入口（既有调用方不受影响） */
  onDeleteAsset?: () => void
  /** 关闭面板（“关闭”按钮与 Esc 键均触发） */
  onClose: () => void
}

export default function ReviewPanel({
  asset,
  history,
  tagNames,
  onAddTag,
  onRemoveTag,
  onSubmitReview,
  onSaveNote,
  onAcceptAiName,
  onDeleteAsset,
  onClose,
}: ReviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [draftStatus, setDraftStatus] = useState<AssetStatus>(asset.status)
  const [draftComment, setDraftComment] = useState('')
  const [draftNote, setDraftNote] = useState(asset.note)
  const [newTag, setNewTag] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // 切换素材时重置草稿（素材 ID 变化才重置，草稿字段本身不是依赖）
  useEffect(() => {
    setDraftStatus(asset.status)
    setDraftNote(asset.note)
    setDraftComment('')
    setNewTag('')
    setConfirmingDelete(false)
    // 仅在素材切换时重置
  }, [asset.id])
  // 外部状态/备注变更（如评审保存后）同步到草稿，面板显示不落伍
  useEffect(() => {
    setDraftStatus(asset.status)
  }, [asset.status])
  useEffect(() => {
    setDraftNote(asset.note)
  }, [asset.note])

  // 保存反馈数秒后自动消失（卸载时清理定时器）
  useEffect(() => {
    if (feedback === null) return
    const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [feedback])

  // 打开时聚焦“关闭”按钮（键盘用户可直达）；Esc 关闭（与查看器弹层一致）
  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleAddNewTag = (): void => {
    const tagName = newTag.trim()
    if (tagName === '') return
    if (asset.tags.includes(tagName)) {
      setFeedback(`标签“${tagName}”已存在`)
      return
    }
    onAddTag(tagName)
    setNewTag('')
    setFeedback(`已添加标签“${tagName}”`)
  }

  const handleQuickAddTag = (tagName: string): void => {
    onAddTag(tagName)
    setFeedback(`已添加标签“${tagName}”`)
  }

  const handleRemoveTag = (tagName: string): void => {
    onRemoveTag(tagName)
    setFeedback(`已移除标签“${tagName}”`)
  }

  const handleSubmitReview = (): void => {
    onSubmitReview(draftStatus, draftComment)
    setDraftComment('')
    setFeedback(`评审已保存：${ASSET_STATUS_LABELS[draftStatus]}（已计入评审历史）`)
  }

  const handleSaveNote = (): void => {
    onSaveNote(draftNote)
    setFeedback('备注已保存')
  }

  // 全局标签库中尚未加到该素材的标签（已加过的不再提供复用按钮）
  const reusableTags = tagNames.filter((name) => !asset.tags.includes(name))

  return (
    <aside
      className={collapsed ? 'review-panel is-collapsed' : 'review-panel'}
      aria-label="评审面板"
    >
      <header className="review-panel__header">
        <h2 className="review-panel__title">评审面板</h2>
        <button
          type="button"
          className="review-panel__collapse"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? '展开' : '收起'}
        </button>
        <button
          type="button"
          ref={closeButtonRef}
          className="review-panel__close"
          onClick={onClose}
        >
          关闭
        </button>
      </header>

      {!collapsed ? (
        <div className="review-panel__body">
          <section className="review-panel__asset" aria-label="素材信息">
            <p className="review-panel__asset-name" title={asset.name}>
              {asset.name}
            </p>
            <p className="review-panel__asset-meta">
              <span className="review-panel__asset-kind">{ASSET_KIND_LABELS[asset.kind]}</span>
              <StatusDot status={asset.status} />
            </p>
            <p className="review-panel__asset-source">
              文件：{asset.file.fileName}　来源：{asset.source === '' ? '未提供' : asset.source}
            </p>
          </section>

          {feedback !== null ? (
            <p className="review-panel__feedback" role="status">
              {feedback}
            </p>
          ) : null}

          <form
            className="review-panel__form"
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmitReview()
            }}
          >
            <fieldset className="review-panel__fieldset">
              <legend>评审结论</legend>
              <div className="review-panel__status-options">
                {STATUS_OPTIONS.map((status) => (
                  <label key={status} className="review-panel__status-option">
                    <input
                      type="radio"
                      name="review-status"
                      value={status}
                      checked={draftStatus === status}
                      onChange={() => setDraftStatus(status)}
                    />
                    {ASSET_STATUS_LABELS[status]}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="review-panel__field-label">
              <label htmlFor="review-panel-comment">评审意见</label>
            </p>
            <textarea
              id="review-panel-comment"
              className="review-panel__textarea"
              value={draftComment}
              onChange={(event) => setDraftComment(event.target.value)}
              rows={3}
              placeholder="填写本次评审意见（可留空）"
            />
            <button type="submit" className="review-panel__save">
              保存评审
            </button>
          </form>

          <section className="review-panel__tags" aria-label="标签">
            <h3 className="review-panel__section-title">标签</h3>
            {asset.tags.length > 0 ? (
              <ul className="review-panel__tag-list">
                {asset.tags.map((tag) => (
                  <li key={tag} className="review-panel__tag">
                    {tag}
                    <button
                      type="button"
                      className="review-panel__tag-remove"
                      aria-label={`移除标签“${tag}”`}
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="review-panel__tag-empty">暂无标签：可新建或从全局标签库复用</p>
            )}
            <div className="review-panel__tag-add">
              <input
                type="text"
                className="review-panel__tag-input"
                aria-label="新建标签名"
                placeholder="输入新标签名"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAddNewTag()
                  }
                }}
              />
              <button
                type="button"
                className="review-panel__tag-add-button"
                disabled={newTag.trim() === ''}
                onClick={handleAddNewTag}
              >
                添加标签
              </button>
            </div>
            {reusableTags.length > 0 ? (
              <div className="review-panel__tag-library">
                <p className="review-panel__tag-library-hint">全局标签库（点击复用）：</p>
                <ul className="review-panel__tag-list">
                  {reusableTags.map((tag) => (
                    <li key={tag}>
                      <button
                        type="button"
                        className="review-panel__tag-chip"
                        aria-label={`添加标签“${tag}”`}
                        onClick={() => handleQuickAddTag(tag)}
                      >
                        + {tag}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <AiPanel asset={asset} onAddTag={onAddTag} onAcceptName={onAcceptAiName} />

          <section className="review-panel__note" aria-label="备注">
            <h3 className="review-panel__section-title">备注</h3>
            <p className="review-panel__field-label">
              <label htmlFor="review-panel-note">备注内容</label>
            </p>
            <textarea
              id="review-panel-note"
              className="review-panel__textarea"
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              rows={3}
              placeholder="填写备注（如用途、注意事项）"
            />
            <button type="button" className="review-panel__save" onClick={handleSaveNote}>
              保存备注
            </button>
          </section>

          <ReviewHistory history={history} />

          {/* 删除素材入口（CR-006 T-001 / R-015）：置于面板末尾避免误触；
              内联二次确认（确认/取消），确认后由上层级联清理并持久化 */}
          {onDeleteAsset !== undefined ? (
            <section className="review-panel__danger" aria-label="删除素材">
              <h3 className="review-panel__section-title">删除素材</h3>
              {confirmingDelete ? (
                <>
                  <p className="review-panel__danger-hint">
                    确定删除“{asset.name}”？其评审历史与标签引用将一并清除，此操作不可撤销。
                  </p>
                  <div className="review-panel__danger-actions">
                    <button
                      type="button"
                      className="review-panel__danger-confirm"
                      onClick={onDeleteAsset}
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      className="review-panel__danger-cancel"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="review-panel__danger-button"
                  onClick={() => setConfirmingDelete(true)}
                >
                  删除素材
                </button>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
