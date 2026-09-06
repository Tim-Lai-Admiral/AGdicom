import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ASSET_STATUS_LABELS } from '../../domain/types.ts'
import type { AssetStatus } from '../../domain/types.ts'
import StatusDot from './StatusDot.tsx'

describe('StatusDot', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders the status text with the status class for each status', () => {
    const statuses: AssetStatus[] = ['pending', 'passed', 'rejected']
    for (const status of statuses) {
      const { unmount } = render(<StatusDot status={status} />)
      const dot = screen.getByText(ASSET_STATUS_LABELS[status], { selector: '.status-dot' })
      expect(dot.className).toContain(`status-dot--${status}`)
      unmount()
    }
  })

  it('is display-only: no button and no inline status switch (changes happen in the review panel)', () => {
    render(<StatusDot status="pending" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('待评审')).toBeTruthy()
  })
})
