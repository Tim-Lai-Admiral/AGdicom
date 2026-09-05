/**
 * 测量纯计算层单测（CR-003 T-003 / R-010）：
 * PixelSpacing 确定性毫米路径、Mock 回退、标注格式、指针坐标映射。
 */
import { describe, expect, it } from 'vitest'
import { clientToImagePoint, formatMeasureLength, measureLength } from './measure.ts'

describe('measureLength', () => {
  it('computes deterministic mm with isotropic pixel spacing', () => {
    // 3-4-5 直角三角形 × 0.5 mm/px = 2.5 mm（确定性，单测口径）
    expect(measureLength({ x: 0, y: 0 }, { x: 3, y: 4 }, [0.5, 0.5])).toEqual({
      kind: 'mm',
      value: 2.5,
    })
  })

  it('applies row spacing to the vertical axis and column spacing to the horizontal axis', () => {
    // PixelSpacing = [行间距 0.5（纵向）, 列间距 1（横向）]：dx=3px→3mm，dy=4px→2mm → √13≈3.6
    expect(measureLength({ x: 0, y: 0 }, { x: 3, y: 4 }, [0.5, 1])).toEqual({
      kind: 'mm',
      value: 3.6,
    })
  })

  it('falls back to the mock pixel length when spacing is missing or invalid', () => {
    const expected = { kind: 'mock', value: 5 }
    expect(measureLength({ x: 0, y: 0 }, { x: 3, y: 4 }, undefined)).toEqual(expected)
    expect(measureLength({ x: 0, y: 0 }, { x: 3, y: 4 }, [])).toEqual(expected)
    expect(measureLength({ x: 0, y: 0 }, { x: 3, y: 4 }, [0.5])).toEqual(expected)
    expect(measureLength({ x: 0, y: 0 }, { x: 3, y: 4 }, [0, -1])).toEqual(expected)
    expect(measureLength({ x: 0, y: 0 }, { x: 3, y: 4 }, [Number.NaN, 0.5])).toEqual(expected)
  })

  it('returns zero length for coincident points (both paths)', () => {
    expect(measureLength({ x: 2, y: 2 }, { x: 2, y: 2 }, [0.5, 0.5])).toEqual({
      kind: 'mm',
      value: 0,
    })
    expect(measureLength({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ kind: 'mock', value: 0 })
  })
})

describe('formatMeasureLength', () => {
  it('formats the mm path as millimetres', () => {
    expect(formatMeasureLength({ kind: 'mm', value: 2.5 })).toBe('2.5 mm')
  })

  it('marks the mock path explicitly as simulated', () => {
    expect(formatMeasureLength({ kind: 'mock', value: 5 })).toBe('≈ 5.0 px（模拟）')
  })
})

describe('clientToImagePoint', () => {
  it('maps through the object-fit: contain letterbox', () => {
    // 画布盒 100×50，图像 8×8：缩放 = min(100/8, 50/8) = 6.25，内容 50×50 水平居中（左缘 x=35）
    const rect = { left: 10, top: 20, width: 100, height: 50 }
    expect(clientToImagePoint(35, 20, rect, 8, 8)).toEqual({ x: 0, y: 0 })
    expect(clientToImagePoint(85, 70, rect, 8, 8)).toEqual({ x: 8, y: 8 }) // 右/下边缘收拢
    expect(clientToImagePoint(60, 45, rect, 8, 8)).toEqual({ x: 4, y: 4 })
  })

  it('degenerates safely for zero-size rects or images', () => {
    expect(clientToImagePoint(5, 5, { left: 0, top: 0, width: 0, height: 0 }, 8, 8)).toEqual({
      x: 0,
      y: 0,
    })
    expect(clientToImagePoint(5, 5, { left: 0, top: 0, width: 100, height: 100 }, 0, 0)).toEqual({
      x: 0,
      y: 0,
    })
  })
})
