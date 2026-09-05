/**
 * 窗宽窗位预设与状态单测（CR-003 T-003 / R-003 修改）。
 * 预设“应用”行为（点击 → 手动 WC/WW）由 WindowLevelPanel.test.tsx 覆盖。
 */
import { describe, expect, it } from 'vitest'
import { AUTO_WINDOW_LEVEL, WINDOW_LEVEL_SLIDER, WINDOW_PRESETS } from './windowLevel.ts'

describe('WINDOW_PRESETS', () => {
  it('provides the six presets with the reference values', () => {
    expect(WINDOW_PRESETS.map((preset) => preset.name)).toEqual([
      'Lung',
      'Mediastinum',
      'Bone',
      'Brain',
      'Liver',
      'S. Tissue',
    ])
    expect(WINDOW_PRESETS[0]).toEqual({ name: 'Lung', center: -600, width: 1500 })
    expect(WINDOW_PRESETS[1]).toEqual({ name: 'Mediastinum', center: 40, width: 400 })
    expect(WINDOW_PRESETS[2]).toEqual({ name: 'Bone', center: 400, width: 1800 })
    expect(WINDOW_PRESETS[3]).toEqual({ name: 'Brain', center: 40, width: 80 })
    expect(WINDOW_PRESETS[4]).toEqual({ name: 'Liver', center: 60, width: 160 })
    expect(WINDOW_PRESETS[5]).toEqual({ name: 'S. Tissue', center: 50, width: 350 })
  })

  it('keeps every preset inside the slider ranges', () => {
    for (const preset of WINDOW_PRESETS) {
      expect(preset.center).toBeGreaterThanOrEqual(WINDOW_LEVEL_SLIDER.wcMin)
      expect(preset.center).toBeLessThanOrEqual(WINDOW_LEVEL_SLIDER.wcMax)
      expect(preset.width).toBeGreaterThanOrEqual(WINDOW_LEVEL_SLIDER.wwMin)
      expect(preset.width).toBeLessThanOrEqual(WINDOW_LEVEL_SLIDER.wwMax)
    }
  })
})

describe('AUTO_WINDOW_LEVEL', () => {
  it('defaults to the auto min-max mode', () => {
    expect(AUTO_WINDOW_LEVEL.auto).toBe(true)
  })
})
