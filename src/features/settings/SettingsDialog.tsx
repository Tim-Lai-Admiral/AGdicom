/**
 * 设置弹窗（CR-012 T-001 骨架 / CR-012 T-002 填实；R-027、R-028）。
 *
 * API 配置四字段受控可编辑（Base URL 文本框、API Key 密码框、启用开关、
 * 失败回退 Mock 开关），打开时以当前生效设置初始化草稿；点击「保存」把草稿
 * （baseURL/apiKey 去首尾空白）交给上层 onSave 持久化（settingsStore →
 * localStorage 独立 key，R-027），随后关闭弹窗；取消/关闭/Esc 直接关闭、
 * 不保存。
 *
 * 明示（可见状态原则）：配置仅存本机浏览器、不随素材导出 JSON；API Key 属
 * 敏感信息请勿提交或共享；已启用但 Base URL/API Key 未填完整时提示将使用
 * 本地 Mock 规则。
 *
 * 开合状态由 App 持有（settingsOpen 条件挂载，与导出弹层同模式）；关闭路径
 * （关闭按钮/取消/保存/Esc）统一走 onClose 回调。App 层的图片预览 Esc 兜底
 * 在设置弹窗打开期间跳过（由 App 判断 settingsOpen），避免一键同时关闭两层。
 */
import { useEffect, useState } from 'react'
import { DEFAULT_API_SETTINGS } from './settingsStore.ts'
import type { ApiSettings } from './settingsStore.ts'

export interface SettingsDialogProps {
  /** 当前生效设置（缺省用默认值；弹窗随开随建，以挂载时的值初始化草稿） */
  settings?: ApiSettings
  /** 保存回调（点击「保存」触发，传入归一化草稿；持久化由上层完成；缺省仅关闭） */
  onSave?: (settings: ApiSettings) => void
  /** 关闭回调（关闭按钮/取消/保存/Esc 均触发；开合状态由 App 持有） */
  onClose: () => void
}

export default function SettingsDialog({ settings, onSave, onClose }: SettingsDialogProps) {
  const initial = settings ?? DEFAULT_API_SETTINGS
  const [draftBaseUrl, setDraftBaseUrl] = useState(initial.baseURL)
  const [draftApiKey, setDraftApiKey] = useState(initial.apiKey)
  const [draftEnabled, setDraftEnabled] = useState(initial.enabled)
  const [draftFallback, setDraftFallback] = useState(initial.fallbackToMock)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  /** 保存：归一化草稿交上层持久化（失败由上层提示），随后关闭弹窗 */
  const handleSave = (): void => {
    onSave?.({
      baseURL: draftBaseUrl.trim(),
      apiKey: draftApiKey.trim(),
      enabled: draftEnabled,
      fallbackToMock: draftFallback,
    })
    onClose()
  }

  // 已启用但配置不完整：按选择逻辑（selectAiProvider）会落到本地 Mock，需明示
  const incompleteConfig =
    draftEnabled && (draftBaseUrl.trim() === '' || draftApiKey.trim() === '')

  return (
    <div className="settings-dialog__overlay">
      <section className="settings-dialog" role="dialog" aria-label="设置">
        <header className="settings-dialog__head">
          <h2 className="settings-dialog__title">设置</h2>
          <button
            type="button"
            className="settings-dialog__close"
            aria-label="关闭设置"
            title="关闭设置"
            onClick={onClose}
          >
            关闭
          </button>
        </header>

        {/* AI API 配置（R-027；保存至本机 localStorage 独立 key，不随素材导出） */}
        <div className="settings-dialog__field">
          <label className="settings-dialog__label" htmlFor="settings-api-base-url">
            API Base URL
          </label>
          <input
            id="settings-api-base-url"
            className="settings-dialog__input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://api.example.com"
            value={draftBaseUrl}
            onChange={(event) => setDraftBaseUrl(event.target.value)}
          />
        </div>
        <div className="settings-dialog__field">
          <label className="settings-dialog__label" htmlFor="settings-api-key">
            API Key
          </label>
          <input
            id="settings-api-key"
            className="settings-dialog__input"
            type="password"
            autoComplete="new-password"
            value={draftApiKey}
            onChange={(event) => setDraftApiKey(event.target.value)}
          />
        </div>
        <div className="settings-dialog__switch">
          <input
            id="settings-enabled"
            type="checkbox"
            checked={draftEnabled}
            onChange={(event) => setDraftEnabled(event.target.checked)}
          />
          <label htmlFor="settings-enabled">启用</label>
        </div>
        <div className="settings-dialog__switch">
          <input
            id="settings-fallback-mock"
            type="checkbox"
            checked={draftFallback}
            onChange={(event) => setDraftFallback(event.target.checked)}
          />
          <label htmlFor="settings-fallback-mock">失败回退 Mock</label>
        </div>

        {incompleteConfig ? (
          <p className="settings-dialog__hint" role="status">
            已启用但 Base URL 或 API Key 未填写完整：AI 建议将使用本地 Mock 规则生成。
          </p>
        ) : null}
        <p className="settings-dialog__hint">
          配置仅保存在本机浏览器（localStorage），不会随素材导出 JSON；API Key
          属敏感信息，请勿提交到代码仓库或与他人共享。启用后 AI
          建议将调用远程服务（仅发送素材名称、类型与元数据），失败时可回退本地
          Mock 规则（界面会明示来源）。
        </p>
        <footer className="settings-dialog__footer">
          <button type="button" className="settings-dialog__save" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="settings-dialog__cancel" onClick={onClose}>
            取消
          </button>
        </footer>
      </section>
    </div>
  )
}
