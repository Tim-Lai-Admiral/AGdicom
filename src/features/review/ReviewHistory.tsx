/**
 * 评审历史列表（CR-001 T-007 / R-005）。
 *
 * 追加式评审历史（append-only）的只读展示：每条记录显示时间戳（本地时间）、
 * 结论状态（颜色 + 文字双通道徽标）与评审意见；展示顺序为“最新在前”，
 * 便于先看到最近一次评审结论。历史记录本身由领域层（applyReview）追加，
 * 本组件不做任何改写。
 */
import type { ReviewHistory as ReviewHistoryData } from '../../domain/types.ts'
import StatusBadge from '../library/StatusBadge.tsx'

export interface ReviewHistoryProps {
  /** 追加式评审历史（时间正序存储）；undefined 视为空历史 */
  history: ReviewHistoryData | undefined
}

/** 把 ISO 时间戳格式化为本地“YYYY-MM-DD HH:mm:ss”（不依赖 Intl，跨环境格式确定） */
export function formatReviewTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

export default function ReviewHistory({ history }: ReviewHistoryProps) {
  const records = history ?? []
  // 最新在前：倒序展示（存储仍为追加正序）
  const ordered = [...records].reverse()
  return (
    <section className="review-history" aria-label="评审历史">
      <h3 className="review-history__title">评审历史（{records.length}）</h3>
      {records.length === 0 ? (
        <p className="review-history__empty">暂无评审记录：提交评审后将按时间留痕</p>
      ) : (
        <ol className="review-history__list">
          {ordered.map((record, index) => (
            <li
              key={`${ordered.length - index}-${record.createdAt}`}
              className="review-history__item"
            >
              <p className="review-history__meta">
                <time className="review-history__time" dateTime={record.createdAt}>
                  {formatReviewTimestamp(record.createdAt)}
                </time>
                <StatusBadge status={record.status} />
              </p>
              {record.comment !== '' ? (
                <p className="review-history__comment">{record.comment}</p>
              ) : (
                <p className="review-history__comment review-history__comment--none">
                  （无评审意见）
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
