/**
 * 工作台布局测试（CR-003 T-002 / UI-001；T-004 补充功能入口链路）。
 *
 * 覆盖任务卡 Test requirements：
 * - 布局切换：四区（顶栏/左栏/中央/右栏）齐全；左/右栏抽屉开合（CR-009 T-003 /
 *   R-026：收起不卸载做宽度过渡动画，is-closed + aria-hidden/inert 标记，不溢出）；
 *   中央查看区按状态切换（导入视图 / 图片预览 / DICOM 查看器）；
 * - 左栏 DICOM 患者分组独立面板（CR-008 T-001 / R-021）：面板一次渲染全部患者组，
 *   患者组 → series → 切片缩略图（复用 seriesUtils 数据）；选中素材时对应患者组
 *   自动展开并高亮，点击切片仅切换中央查看器与高亮（面板停留原位、展开状态不变）；
 * - 切片高亮同步（CR-008 T-002 / R-022）：查看器内滑动条切换切片 → 左栏分组面板
 *   对应缩略图高亮实时跟随（onSelectedSliceChange 通路）；关闭查看器 → 高亮清理；
 * - 折叠交互：右栏信息面板与顶栏开关联动；
 * - T-004：右栏评审全链路（状态/标签/备注/历史/AI 建议）与顶栏导出/导入入口回环；
 * - CR-012 T-001：右栏页签字号放大（样式断言）与设置弹窗骨架（顶栏设置按钮开合、
 *   Esc/关闭按钮关闭、占位字段展示；持久化由 T-002 接入）。
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
// 本用例需读取样式源码断言布局规则：jsdom 不应用样式表，且 ?raw 导入经 vitest
// 禁用 CSS 的管线会得到空串，故用 node:fs（tsconfig.app 的 types 已含 node）
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

    // 折叠左栏（CR-009 T-003 / R-026 抽屉）：面板保留挂载做宽度过渡动画，
    // 收起态以 is-closed 类 + aria-hidden/inert 标记（内容不溢出，由 CSS 裁剪）
    const leftAside = screen.getByRole('complementary', { name: '素材列表' })
    fireEvent.click(screen.getByRole('button', { name: '切换左栏素材列表' }))
    expect(leftAside.className).toContain('is-closed')
    expect(leftAside.getAttribute('aria-hidden')).toBe('true')
    expect(leftAside.getAttribute('inert')).toBe('')
    fireEvent.click(screen.getByRole('button', { name: '切换左栏素材列表' }))
    expect(leftAside.className).not.toContain('is-closed')
    expect(leftAside.getAttribute('aria-hidden')).toBe('false')

    // 折叠右栏：同款抽屉行为（保留挂载 + is-closed + aria-hidden/inert）
    const rightAside = screen.getByRole('complementary', { name: '信息面板' })
    fireEvent.click(screen.getByRole('button', { name: '切换右栏信息面板' }))
    expect(rightAside.className).toContain('is-closed')
    expect(rightAside.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '切换右栏信息面板' }))
    expect(rightAside.className).not.toContain('is-closed')
    expect(rightAside.getAttribute('aria-hidden')).toBe('false')
  })

  it('styles the right-column meta/review tabs as equal-width halves with underline highlight (CR-011 T-001)', () => {
    // jsdom 不应用样式表（无法计算真实布局），断言样式源码规则（去空白后比对，
    // 兼容压缩形态）；页签结构（两个 workbench__tab 按钮与切换行为）由 DICOM
    // 页签集成用例覆盖。npm test/verify 均在项目根运行，用根相对路径读取
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
    const tabRule = (/[.]workbench__tab\s*\{([^}]*)\}/.exec(css)?.[1] ?? '').replace(/\s+/g, ' ')
    // 两页签等宽各占一半（flex: 1 1 0 均分剩余空间；压缩形态仍保留数字间单空格）
    expect(tabRule).toContain('flex: 1 1 0')
    // 下划线高亮保留（CR-010 T-001 图样）
    expect(tabRule).toContain('border-bottom: 2px solid')
  })

  it('enlarges the right-column tab font size to 13px (CR-012 T-001)', () => {
    // 同上：jsdom 不应用样式表，断言样式源码规则（CR-012 T-001：10.5px → 13px）
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
    const tabRule = (/[.]workbench__tab\s*\{([^}]*)\}/.exec(css)?.[1] ?? '').replace(/\s+/g, ' ')
    expect(tabRule).toContain('font-size: 13px')
  })

  it('shows the image preview in the center and the review panel on the right, and returns to the import view', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    // 点击图片卡片：中央显示图片预览，右栏显示评审面板（非 DICOM 素材 → 评审）；
    // 普通模式行点击=中央查看（CR-011 T-002）
    fireEvent.click(screen.getByRole('button', { name: '查看图片“heart.png”' }))
    expect(screen.getByText('heart.png', { selector: '.image-stage__name' })).toBeTruthy()
    const right = screen.getByRole('complementary', { name: '信息面板' })
    // CR-011 T-001：面板常驻右栏，无标题头（以面板 landmark 断言，而非 heading）
    expect(within(right).getByRole('complementary', { name: '评审面板' })).toBeTruthy()

    // 顶栏“导入”：从查看状态返回中央导入视图
    fireEvent.click(screen.getByRole('button', { name: '导入' }))
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    expect(screen.queryByText('heart.png', { selector: '.image-stage__name' })).toBeNull()
  })

  it('closes the image preview via Escape (CR-011 T-001 fix / review B1)', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('lung.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '查看图片“lung.png”' }))
    expect(screen.getByText('lung.png', { selector: '.image-stage__name' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    })
    expect(screen.queryByText('lung.png', { selector: '.image-stage__name' })).toBeNull()
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
      // CR-009 T-001：中央视口四角元数据（R-023）——去标识化样本右上为“CT · 去标识化”
      expect(within(dialog).getByText('CT · 去标识化')).toBeTruthy()
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
    expect(within(right).getByRole('complementary', { name: '评审面板' })).toBeTruthy()
    fireEvent.click(within(right).getByRole('button', { name: '元数据' }))
    expect(within(right).getByText('DICOM 元数据')).toBeTruthy()

    // 左栏患者分组独立面板（CR-008 T-001 / R-021）：素材行无“展开切片”控件，
    // 面板仅渲染一次；选中 s1 后其患者组自动展开：3 个文件姓名/ID 均空 → 单一
    // “未知患者”组；同 series → 1 行 3 切片，当前素材所在 series 自动展开并高亮
    // （分组头 is-active + 缩略图 is-active）
    await waitFor(() => {
      expect(screen.getByText('未知患者')).toBeTruthy()
      expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
    })
    expect(document.querySelectorAll('.dicom-panel')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '展开切片' })).toBeNull()
    expect(screen.getByText('未知患者').closest('button')?.className).toContain('is-active')
    const activeThumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect((activeThumbs[0] as HTMLElement).className).toContain('is-active')

    // 关闭中央查看器 → 回到导入视图（分组面板展开状态保持：面板与素材行解耦）
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    expect(screen.getByText('未知患者')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)

    // series 行可折叠：收起后缩略图隐藏，再展开恢复（series → 切片层级）
    const seriesToggle = screen.getByRole('button', { name: /Series/ })
    fireEvent.click(seriesToggle)
    expect(screen.queryByRole('button', { name: /^查看切片/ })).toBeNull()
    fireEvent.click(seriesToggle)
    const thumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect(thumbs).toHaveLength(3)

    // 点击分组面板中的切片缩略图：中央打开该切片（切片 2 / 3）；面板停留原位
    // （仍在左栏素材列表下方，分组头与全部切片缩略图保持不变，高亮跟随）
    fireEvent.click(thumbs[1] as HTMLElement)
    const sliceDialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitFor(() => {
      expect(within(sliceDialog).getByText('切片 2 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
    expect(screen.getByText('未知患者')).toBeTruthy()
    const leftColumn = screen.getByRole('complementary', { name: '素材列表' })
    expect(within(leftColumn).getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
    const highlightThumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect((highlightThumbs[1] as HTMLElement).className).toContain('is-active')
  })

  it('follows viewer slice switches with the left panel highlight and clears it on close (CR-008 T-002 / R-022)', async () => {
    // 3 切片同 series：查看器内滑动条切换 → 左栏分组面板高亮实时跟随（R-022）
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
    // jsdom 无 2D Canvas：走查看器“环境不支持”降级分支（高亮通路不依赖画布）
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

    // 打开 s1：患者分组自动展开，当前切片（#1）缩略图高亮
    fireEvent.click(screen.getByRole('button', { name: '查看“s1.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(3)
    })
    expect(screen.getByRole('button', { name: '查看切片 #1' }).className).toContain('is-active')
    expect(screen.getByRole('button', { name: '查看切片 #2' }).className).not.toContain('is-active')

    // 滑动条切到 #2：左栏高亮实时跟随到切片 #2（中央读数同步）
    fireEvent.change(within(dialog).getByLabelText('选择切片'), { target: { value: '2' } })
    await waitFor(() => {
      expect(within(dialog).getByText('切片 2 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: '查看切片 #2' }).className).toContain('is-active')
    expect(screen.getByRole('button', { name: '查看切片 #1' }).className).not.toContain('is-active')

    // 点击左栏切片（现有路径不回归）：中央切到 #3、高亮跟随到 #3
    fireEvent.click(screen.getByRole('button', { name: '查看切片 #3' }))
    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog', { name: 'DICOM 详情' })).getByText(
          '切片 3 / 3（按 InstanceNumber 排序）',
        ),
      ).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: '查看切片 #3' }).className).toContain('is-active')
    expect(screen.getByRole('button', { name: '查看切片 #2' }).className).not.toContain('is-active')

    // 关闭查看器：高亮清理（分组面板与展开状态保留，无任何 is-active）
    fireEvent.click(within(screen.getByRole('dialog', { name: 'DICOM 详情' })).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const remainingThumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect(remainingThumbs).toHaveLength(3)
    for (const thumb of remainingThumbs) {
      expect((thumb as HTMLElement).className).not.toContain('is-active')
    }
    expect(screen.getByText('未知患者').closest('button')?.className).not.toContain('is-active')
  })

  it('syncs the meta panel with the viewer slice while the review tab stays on the selected asset (CR-013 T-001 / R-022 扩展)', async () => {
    // 3 切片同 series：查看器内滑动条切换 → 右栏元数据页签跟随当前切片
    // （切片序号随切片变化）；评审页签仍绑定选中素材（activeAsset 不随切片改变）
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
    // jsdom 无 2D Canvas：走查看器“环境不支持”降级分支（元数据通路不依赖画布）
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
    fireEvent.click(screen.getByRole('button', { name: '查看“s1.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitFor(() => {
      expect(within(dialog).getByText('CT · 去标识化')).toBeTruthy()
    })

    // 元数据页签：元数据解析回写后展开“图像信息”分组 → 当前切片（#1）的切片序号
    const right = screen.getByRole('complementary', { name: '信息面板' })
    await waitFor(() => {
      expect(within(right).getByRole('button', { name: /^图像信息/ })).toBeTruthy()
    })
    fireEvent.click(within(right).getByRole('button', { name: /^图像信息/ }))
    await waitFor(() => {
      expect(within(right).getByText('#1')).toBeTruthy()
    })

    // 滑动条切到 #2：元数据页签同步为切片 #2（实例号随切片变化）
    fireEvent.change(within(dialog).getByLabelText('选择切片'), { target: { value: '2' } })
    await waitFor(() => {
      expect(within(right).getByText('#2')).toBeTruthy()
    })
    expect(within(right).queryByText('#1')).toBeNull()

    // 评审页签仍绑定选中素材（s1.dcm）：面板素材名不随切片切换
    fireEvent.click(within(right).getByRole('button', { name: '评审' }))
    expect(
      within(right).getByText('s1.dcm', { selector: '.review-panel__asset-name' }),
    ).toBeTruthy()

    // 回到元数据页签：仍绑定当前切片（#2）——页签切换会重挂载面板并重置分组
    // 折叠态，重新展开“图像信息”后断言
    fireEvent.click(within(right).getByRole('button', { name: '元数据' }))
    fireEvent.click(within(right).getByRole('button', { name: /^图像信息/ }))
    expect(within(right).getByText('#2')).toBeTruthy()
  })

  it('renders the patient group panel above the asset list and hides it without DICOM assets (CR-013 T-001 / R-032)', async () => {
    const { container } = render(<App />)
    // 仅图片素材：无 DICOM → 分组面板不渲染，仅素材库列表（不回归）
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })
    expect(container.querySelector('.dicom-panel')).toBeNull()
    expect(container.querySelector('.asset-list')).toBeTruthy()

    // 追加 DICOM 素材：分组面板（自带标题）出现在素材库列表上方——DOM 顺序断言
    const buffer = buildDicomFile({
      patientName: '',
      patientID: '',
      patientIdentityRemoved: 'YES',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    dropFiles(container, [
      new File([new Uint8Array(buffer)], 's1.dcm', { type: 'application/dicom' }),
    ])
    await waitFor(() => {
      expect(screen.getByText('素材库（2）')).toBeTruthy()
    })
    const leftBody = container.querySelector('.workbench__left-body') as HTMLElement
    const panel = leftBody.querySelector('.dicom-panel') as HTMLElement
    const grid = leftBody.querySelector('.asset-list') as HTMLElement
    expect(panel).toBeTruthy()
    expect(grid).toBeTruthy()
    const children = Array.from(leftBody.children)
    expect(children.indexOf(panel)).toBeGreaterThan(-1)
    expect(children.indexOf(grid)).toBeGreaterThan(-1)
    expect(children.indexOf(panel)).toBeLessThan(children.indexOf(grid))
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

    // 选中图片：右栏评审面板打开，AI 建议（Mock）区可达（普通模式行点击=中央查看）
    fireEvent.click(screen.getByRole('button', { name: '查看图片“heart.png”' }))
    const right = screen.getByRole('complementary', { name: '信息面板' })
    expect(within(right).getByRole('complementary', { name: '评审面板' })).toBeTruthy()
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

describe('App: 设置弹窗（CR-012 T-001 / R-027 骨架）', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('opens the settings dialog from the toolbar and closes it via Escape and the close button', () => {
    render(<App />)

    // 顶栏设置按钮（齿轮，aria-label=设置）：开合状态经 aria-expanded 呈现
    expect(screen.queryByRole('dialog', { name: '设置' })).toBeNull()
    const settingsButton = screen.getByRole('button', { name: '设置' })
    expect(settingsButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(settingsButton)

    // 弹窗骨架：标题 + 占位字段（文本/密码框/两个开关）+ 保存/取消
    const dialog = screen.getByRole('dialog', { name: '设置' })
    expect(settingsButton.getAttribute('aria-expanded')).toBe('true')
    expect(within(dialog).getByRole('heading', { name: '设置' })).toBeTruthy()
    expect(within(dialog).getByLabelText('API Base URL')).toBeTruthy()
    expect(within(dialog).getByLabelText('API Key')).toBeTruthy()
    expect(within(dialog).getByRole('checkbox', { name: '启用' })).toBeTruthy()
    expect(within(dialog).getByRole('checkbox', { name: '失败回退 Mock' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '保存' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeTruthy()

    // Esc 关闭（弹窗自身处理；App 的图片预览 Esc 兜底在弹窗打开期间跳过）
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '设置' })).toBeNull()
    expect(settingsButton.getAttribute('aria-expanded')).toBe('false')

    // 再次打开 → 弹窗「关闭」按钮关闭
    fireEvent.click(settingsButton)
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '设置' })).getByRole('button', {
        name: '关闭设置',
      }),
    )
    expect(screen.queryByRole('dialog', { name: '设置' })).toBeNull()
  })
})

describe('App: 素材删除（CR-006 T-001 / R-015）', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('deletes via the review panel entry with inline confirm, cascades cleanup and allows re-import', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    // 选中图片：中央预览 + 右栏评审面板；先留评审历史与标签，验证级联清理
    fireEvent.click(screen.getByRole('button', { name: '查看图片“heart.png”' }))
    expect(screen.getByText('heart.png', { selector: '.image-stage__name' })).toBeTruthy()
    const right = screen.getByRole('complementary', { name: '信息面板' })
    fireEvent.click(within(right).getByRole('radio', { name: '通过' }))
    fireEvent.click(within(right).getByRole('button', { name: '保存评审' }))
    fireEvent.change(within(right).getByLabelText('新建标签名'), { target: { value: '心脏' } })
    fireEvent.click(within(right).getByRole('button', { name: '添加标签' }))
    expect(Object.keys(loadState().state.reviews)).toHaveLength(1)

    // 取消：不删除（二次确认语义）
    fireEvent.click(within(right).getByRole('button', { name: '删除素材' }))
    fireEvent.click(within(right).getByRole('button', { name: '取消' }))
    expect(within(right).getByRole('button', { name: '删除素材' })).toBeTruthy()
    expect(screen.getByText('heart.png', { selector: '.image-stage__name' })).toBeTruthy()

    // 确认删除：中央回导入视图、列表清空、右栏回到空提示
    fireEvent.click(within(right).getByRole('button', { name: '删除素材' }))
    fireEvent.click(within(right).getByRole('button', { name: '确认删除' }))
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    expect(screen.getByText('素材库（0）')).toBeTruthy()
    const emptiedRight = screen.getByRole('complementary', { name: '信息面板' })
    expect(within(emptiedRight).getByText(/在左栏选择素材/)).toBeTruthy()

    // 级联清理无孤儿：资产/评审历史清空；标签注册表保留条目、计数归零
    const stored = loadState().state
    expect(Object.keys(stored.assets)).toHaveLength(0)
    expect(Object.keys(stored.reviews)).toHaveLength(0)
    expect(stored.tags['心脏']).toEqual({ name: '心脏', count: 0 })

    // 删除后重导入同一文件：正常新增（不报重复、无幽灵残留）
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    // 导入期间上一批反馈面板仍在（同文本），等待目标用列表计数（导入完成的真信号）：
    // T-003 起导入完成前多一拍 blob 入库（失败降级也不阻塞），状态落地稍晚于旧时序
    await waitFor(() => {
      expect(screen.getByText('素材库（1）')).toBeTruthy()
    })
    expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
  })

  it('deletes via the inline row button on the selected row', async () => {
    const { container } = render(<App />)
    dropFiles(container, [
      makeFile('heart.png', 64, 'image/png'),
      makeFile('lung.png', 32, 'image/png'),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 2 个素材')).toBeTruthy()
    })

    // 未选中行不显示删除入口；点击行（查看该图片，行成为工作台当前素材）后入口出现
    expect(screen.queryByRole('button', { name: '删除素材 heart.png' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '查看图片“heart.png”' }))
    fireEvent.click(screen.getByRole('button', { name: '删除素材 heart.png' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除“heart.png”' }))

    // 列表同步移除；其余行不受影响；持久化同步
    expect(screen.getByText('素材库（1）')).toBeTruthy()
    expect(screen.queryByText('heart.png', { selector: '.asset-row__name' })).toBeNull()
    expect(screen.getByRole('button', { name: '查看图片“lung.png”' })).toBeTruthy()
    expect(Object.keys(loadState().state.assets)).toHaveLength(1)
  })

  it('deleting the active DICOM asset closes the viewer; the decoupled panel keeps the remaining slice visible', async () => {
    // 2 切片同 series：患者分组 → series → 切片层级由剩余素材即时重建
    const buffers = buildDicomSeriesBuffers(2, {
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
    // jsdom 无 2D Canvas：走查看器“环境不支持”降级分支（不崩溃）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const { container } = render(<App />)
    dropFiles(container, [
      new File([new Uint8Array(buffers[0])], 's1.dcm', { type: 'application/dicom' }),
      new File([new Uint8Array(buffers[1])], 's2.dcm', { type: 'application/dicom' }),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 2 个素材')).toBeTruthy()
    })

    // 打开查看器（选中 → 患者分组自动展开）并等待 series 分组建成（2 切片）
    fireEvent.click(screen.getByRole('button', { name: '查看“s1.dcm”的 DICOM 详情' }))
    expect(screen.getByRole('dialog', { name: 'DICOM 详情' })).toBeTruthy()
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(2)
    })

    // 行内删除当前 DICOM 素材：中央查看器关闭、列表同步；分组面板与素材行解耦
    // （CR-008 T-001 / R-021）：面板展开状态不随删除清理，剩余素材的分组
    // （1 组 1 系列 1 切片）仍展示
    fireEvent.click(screen.getByRole('button', { name: '删除素材 s1.dcm' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除“s1.dcm”' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('素材库（1）')).toBeTruthy()
    expect(screen.getByText('未知患者')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(1)
    expect(Object.keys(loadState().state.assets)).toHaveLength(1)
  })
})
