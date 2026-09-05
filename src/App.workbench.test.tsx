/**
 * 工作台布局测试（CR-003 T-002 / UI-001）。
 *
 * 覆盖任务卡 Test requirements：
 * - 布局切换：四区（顶栏/左栏/中央/右栏）齐全；左/右栏面板开关（折叠后不溢出）；
 *   中央查看区按状态切换（导入视图 / 图片预览 / DICOM 查看器）；
 * - 左栏 DICOM 展开：series + 切片缩略图（复用 seriesUtils 数据），点击切片切换；
 * - 折叠交互：右栏信息面板与顶栏开关联动。
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { buildDicomSeriesBuffers, gradientPixels8 } from './features/viewer/dicom/__fixtures__/buildDicomFile.ts'

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

    // 关闭中央查看器 → 回到导入视图
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()

    // 左栏展开切片：series + 切片缩略图（解析回写后 seriesUtils 可分组）；
    // 每张 DICOM 卡片都有自己的展开开关，取第一张
    const expandToggles = screen.getAllByRole('button', { name: '展开切片' })
    fireEvent.click(expandToggles[0] as HTMLElement)
    const thumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect(thumbs).toHaveLength(3)

    // 点击切片缩略图：以该切片素材打开中央查看器（切片 1 / 3）
    fireEvent.click(thumbs[0] as HTMLElement)
    const sliceDialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitFor(() => {
      expect(within(sliceDialog).getByText('切片 1 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
  })
})
