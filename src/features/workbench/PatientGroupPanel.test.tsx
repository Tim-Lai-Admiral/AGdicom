/**
 * 左栏 DICOM 患者分组独立面板单测（CR-008 T-001 / R-021）。
 *
 * 覆盖任务卡 Test requirements：
 * - 面板一次渲染全部患者组（按 R-012 排序）；分组头可折叠（App 层 openGroupKeys）；
 * - 组内 series 行（含未知系列）→ 切片缩略图；series 行默认折叠，当前素材所在
 *   series 自动展开并高亮（分组头 is-active / 缩略图 is-active）；
 * - 点击切片仅触发 onOpenSlice，不改变分组展开状态（onToggleGroup 不被调用）；
 * - 当前切片所属分组自动展开（onOpenGroup，幂等联动）；
 * - 姓名/ID 均缺失的"未知患者"组显示；无元数据占位提示不崩溃。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
// 箭头旋转为 CSS 过渡：jsdom 不应用样式表，断言样式源码（与 App.workbench.test 同口径）
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, DicomMeta } from '../../domain/types.ts'
import PatientGroupPanel from './PatientGroupPanel.tsx'

afterEach(() => {
  cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
})

function meta(overrides: Partial<DicomMeta> = {}): DicomMeta {
  return {
    seriesInstanceUID: 'uid-1',
    instanceNumber: 1,
    sliceCount: 1,
    deidentified: false,
    ...overrides,
  }
}

function asset(id: string, patient: Partial<DicomMeta> = {}, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    name: id,
    kind: 'dicom',
    status: 'pending',
    tags: [],
    note: '',
    source: '',
    file: { fileName: `${id}.dcm`, fileSize: 1, fileType: 'application/dicom' },
    createdAt: '',
    updatedAt: '',
    dicomMeta: meta(patient),
    ...overrides,
  }
}

/** 同一患者（CHEN^WEI / P2）2 个 series × 3 切片（R-012 键：`姓名\0ID`） */
function chenAssets(): Asset[] {
  const out: Asset[] = []
  for (const uid of ['uid-1', 'uid-2']) {
    for (let i = 1; i <= 3; i += 1) {
      out.push(
        asset(`a-${uid}-${i}`, {
          patientName: 'CHEN^WEI',
          patientID: 'P2',
          seriesInstanceUID: uid,
          instanceNumber: i,
          sliceCount: 6,
        }),
      )
    }
  }
  return out
}

/** CHEN^WEI/P2 患者组键（R-012 键语义：`姓名\0ID`） */
const CHEN_KEY = 'CHEN^WEI\u0000P2'

interface RenderOptions {
  activeSliceAssetId?: string | null
  openGroupKeys?: ReadonlySet<string>
  onToggleGroup?: (key: string) => void
  onOpenGroup?: (key: string) => void
  onOpenSlice?: (assetId: string) => void
}

function renderPanel(assets: Asset[], options: RenderOptions = {}) {
  const onToggleGroup = options.onToggleGroup ?? vi.fn()
  const onOpenGroup = options.onOpenGroup ?? vi.fn()
  const onOpenSlice = options.onOpenSlice ?? vi.fn()
  const result = render(
    <PatientGroupPanel
      dicomAssets={assets}
      activeSliceAssetId={options.activeSliceAssetId ?? null}
      openGroupKeys={options.openGroupKeys ?? new Set()}
      onToggleGroup={onToggleGroup}
      onOpenGroup={onOpenGroup}
      onOpenSlice={onOpenSlice}
    />,
  )
  return { ...result, onToggleGroup, onOpenGroup, onOpenSlice }
}

