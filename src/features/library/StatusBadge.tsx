/**
 * 状态徽标（CR-001 T-004 / R-002）。
 *
 * 展示：颜色（待评审=灰 / 通过=绿 / 驳回=红）+ 文字双通道，不只靠颜色区分；
 * 交互：提供 onSetStatus 时渲染为按钮，点击按“待评审 → 通过 → 驳回 → 待评审”
 * 循环切换到下一状态；状态计算（setAssetStatus）与持久化（saveState）由调用方完成，
 * 本组件不持有业务逻辑。未提供回调时渲染为不可交互的纯展示徽标。
 */
import { ASSET_STATUS_LABELS } from '../../domain/types.ts'
import type { AssetStatus } from '../../domain/types.ts'

/** 点击徽标切换到的下一状态（固定循环顺序） */
const NEXT_STATUS: Readonly<Record<AssetStatus, AssetStatus>> = {
  pending: 'passed',
  passed: 'rejected',
  rejected: 'pending',
}

export interface StatusBadgeProps {
  status: AssetStatus
  /** 状态切换回调；缺省时渲染为不可交互的纯展示徽标 */
  onSetStatus?: (status: AssetStatus) => void
}

export default function StatusBadge({ status, onSetStatus }: StatusBadgeProps) {
  const label = ASSET_STATUS_LABELS[status]
  if (onSetStatus === undefined) {
    return <span className={`status-badge status-badge--${status}`}>{label}</span>
  }
  const next = NEXT_STATUS[status]
  const nextLabel = ASSET_STATUS_LABELS[next]
  return (
    <button
      type="button"
      className={`status-badge status-badge--${status} status-badge--button`}
      onClick={() => onSetStatus(next)}
      title={`当前状态：${label}。点击切换为“${nextLabel}”`}
      aria-label={`当前状态：${label}，点击切换为“${nextLabel}”`}
    >
      {label}
    </button>
  )
}
