/**
 * 窗宽窗位（W/L）调节面板（CR-003 T-003 / R-003 修改，工作台右栏）。
 *
 * DICOM 素材选中且右栏处于“元数据”页签时显示于元数据分组上方：
 * - 双滑杆（C:-1000..1000 / W:1..4000）+ 数值显示，拖动即时切到手动模式；
 * - 六档预设按钮（Lung/Mediastinum/Bone/Brain/Liver/S. Tissue）；
 * - “自动 min-max”按钮回到默认（与既有预览行为等价）。
 *
 * 状态由 App 持有（中央查看器据此重解码），本面板为纯受控组件。
 */
import {
  AUTO_WINDOW_LEVEL,
  WINDOW_LEVEL_SLIDER,
  WINDOW_PRESETS,
} from '../viewer/dicom/windowLevel.ts'
import type { WindowLevelState } from '../viewer/dicom/windowLevel.ts'

export interface WindowLevelPanelProps {
  /** 当前窗宽窗位状态（App 持有） */
  windowLevel: WindowLevelState
  /** 状态变更回调（滑杆 / 预设 / 自动按钮） */
  onChange: (next: WindowLevelState) => void
}

export default function WindowLevelPanel({ windowLevel, onChange }: WindowLevelPanelProps) {
  const { auto, wc, ww } = windowLevel
  return (
    <section className="wl-panel" aria-label="窗宽窗位（W/L）调节">
      <div className="wl-panel__head">
        <h2 className="wl-panel__title">窗宽窗位（W/L）</h2>
        <button
          type="button"
          className={auto ? 'preset-btn active' : 'preset-btn'}
          aria-pressed={auto}
          onClick={() => onChange(AUTO_WINDOW_LEVEL)}
        >
          自动 min-max
        </button>
      </div>
      <div className="wl-panel__body">
        <p className="wl-panel__mode" role="status">
          {auto
            ? '当前：自动（min-max），拖动滑杆或选择预设切换手动'
            : '当前：手动窗宽窗位'}
        </p>
        <div className="wl-panel__slider">
          <div className="wl-panel__slider-head">
            <label htmlFor="wl-center-input">窗位 C</label>
            <span className="wl-panel__value">{wc}</span>
          </div>
          <input
            id="wl-center-input"
            className="range-input"
            type="range"
            min={WINDOW_LEVEL_SLIDER.wcMin}
            max={WINDOW_LEVEL_SLIDER.wcMax}
            step={1}
            value={wc}
            onChange={(event) =>
              onChange({ auto: false, wc: Number(event.target.value), ww })
            }
          />
        </div>
        <div className="wl-panel__slider">
          <div className="wl-panel__slider-head">
            <label htmlFor="wl-width-input">窗宽 W</label>
            <span className="wl-panel__value">{ww}</span>
          </div>
          <input
            id="wl-width-input"
            className="range-input"
            type="range"
            min={WINDOW_LEVEL_SLIDER.wwMin}
            max={WINDOW_LEVEL_SLIDER.wwMax}
            step={1}
            value={ww}
            onChange={(event) =>
              onChange({ auto: false, wc, ww: Number(event.target.value) })
            }
          />
        </div>
        <div className="wl-panel__presets">
          {WINDOW_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="preset-btn"
              onClick={() => onChange({ auto: false, wc: preset.center, ww: preset.width })}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <p className="wl-panel__hint">预设与滑杆仅调整预览映射，不修改文件数据。</p>
      </div>
    </section>
  )
}
