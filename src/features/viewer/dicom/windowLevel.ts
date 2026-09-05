/**
 * 窗宽窗位预设与状态（CR-003 T-003 / R-003 修改）。
 *
 * 预设值取自设计参考稿（rec/src/App.tsx WINDOW_PRESETS，只读素材）：
 * Lung / Mediastinum / Bone / Brain / Liver / S. Tissue 六档。
 * 滑杆范围与参考稿一致：C:-1000..1000，W:1..4000。
 *
 * 状态模型：auto=true 表示“自动 min-max”（默认，与既有预览行为等价）；
 * 用户拖动滑杆或点击预设后 auto=false，按显式 WC/WW 解码。
 * wc/ww 字段在 auto 模式下仅作为滑杆候选值展示（切到手动时的起点）。
 */

/** 单个窗宽窗位预设 */
export interface WindowPreset {
  name: string
  center: number
  width: number
}

/** 六档预设（名称与取值同设计参考稿；测试断言依赖此顺序） */
export const WINDOW_PRESETS: readonly WindowPreset[] = [
  { name: 'Lung', center: -600, width: 1500 },
  { name: 'Mediastinum', center: 40, width: 400 },
  { name: 'Bone', center: 400, width: 1800 },
  { name: 'Brain', center: 40, width: 80 },
  { name: 'Liver', center: 60, width: 160 },
  { name: 'S. Tissue', center: 50, width: 350 },
]

/** 滑杆范围（R-003：C:-1000..1000 / W:1..4000） */
export const WINDOW_LEVEL_SLIDER = {
  wcMin: -1000,
  wcMax: 1000,
  wwMin: 1,
  wwMax: 4000,
} as const

/** 窗宽窗位状态：auto = 自动 min-max；否则按显式 wc/ww */
export interface WindowLevelState {
  auto: boolean
  wc: number
  ww: number
}

/**
 * 默认状态：自动 min-max（R-003“默认进入时自动 min-max，等价于当前行为”）。
 * wc/ww 仅为滑杆候选展示值（与参考稿默认 40/400 一致）。
 */
export const AUTO_WINDOW_LEVEL: WindowLevelState = { auto: true, wc: 40, ww: 400 }
