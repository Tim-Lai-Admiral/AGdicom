/**
 * 状态指示（CR-004 T-001：UI 对齐 rec/ 设计，取代旧“状态徽标按钮”）。
 *
 * 展示：彩色圆点 + 状态文字（待评审=灰 / 通过=绿 / 驳回=红）双通道，不只靠
 * 颜色区分；仅作展示（rec 设计语言：左栏行内为紧凑文本/圆点，不可交互）。
 * 状态修改入口统一移到右栏评审面板（选中素材后提交评审，数据持久化不变）。
 */
import { ASSET_STATUS_LABELS } from '../../domain/types.ts'
import type { AssetStatus } from '../../domain/types.ts'

export interface StatusDotProps {
  status: AssetStatus
}

export default function StatusDot({ status }: StatusDotProps) {
  return (
    <span className={`status-dot status-dot--${status}`}>
      <span className="status-dot__marker" aria-hidden="true" />
      {ASSET_STATUS_LABELS[status]}
    </span>
  )
}