describe('PatientGroupPanel（CR-008 T-001 / R-021）', () => {
  it('一次渲染全部患者组（按 R-012 排序），面板仅渲染一次；分组头默认折叠', () => {
    const assets = [
      ...chenAssets(),
      asset('b-1', {
        patientName: 'BROWN^ANN',
        patientID: 'PB',
        seriesInstanceUID: 'uid-B',
        sliceCount: 1,
      }),
    ]
    const { container } = renderPanel(assets)
    // 面板容器仅一个；全部患者组头一次性渲染（BROWN < CHEN 码点升序）
    expect(container.querySelectorAll('.dicom-panel')).toHaveLength(1)
    const heads = container.querySelectorAll('.dicom-panel__group-head')
    expect(heads).toHaveLength(2)
    expect(heads[0]?.textContent).toContain('BROWN^ANN')
    expect(heads[1]?.textContent).toContain('CHEN^WEI')
    // 分组头默认折叠（aria-expanded=false）：series 行不渲染
    expect(heads[0]?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelectorAll('.dicom-panel__series')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
  })

  it('分组头展开后：患者组头（姓名/ID/计数）与 series 行可见、series 行默认折叠', () => {
    const assets = chenAssets()
    renderPanel(assets, { openGroupKeys: new Set([CHEN_KEY]) })
    expect(screen.getByText('CHEN^WEI')).toBeTruthy()
    expect(screen.getByText('P2')).toBeTruthy()
    expect(screen.getByText('2 序列 · 6 张')).toBeTruthy()
    // 组内 series 按 SeriesInstanceUID 升序，默认折叠（无缩略图）
    const seriesRows = screen.getAllByRole('button', { name: /Series/ })
    expect(seriesRows).toHaveLength(2)
    expect(seriesRows[0]?.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
  })

  it('当前素材所在 series 自动展开并高亮（分组头 is-active / 缩略图 is-active）', () => {
    const assets = chenAssets()
    renderPanel(assets, { openGroupKeys: new Set([CHEN_KEY]), activeSliceAssetId: 'a-uid-2-2' })
    // 当前素材所在 series（uid-2）自动展开：3 张缩略图可见
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
    expect(screen.getByText('CHEN^WEI').closest('button')?.className).toContain('is-active')
    expect(screen.getByRole('button', { name: '查看切片 #2' }).className).toContain('is-active')
  })

  it('当前切片所属分组未展开时经 onOpenGroup 自动展开（幂等联动）', () => {
    const assets = chenAssets()
    const onOpenGroup = vi.fn()
    renderPanel(assets, { activeSliceAssetId: 'a-uid-2-2', onOpenGroup })
    expect(onOpenGroup).toHaveBeenCalledWith(CHEN_KEY)
  })

  it('点击切片：仅回调 onOpenSlice，不改变分组展开状态（onToggleGroup 不被调用）', () => {
    const assets = chenAssets()
    const onOpenSlice = vi.fn()
    const onToggleGroup = vi.fn()
    renderPanel(assets, {
      openGroupKeys: new Set([CHEN_KEY]),
      activeSliceAssetId: 'a-uid-1-1',
      onOpenSlice,
      onToggleGroup,
    })
    fireEvent.click(screen.getByRole('button', { name: '查看切片 #2' }))
    expect(onOpenSlice).toHaveBeenCalledWith('a-uid-1-2')
    expect(onToggleGroup).not.toHaveBeenCalled()
  })

  it('series 行手动折叠/展开：折叠后缩略图隐藏，再展开恢复', () => {
    const assets = chenAssets()
    renderPanel(assets, { openGroupKeys: new Set([CHEN_KEY]), activeSliceAssetId: 'a-uid-1-1' })
    const firstSeries = screen.getAllByRole('button', { name: /Series/ })[0] as HTMLElement
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
    fireEvent.click(firstSeries)
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
    fireEvent.click(firstSeries)
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
  })

  it('分组头点击回调 onToggleGroup（折叠交互）', () => {
    const assets = chenAssets()
    const onToggleGroup = vi.fn()
    const { container } = renderPanel(assets, { onToggleGroup })
    const head = container.querySelector('.dicom-panel__group-head') as HTMLElement
    fireEvent.click(head)
    expect(onToggleGroup).toHaveBeenCalledWith(CHEN_KEY)
  })

  it('chevron 随展开态切换 is-open 类（收起 -90° / 展开 0°，0.15s 过渡）(CR-013 T-001 / R-031)', () => {
    // 旋转角度与过渡断言样式源码（jsdom 不应用样式表）；aria-expanded 语义由
    // 既有分组头/系列行用例覆盖，本用例聚焦 chevron 类名切换
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
    const baseRule = (/[.]dicom-panel__chevron\s*\{([^}]*)\}/.exec(css)?.[1] ?? '').replace(
      /\s+/g,
      ' ',
    )
    expect(baseRule).toContain('transform: rotate(-90deg)')
    expect(baseRule).toContain('transition: transform 0.15s')
    const openRule = (/[.]dicom-panel__chevron\.is-open\s*\{([^}]*)\}/.exec(css)?.[1] ?? '').replace(
      /\s+/g,
      ' ',
    )
    expect(openRule).toContain('transform: rotate(0deg)')

    // 收起态（默认）：分组头与系列行 chevron 均无 is-open（-90°）
    const { container } = renderPanel(chenAssets())
    const collapsedChevrons = container.querySelectorAll('.dicom-panel__chevron')
    expect(collapsedChevrons.length).toBeGreaterThan(0)
    for (const chevron of collapsedChevrons) {
      expect(chevron.className).not.toContain('is-open')
    }

    // 展开态：分组头经 openGroupKeys 展开、series 经当前切片自动展开 → 对应 chevron 有 is-open
    cleanup()
    const opened = renderPanel(chenAssets(), {
      openGroupKeys: new Set([CHEN_KEY]),
      activeSliceAssetId: 'a-uid-1-1',
    })
    const headChevron = opened.container.querySelector(
      '.dicom-panel__group-head .dicom-panel__chevron',
    )
    expect(headChevron?.className).toContain('is-open')
    const seriesChevron = opened.container.querySelector(
      '.dicom-panel__series-toggle .dicom-panel__chevron',
    )
    expect(seriesChevron?.className).toContain('is-open')
  })

  it('shows 未知患者 with 已置空 for files with both patient fields missing', () => {
    const assets = [
      asset('x', { patientName: undefined, patientID: undefined }),
      asset('y', { patientName: undefined, patientID: undefined, seriesInstanceUID: 'uid-9' }),
    ]
    const { container } = renderPanel(assets, { openGroupKeys: new Set(['unknown']) })
    expect(screen.getByText('未知患者')).toBeTruthy()
    expect(screen.getByText('已置空')).toBeTruthy()
    expect(screen.getByText('2 序列 · 2 张')).toBeTruthy()
    expect(container.querySelector('.dicom-panel__group-head')?.className).not.toContain(
      'is-active',
    )
  })

  it('renders the aggregated unknown-series row as 未知系列（N 个文件）(R-019)', () => {
    const assets = [
      asset('u1', {
        patientName: 'CHEN^WEI',
        patientID: 'P2',
        seriesInstanceUID: undefined,
        instanceNumber: 2,
      }),
      asset('u2', {
        patientName: 'CHEN^WEI',
        patientID: 'P2',
        seriesInstanceUID: undefined,
        instanceNumber: 1,
      }),
    ]
    renderPanel(assets, {
      openGroupKeys: new Set([CHEN_KEY]),
      activeSliceAssetId: 'u1',
    })
    // 同患者无 UID 文件聚合为单个“未知系列”（2 个文件），当前切片所在系列自动展开
    expect(screen.getByText('未知系列（2 个文件）')).toBeTruthy()
    expect(screen.getByText('1 序列 · 2 张')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(2)
  })

  it('shows the placeholder when no DICOM asset has parsed metadata', () => {
    const bare: Asset = { ...asset('bare'), dicomMeta: undefined }
    renderPanel([bare])
    expect(screen.getByText(/暂无切片数据/)).toBeTruthy()
    expect(screen.queryByText('CHEN^WEI')).toBeNull()
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
  })
})
