/**
 * 设置弹窗骨架测试（CR-012 T-001 / R-027）。
 *
 * 覆盖任务卡 Test requirements 的弹窗骨架部分：
 * - 字段占位展示：API Base URL 文本框 / API Key 密码框（空值占位）、启用 /
 *   失败回退 Mock 开关（未勾选占位）、保存/取消/关闭按钮；
 * - 关闭路径：关闭按钮、取消、保存、Esc 均触发 onClose（骨架不持久化，
 *   localStorage 保存由 T-002 接入）；非 Esc 按键不触发。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsDialog from './SettingsDialog.tsx'

describe('SettingsDialog: 设置弹窗骨架（CR-012 T-001 / R-027）', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders the placeholder fields and action buttons', () => {
    render(<SettingsDialog onClose={() => undefined} />)

    expect(screen.getByRole('dialog', { name: '设置' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '设置' })).toBeTruthy()

    // 字段占位：文本框 / 密码框均为空值，开关均未勾选（T-002 才接入真实配置）
    const baseUrl = screen.getByLabelText('API Base URL') as HTMLInputElement
    expect(baseUrl.type).toBe('text')
    expect(baseUrl.value).toBe('')
    const apiKey = screen.getByLabelText('API Key') as HTMLInputElement
    expect(apiKey.type).toBe('password')
    expect(apiKey.value).toBe('')
    const enabled = screen.getByRole('checkbox', { name: '启用' }) as HTMLInputElement
    expect(enabled.checked).toBe(false)
    const fallback = screen.getByRole('checkbox', { name: '失败回退 Mock' }) as HTMLInputElement
    expect(fallback.checked).toBe(false)

    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '关闭设置' })).toBeTruthy()
  })

  it('closes via the close button, cancel, save and Escape; ignores other keys', () => {
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(4)

    // 非 Esc 按键不触发关闭
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(4)
  })
})
