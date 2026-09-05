/**
 * 窗宽窗位（W/L）面板单测（CR-003 T-003 / R-003 修改）：
 * 滑杆受控回显与范围、预设应用（手动 WC/WW）、自动 min-max 回退。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WindowLevelPanel from './WindowLevelPanel.tsx'
import { AUTO_WINDOW_LEVEL, WINDOW_PRESETS } from '../viewer/dicom/windowLevel.ts'
import type { WindowLevelState } from '../viewer/dicom/windowLevel.ts'

afterEach(() => {
  cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
})

describe('WindowLevelPanel', () => {
  it('renders the sliders with the given state and emits manual C changes', () => {
    const onChange = vi.fn()
    render(
      <WindowLevelPanel windowLevel={{ auto: false, wc: 40, ww: 400 }} onChange={onChange} />,
    )
    const wc = screen.getByLabelText('窗位 C') as HTMLInputElement
    const ww = screen.getByLabelText('窗宽 W') as HTMLInputElement
    expect(wc.value).toBe('40')
    expect(ww.value).toBe('400')
    // 滑杆范围（R-003：C:-1000..1000 / W:1..4000）
    expect(wc.min).toBe('-1000')
    expect(wc.max).toBe('1000')
    expect(ww.min).toBe('1')
    expect(ww.max).toBe('4000')

    fireEvent.change(wc, { target: { value: '-600' } })
    expect(onChange).toHaveBeenCalledWith({ auto: false, wc: -600, ww: 400 })
  })

  it('emits manual W changes', () => {
    const onChange = vi.fn()
    render(
      <WindowLevelPanel windowLevel={{ auto: false, wc: 40, ww: 400 }} onChange={onChange} />,
    )
    fireEvent.change(screen.getByLabelText('窗宽 W'), { target: { value: '1500' } })
    expect(onChange).toHaveBeenCalledWith({ auto: false, wc: 40, ww: 1500 })
  })

  it('applies each preset as a manual window level', () => {
    for (const preset of WINDOW_PRESETS) {
      const onChange = vi.fn()
      const state: WindowLevelState = { ...AUTO_WINDOW_LEVEL }
      const { unmount } = render(
        <WindowLevelPanel windowLevel={state} onChange={onChange} />,
      )
      fireEvent.click(screen.getByRole('button', { name: preset.name }))
      expect(onChange).toHaveBeenCalledWith({
        auto: false,
        wc: preset.center,
        ww: preset.width,
      })
      unmount()
    }
  })

  it('returns to the auto min-max mode via the auto button', () => {
    const onChange = vi.fn()
    render(
      <WindowLevelPanel windowLevel={{ auto: false, wc: 10, ww: 20 }} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '自动 min-max' }))
    expect(onChange).toHaveBeenCalledWith(AUTO_WINDOW_LEVEL)
  })

  it('announces the active mode', () => {
    const { rerender } = render(
      <WindowLevelPanel windowLevel={AUTO_WINDOW_LEVEL} onChange={vi.fn()} />,
    )
    expect(screen.getByText('当前：自动（min-max），拖动滑杆或选择预设切换手动')).toBeTruthy()
    rerender(
      <WindowLevelPanel windowLevel={{ auto: false, wc: 40, ww: 400 }} onChange={vi.fn()} />,
    )
    expect(screen.getByText('当前：手动窗宽窗位')).toBeTruthy()
  })
})
