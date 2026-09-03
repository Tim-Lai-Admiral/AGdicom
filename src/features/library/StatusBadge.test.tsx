import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ASSET_STATUS_LABELS } from '../../domain/types.ts'
import type { AssetStatus } from '../../domain/types.ts'
import StatusBadge from './StatusBadge.tsx'

describe('StatusBadge', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders the status text with the status class for each status', () => {
    const statuses: AssetStatus[] = ['pending', 'passed', 'rejected']
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />)
      const badge = screen.getByText(ASSET_STATUS_LABELS[status])
      expect(badge.className).toContain(`status-badge--${status}`)
      unmount()
    }
  })

  it('renders a non-interactive badge when onSetStatus is omitted', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('待评审')).toBeTruthy()
  })

  it('cycles to the next status on click: pending → passed', () => {
    const onSetStatus = vi.fn()
    render(<StatusBadge status="pending" onSetStatus={onSetStatus} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSetStatus).toHaveBeenCalledTimes(1)
    expect(onSetStatus).toHaveBeenCalledWith('passed')
  })

  it('cycles to the next status on click: passed → rejected', () => {
    const onSetStatus = vi.fn()
    render(<StatusBadge status="passed" onSetStatus={onSetStatus} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSetStatus).toHaveBeenCalledWith('rejected')
  })

  it('cycles to the next status on click: rejected → pending', () => {
    const onSetStatus = vi.fn()
    render(<StatusBadge status="rejected" onSetStatus={onSetStatus} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSetStatus).toHaveBeenCalledWith('pending')
  })

  it('exposes the current and next status in the accessible name', () => {
    render(<StatusBadge status="pending" onSetStatus={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: '当前状态：待评审，点击切换为“通过”' }),
    ).toBeTruthy()
  })
})
