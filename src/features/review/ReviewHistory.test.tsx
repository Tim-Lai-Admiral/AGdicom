import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReviewHistory } from '../../domain/types.ts'
import ReviewHistoryView, { formatReviewTimestamp } from './ReviewHistory.tsx'

const HISTORY: ReviewHistory = [
  { status: 'pending', comment: '', createdAt: '2026-09-03T08:00:00.000Z' },
  { status: 'passed', comment: '影像清晰，结构完整', createdAt: '2026-09-03T09:30:00.000Z' },
  { status: 'rejected', comment: '伪影明显，需重拍', createdAt: '2026-09-04T02:15:30.000Z' },
]

describe('formatReviewTimestamp', () => {
  it('formats an ISO timestamp as local YYYY-MM-DD HH:mm:ss', () => {
    // 用本地 Date 构造再格式化，避免测试依赖运行环境时区
    const local = new Date(2026, 8, 4, 7, 8, 9)
    expect(formatReviewTimestamp(local.toISOString())).toBe('2026-09-04 07:08:09')
  })

  it('returns the raw value for an invalid timestamp', () => {
    expect(formatReviewTimestamp('not-a-date')).toBe('not-a-date')
  })
})

describe('ReviewHistory', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('shows the empty state when there are no records', () => {
    render(<ReviewHistoryView history={undefined} />)
    expect(screen.getByText('评审历史（0）')).toBeTruthy()
    expect(screen.getByText(/暂无评审记录/)).toBeTruthy()
  })

  it('lists records newest first with timestamp, status and comment', () => {
    render(<ReviewHistoryView history={HISTORY} />)
    expect(screen.getByText(`评审历史（${HISTORY.length}）`)).toBeTruthy()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    // 最新在前：第一条是最后一次驳回评审
    expect(items[0]?.textContent).toContain('伪影明显，需重拍')
    expect(items[0]?.textContent).toContain('驳回')
    const time = items[0]?.querySelector('.review-history__time')
    expect(time?.getAttribute('datetime')).toBe('2026-09-04T02:15:30.000Z')
    expect(time?.textContent).toBe(formatReviewTimestamp('2026-09-04T02:15:30.000Z'))
    // 第二条带意见；最旧的一条无意见
    expect(items[1]?.textContent).toContain('影像清晰，结构完整')
    expect(items[1]?.textContent).toContain('通过')
    expect(items[2]?.textContent).toContain('（无评审意见）')
    expect(items[2]?.textContent).toContain('待评审')
  })
})
