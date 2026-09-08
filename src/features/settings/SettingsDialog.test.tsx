/**
 * 设置弹窗测试（CR-012 T-001 骨架 / CR-012 T-002 填实；R-027）。
 *
 * 覆盖任务卡 Test requirements 的弹窗部分：
 * - 字段与默认值：未传 settings 时按默认设置初始化（Base URL/API Key 为空、
 *   启用关闭、失败回退 Mock 开启）；传入 settings 时回填当前生效值；
 * - 保存：点击「保存」以归一化草稿（去首尾空白）触发 onSave 并关闭；
 * - 关闭路径：关闭按钮、取消、Esc 均关闭且不触发 onSave；非 Esc 按键不触发。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsDialog from './SettingsDialog.tsx'
import { DEFAULT_API_SETTINGS } from './settingsStore.ts'
import type { ApiSettings } from './settingsStore.ts'

describe('SettingsDialog（CR-012 T-002 / R-027）', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('未传设置时按默认值初始化字段（远程关闭、回退开启）', () => {
    render(<SettingsDialog onClose={() => undefined} />)

    expect(screen.getByRole('dialog', { name: '设置' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '设置' })).toBeTruthy()

    const baseUrl = screen.getByLabelText('API Base URL') as HTMLInputElement
    expect(baseUrl.type).toBe('text')
    expect(baseUrl.value).toBe('')
    const apiKey = screen.getByLabelText('API Key') as HTMLInputElement
    expect(apiKey.type).toBe('password')
    expect(apiKey.value).toBe('')
    const enabled = screen.getByRole('checkbox', { name: '启用' }) as HTMLInputElement
    expect(enabled.checked).toBe(DEFAULT_API_SETTINGS.enabled)
    expect(enabled.checked).toBe(false)
    const fallback = screen.getByRole('checkbox', { name: '失败回退 Mock' }) as HTMLInputElement
    expect(fallback.checked).toBe(DEFAULT_API_SETTINGS.fallbackToMock)
    expect(fallback.checked).toBe(true)

    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '关闭设置' })).toBeTruthy()
  })

  it('传入设置时回填当前生效值', () => {
    const settings: ApiSettings = {
      baseURL: 'https://api.example.com',
      apiKey: 'sk-stored',
      enabled: true,
      fallbackToMock: false,
    }
    render(<SettingsDialog settings={settings} onClose={() => undefined} />)

    expect((screen.getByLabelText('API Base URL') as HTMLInputElement).value).toBe(
      'https://api.example.com',
    )
    expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('sk-stored')
    expect((screen.getByRole('checkbox', { name: '启用' }) as HTMLInputElement).checked).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: '失败回退 Mock' }) as HTMLInputElement).checked,
    ).toBe(false)
  })

  it('保存：以去首尾空白的草稿触发 onSave 并关闭；不修改原设置对象', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const settings: ApiSettings = { ...DEFAULT_API_SETTINGS }
    render(<SettingsDialog settings={settings} onSave={onSave} onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('API Base URL'), {
      target: { value: ' https://api.example.com/ ' },
    })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: ' sk-new-key ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '启用' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '失败回退 Mock' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com/', // 仅去首尾空白；结尾斜杠由 remoteProvider 规整
      apiKey: 'sk-new-key',
      enabled: true,
      fallbackToMock: false,
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(settings).toEqual(DEFAULT_API_SETTINGS) // 草稿不回写原对象（持久化由上层完成）
  })

  it('取消/关闭/Esc 均不保存；非 Esc 按键不触发关闭', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<SettingsDialog onSave={onSave} onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('API Base URL'), {
      target: { value: 'https://api.example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('已启用但配置不完整时明示将使用本地 Mock', () => {
    render(<SettingsDialog onClose={() => undefined} />)
    expect(screen.queryByText(/将使用本地 Mock 规则生成/)).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: '启用' }))
    expect(screen.getByText(/将使用本地 Mock 规则生成/)).toBeTruthy()
  })
})
