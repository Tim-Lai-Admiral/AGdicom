/**
 * 工作台布局测试（CR-003 T-002 / UI-001；T-004 补充功能入口链路）。
 *
 * 覆盖任务卡 Test requirements：
 * - 布局切换：四区（顶栏/左栏/中央/右栏）齐全；左/右栏面板开关（折叠后不溢出）；
 *   中央查看区按状态切换（导入视图 / 图片预览 / DICOM 查看器）；
 * - 左栏 DICOM 患者组展开：患者组 → series → 切片缩略图（复用 seriesUtils 数据），
 *   选中素材时对应患者组自动展开并高亮，点击切片切换；
 * - 折叠交互：右栏信息面板与顶栏开关联动；
 * - T-004：右栏评审全链路（状态/标签/备注/历史/AI 建议）与顶栏导出/导入入口回环。
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { loadState } from './store/repository.ts'
import {
  buildDicomFile,
  buildDicomSeriesBuffers,
  gradientPixels8,
} from './features/viewer/dicom/__fixtures__/buildDicomFile.ts'

function makeFile(name: string, size = 64, type = ''): File {
  return new File([new Uint8Array(size)], name, { type })
}

function dropFiles(container: HTMLElement, files: File[]): void {
  const dropzone = container.querySelector('.import-zone__drop') as HTMLDivElement
  fireEvent.drop(dropzone, { dataTransfer: { files } })
}

describe('App: 工作台布局（CR-003 T-002）', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders the four workbench regions and toggles the left/right panels', () => {
    render(<App />)

    // 四区齐全：顶栏（标题 + 面板开关）、左栏素材列表、中央导入视图、右栏占位提示
    expect(screen.getByRole('heading', { name: '素材评审工作台' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '切换左栏素材列表' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '切换右栏信息面板' })).toBeTruthy()
    expect(screen.getByText('素材库（0）')).toBeTruthy()
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    const right = screen.getByRole('complementary', { name: '信息面板' })
    expect(within(right).getByText(/在左栏选择素材/)).toBeTruthy()

    // 折叠左栏：素材列表从 DOM 移除（折叠不溢出）；再展开恢复
    fireEvent.click(screen.getByRole('button', { name: '切换左栏素材列表' }))
    expect(screen.queryByText('素材库（0）')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '切换左栏素材列表' }))
    expect(screen.getByText('素材库（0）')).toBeTruthy()

    // 折叠右栏：信息面板移除；再展开恢复
    fireEvent.click(screen.getByRole('button', { name: '切换右栏信息面板' }))
    expect(screen.queryByRole('complementary', { name: '信息面板' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '切换右栏信息面板' }))
    expect(screen.getByRole('complementary', { name: '信息面板' })).toBeTruthy()
  })

  it('shows the image preview in the center and the review panel on the right, and returns to the import view', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    // 点击图片卡片：中央显示图片预览，右栏显示评审面板（非 DICOM 素材 → 评审）
    fireEvent.click(screen.getByRole('button', { name: '选择“heart.png”加入比较' }))
    expect(screen.getByText('heart.png', { selector: '.image-stage__name' })).toBeTruthy()
    const right = screen.getByRole('complementary', { name: '信息面板' })
    expect(within(right).getByRole('heading', { name: '评审面板' })).toBeTruthy()

    // 顶栏“导入”：从查看状态返回中央导入视图
    fireEvent.click(screen.getByRole('button', { name: '导入' }))
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    expect(screen.queryByText('heart.png', { selector: '.image-stage__name' })).toBeNull()
  })

  it('opens the DICOM viewer in the center with the grouped metadata panel, and expands slices in the left sidebar', async () => {
    // 3 切片同 series：fetch 按调用顺序返回第 1~3 个 fixture 字节（查看器按
    // dicomAssets 顺序逐个解析），覆盖“导入 → 打开查看器解析 → 右栏分组 → 左栏切片”链路
    const buffers = buildDicomSeriesBuffers(3, {
      patientName: '',
      patientID: '',
      patientIdentityRemoved: 'YES',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    let fetchCall = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const bytes = new Uint8Array(buffers[Math.min(fetchCall, buffers.length - 1)])
        fetchCall += 1
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => bytes.slice().buffer,
        }
      }),
    )
    // jsdom 无 2D Canvas：返回 null 走查看器“环境不支持”降级分支（不崩溃）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const { container } = render(<App />)
    dropFiles(container, [
      new File([new Uint8Array(buffers[0])], 's1.dcm', { type: 'application/dicom' }),
      new File([new Uint8Array(buffers[1])], 's2.dcm', { type: 'application/dicom' }),
      new File([new Uint8Array(buffers[2])], 's3.dcm', { type: 'application/dicom' }),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 3 个素材')).toBeTruthy()
    })

    // 点击 DICOM 卡片：中央查看器打开；右栏默认显示元数据分组面板
    fireEvent.click(screen.getByRole('button', { name: '查看“s1.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitFor(() => {
      expect(within(dialog).getByText('CT')).toBeTruthy()
    })

    const right = screen.getByRole('complementary', { name: '信息面板' })
    expect(within(right).getByText('DICOM 元数据')).toBeTruthy()
    expect(within(right).getByRole('button', { name: /^患者信息/ })).toBeTruthy()
    expect(within(right).getAllByText('已置空')).toHaveLength(2)

    // 元数据分组可折叠：点击“患者信息”收起该组
    fireEvent.click(within(right).getByRole('button', { name: /^患者信息/ }))
    expect(within(right).queryByText('已置空')).toBeNull()
    fireEvent.click(within(right).getByRole('button', { name: /^患者信息/ }))
    expect(within(right).getAllByText('已置空')).toHaveLength(2)

    // DICOM 页签：右栏可切到评审面板（评审入口对 DICOM 素材仍可达）
    fireEvent.click(within(right).getByRole('button', { name: '评审' }))
    expect(within(right).getByRole('heading', { name: '评审面板' })).toBeTruthy()
    fireEvent.click(within(right).getByRole('button', { name: '元数据' }))
    expect(within(right).getByText('DICOM 元数据')).toBeTruthy()

    // 左栏患者组两级展开（CR-005 T-002 / R-012）：选中 s1 时其患者组面板自动展开；
    // 3 个文件姓名/ID 均空 → 单一“未知患者”组；同 series → 1 行 3 切片，
    // 当前素材所在 series 自动展开并高亮（患者组头 is-active + 缩略图 is-active）
    await waitFor(() => {
      expect(screen.getByText('未知患者')).toBeTruthy()
      expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
    })
    const activeThumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect((activeThumbs[0] as HTMLElement).className).toContain('is-active')

    // 关闭中央查看器 → 回到导入视图（左栏患者组面板保持展开状态）
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()

    // series 行可折叠：收起后缩略图隐藏，再展开恢复（series → 切片层级）
    const seriesToggle = screen.getByRole('button', { name: /Series/ })
    fireEvent.click(seriesToggle)
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
    fireEvent.click(seriesToggle)
    const thumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect(thumbs).toHaveLength(3)

    // 点击切片缩略图：以该切片素材打开中央查看器（切片 1 / 3）
    fireEvent.click(thumbs[0] as HTMLElement)
    const sliceDialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitFor(() => {
      expect(within(sliceDialog).getByText('切片 1 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
  })

  it('shows the W/L panel in the right column for a DICOM asset (CR-003 T-003 / R-003 修改)', async () => {
    // 单切片 DICOM：打开查看器后右栏“元数据”页签显示 W/L 区块（元数据分组上方）
    const buffer = buildDicomFile({
      patientName: '',
      patientID: '',
      patientIdentityRemoved: 'YES',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array(buffer).slice().buffer,
      })),
    )
    // jsdom 无 2D Canvas：走“环境不支持”降级分支（W/L 面板不依赖画布）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const { container } = render(<App />)
    dropFiles(container, [
      new File([new Uint8Array(buffer)], 's1.dcm', { type: 'application/dicom' }),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '查看“s1.dcm”的 DICOM 详情' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'DICOM 详情' })).toBeTruthy()
    })

    const right = screen.getByRole('complementary', { name: '信息面板' })
    expect(within(right).getByText('窗宽窗位（W/L）')).toBeTruthy()
    expect(
      within(right).getByRole('button', { name: '自动 min-max' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(right).getByText('当前：自动（min-max），拖动滑杆或选择预设切换手动')).toBeTruthy()

    // 六档预设可达；点击 Lung → 手动模式 + C/W 数值生效
    for (const name of ['Lung', 'Mediastinum', 'Bone', 'Brain', 'Liver', 'S. Tissue']) {
      expect(within(right).getByRole('button', { name })).toBeTruthy()
    }
    fireEvent.click(within(right).getByRole('button', { name: 'Lung' }))
    expect(within(right).getByText('当前：手动窗宽窗位')).toBeTruthy()
    expect(
      within(right).getByRole('button', { name: '自动 min-max' }).getAttribute('aria-pressed'),
    ).toBe('false')
    expect((within(right).getByLabelText('窗位 C') as HTMLInputElement).value).toBe('-600')
    expect((within(right).getByLabelText('窗宽 W') as HTMLInputElement).value).toBe('1500')

    // 自动按钮：回到自动 min-max
    fireEvent.click(within(right).getByRole('button', { name: '自动 min-max' }))
    expect(within(right).getByText('当前：自动（min-max），拖动滑杆或选择预设切换手动')).toBeTruthy()
  })

  it('supports the full review chain (status/tag/note/history/AI) in the right column (CR-003 T-004)', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    // 选中图片：右栏评审面板打开，AI 建议（Mock）区可达
    fireEvent.click(screen.getByRole('button', { name: '选择“heart.png”加入比较' }))
    const right = screen.getByRole('complementary', { name: '信息面板' })
    expect(within(right).getByRole('heading', { name: '评审面板' })).toBeTruthy()
    const aiSection = within(right).getByLabelText('AI 建议')
    expect(within(aiSection).getByText('Mock 生成')).toBeTruthy()
    expect(within(aiSection).getByText('命名建议')).toBeTruthy()

    // 提交评审（通过 + 意见）：反馈 + 历史留痕 + 持久化
    fireEvent.click(within(right).getByRole('radio', { name: '通过' }))
    fireEvent.change(within(right).getByLabelText('评审意见'), { target: { value: '初版可用' } })
    fireEvent.click(within(right).getByRole('button', { name: '保存评审' }))
    expect(within(right).getByText('评审已保存：通过（已计入评审历史）')).toBeTruthy()
    expect(within(right).getByText('评审历史（1）')).toBeTruthy()
    expect(within(right).getByText('初版可用')).toBeTruthy()
    const storedReview = Object.values(loadState().state.reviews)[0]?.[0]
    expect(storedReview).toMatchObject({ status: 'passed', comment: '初版可用' })

    // 新建标签：素材标签与全局标签库同步并持久化
    fireEvent.change(within(right).getByLabelText('新建标签名'), { target: { value: '心脏' } })
    fireEvent.click(within(right).getByRole('button', { name: '添加标签' }))
    expect(within(right).getByText('已添加标签“心脏”')).toBeTruthy()
    expect(within(right).getByText('心脏', { selector: '.review-panel__tag' })).toBeTruthy()
    expect(Object.keys(loadState().state.tags)).toContain('心脏')

    // 备注独立保存：不追加评审历史
    fireEvent.change(within(right).getByLabelText('备注内容'), { target: { value: '用于周会演示' } })
    fireEvent.click(within(right).getByRole('button', { name: '保存备注' }))
    expect(within(right).getByText('备注已保存')).toBeTruthy()
    expect(within(right).getByText('评审历史（1）')).toBeTruthy()
    expect(Object.values(loadState().state.assets)[0]?.note).toBe('用于周会演示')

    // 采纳 AI 命名建议：仅用户点击后重命名并持久化（Mock 规则对图片给“图片-序号”）
    fireEvent.click(within(aiSection).getByRole('button', { name: '采纳命名（填入名称）' }))
    expect(within(aiSection).getByText('已采纳命名建议（可在需要时手动再改）')).toBeTruthy()
    const renamed = Object.values(loadState().state.assets)[0]
    expect(renamed?.name).toMatch(/^图片-/)
    expect(renamed?.name).not.toBe('heart.png')
  })

  it('round-trips a backup through the toolbar export/import entry (CR-003 T-004)', async () => {
    // 下载桩：捕获导出 Blob 与锚点（jsdom 无下载能力），用例结束后还原
    const blobs: Blob[] = []
    const anchors: HTMLAnchorElement[] = []
    const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (blob: Blob): string => {
        blobs.push(blob)
        return `blob:mock-${blobs.length}`
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick(
      this: HTMLAnchorElement,
    ) {
      anchors.push(this)
    })
    try {
      const { container } = render(<App />)
      dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
      await waitFor(() => {
        expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
      })

      // 顶栏“导出”按钮：展开 ExportImport 弹出面板
      fireEvent.click(screen.getByRole('button', { name: '导出' }))
      const exportSection = screen.getByLabelText('导出与导入')
      expect(within(exportSection).getByRole('button', { name: '导出 JSON' })).toBeTruthy()

      // 导出：触发下载（文件名 + schema v1 内容）+ 成功反馈
      fireEvent.click(within(exportSection).getByRole('button', { name: '导出 JSON' }))
      expect(anchors).toHaveLength(1)
      expect(anchors[0]?.download).toMatch(/^review-export-\d{8}-\d{6}\.json$/)
      expect(within(exportSection).getByRole('status').textContent).toContain(
        '已导出评审数据（1 个素材）',
      )
      const blob = blobs[blobs.length - 1] // 导入素材的会话 objectUrl 也走 createObjectURL：导出 Blob 是最后一个
      if (blob === undefined) throw new Error('export blob missing')
      const content = await blob.text()
      expect((JSON.parse(content) as { schemaVersion: number }).schemaVersion).toBe(1)

      // 导入同名备份：深度校验通过 → 名称冲突确认 → 整体替换并持久化
      const input = within(exportSection).getByLabelText('选择备份 JSON 文件') as HTMLInputElement
      fireEvent.change(input, {
        target: { files: [new File([content], 'backup.json', { type: 'application/json' })] },
      })
      await waitFor(() => {
        expect(within(exportSection).getByRole('alert').textContent).toContain(
          '1 个名称与现有素材冲突',
        )
      })
      fireEvent.click(within(exportSection).getByRole('button', { name: '仍然导入' }))
      await waitFor(() => {
        expect(within(exportSection).getByRole('status').textContent).toContain(
          '已导入并还原 1 个素材',
        )
      })
      expect(Object.keys(loadState().state.assets)).toHaveLength(1)
    } finally {
      if (originalCreate === undefined) {
        delete (URL as { createObjectURL?: unknown }).createObjectURL
      } else {
        Object.defineProperty(URL, 'createObjectURL', originalCreate)
      }
      if (originalRevoke === undefined) {
        delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
      } else {
        Object.defineProperty(URL, 'revokeObjectURL', originalRevoke)
      }
    }
  })
})
