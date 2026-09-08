/**
 * 设置弹窗骨架（CR-012 T-001 / R-027）。
 *
 * 仅 UI 骨架：标题「设置」+ API 配置字段占位（API Base URL 文本框、API Key
 * 密码框、启用开关、失败回退 Mock 开关，均为空值/未勾选占位）+ 保存/取消/关闭
 * 按钮 + Esc 关闭。不持久化任何配置——localStorage 持久化与恢复由 T-002 接入
 * （R-027：独立 key，不随素材导出），因此「保存/取消」暂时仅关闭弹窗，并以
 * 提示文案明示（可见状态原则）。
 *
 * 开合状态由 App 持有（settingsOpen 条件挂载，与导出弹层同模式）；关闭路径
 * （关闭按钮/取消/保存/Esc）统一走 onClose 回调。App 层的图片预览 Esc 兜底
 * 在设置弹窗打开期间跳过（由 App 判断 settingsOpen），避免一键同时关闭两层。
 */
import { useEffect } from 'react'

export interface SettingsDialogProps {
  /** 关闭回调（关闭按钮/取消/保存/Esc 均触发；开合状态由 App 持有） */
  onClose: () => void
}

export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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

        {/* API 配置（R-027 字段占位；T-002 接入持久化后改为受控/默认值回填） */}
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
          />
        </div>
        <div className="settings-dialog__switch">
          <input id="settings-enabled" type="checkbox" />
          <label htmlFor="settings-enabled">启用</label>
        </div>
        <div className="settings-dialog__switch">
          <input id="settings-fallback-mock" type="checkbox" />
          <label htmlFor="settings-fallback-mock">失败回退 Mock</label>
        </div>

        <p className="settings-dialog__hint">
          当前为界面骨架：配置暂不保存，持久化将在后续版本接入。
        </p>
        <footer className="settings-dialog__footer">
          <button type="button" className="settings-dialog__save" onClick={onClose}>
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
