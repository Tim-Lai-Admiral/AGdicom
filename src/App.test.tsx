import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { loadState } from './store/repository.ts'
import { buildDicomFile } from './features/viewer/dicom/__fixtures__/buildDicomFile.ts'
import { buildStlFile } from './features/viewer/model3d/__fixtures__/buildStlFile.ts'

function makeFile(name: string, size = 64, type = ''): File {
  return new File([new Uint8Array(size)], name, { type })
}

function dropFiles(
  container: HTMLElement,
  files: File[],
): void {
  const dropzone = container.querySelector('.import-zone__drop') as HTMLDivElement
  fireEvent.drop(dropzone, { dataTransfer: { files } })
}

function compareButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: '比较' }) as HTMLButtonElement
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders the title, import zone and empty library state', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '素材评审工作台' })).toBeTruthy()
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    expect(screen.getByRole('button', { name: '选择文件' })).toBeTruthy()
    expect(screen.getByText('素材库（0）')).toBeTruthy()
    expect(screen.getByText(/尚无素材/)).toBeTruthy()
  })

  it('imports dropped files of all three kinds, dedupes and rejects unknown types', async () => {
    const { container } = render(<App />)

    // 三类素材各一个：成功导入并持久化
    dropFiles(container, [
      makeFile('heart.png', 64, 'image/png'),
      makeFile('scan.dcm', 128),
      makeFile('aorta.stl', 256),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 3 个素材')).toBeTruthy()
    })
    expect(screen.getByText('素材库（3）')).toBeTruthy()
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('图片', { selector: '.asset-row__kind' })).toBeTruthy()
    expect(Object.keys(loadState().state.assets)).toHaveLength(3)

    // 重复导入同一文件：提示已存在，不重复注册
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('已存在，跳过 1 个重复文件：')).toBeTruthy()
    })
    expect(screen.getByText('素材库（3）')).toBeTruthy()

    // 未知扩展名：明确提示，不注册
    dropFiles(container, [makeFile('readme.txt', 32, 'text/plain')])
    await waitFor(() => {
      expect(screen.getByText('无法导入 1 个文件：')).toBeTruthy()
    })
    expect(screen.getByText(/“readme\.txt”不是支持的素材类型/)).toBeTruthy()
    expect(screen.getByText('素材库（3）')).toBeTruthy()
    expect(Object.keys(loadState().state.assets)).toHaveLength(3)
  })

  it('filters the grid by kind and search, shows the empty result state and clears filters', async () => {
    const { container } = render(<App />)
    dropFiles(container, [
      makeFile('heart.png', 64, 'image/png'),
      makeFile('scan.dcm', 128),
      makeFile('aorta.stl', 256),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 3 个素材')).toBeTruthy()
    })

    // 类型筛选：仅显示图片，其余隐藏（其余筛选条件保持）
    fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'image' } })
    expect(screen.getByText('素材库（3）')).toBeTruthy()
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.queryByText('scan.dcm')).toBeNull()
    expect(screen.queryByText('aorta.stl')).toBeNull()

    // 组合搜索（大小写不敏感）：类型 + 搜索 AND 生效
    fireEvent.change(screen.getByLabelText('搜索'), { target: { value: 'HEART' } })
    expect(screen.getByText('heart.png')).toBeTruthy()

    // 组合条件下无结果：空态提示（网格不显示）
    fireEvent.change(screen.getByLabelText('搜索'), { target: { value: 'not-exist' } })
    expect(screen.getByText(/没有符合当前筛选条件的素材/)).toBeTruthy()
    expect(screen.queryByText('heart.png')).toBeNull()

    // 清空筛选：恢复全部素材
    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }))
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('scan.dcm')).toBeTruthy()
    expect(screen.getByText('aorta.stl')).toBeTruthy()
  })

  it('updates the status via the review panel (select → right column) and persists it (refresh-safe)', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    // 左栏行内状态点仅展示当前状态（圆点 + 文字双通道，无状态按钮）
    expect(screen.getByText('待评审', { selector: '.status-dot' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /当前状态：待评审/ })).toBeNull()

    // 状态修改入口：选中素材 → 右栏评审面板（CR-004 T-001）
    fireEvent.click(screen.getByRole('button', { name: '选择“heart.png”加入比较' }))
    const right = screen.getByRole('complementary', { name: '信息面板' })
    fireEvent.click(within(right).getByRole('radio', { name: '通过' }))
    fireEvent.click(within(right).getByRole('button', { name: '保存评审' }))
    expect(within(right).getByText('评审已保存：通过（已计入评审历史）')).toBeTruthy()

    // 左栏行状态点同步为通过（右栏素材信息区还有一份展示）
    const left = screen.getByRole('complementary', { name: '素材列表' })
    expect(within(left).getByText('通过', { selector: '.status-dot' })).toBeTruthy()

    // 状态刷新后保留（localStorage 持久化 + 评审历史留痕）
    const stored = loadState()
    const asset = Object.values(stored.state.assets)[0]
    if (asset === undefined) throw new Error('asset should exist after import')
    expect(asset.status).toBe('passed')
    expect(stored.state.reviews[asset.id]).toEqual([
      { status: 'passed', comment: '', createdAt: expect.any(String) },
    ])
  })

  it('opens the DICOM viewer from a dicom card, parses the file and persists metadata', async () => {
    // jsdom 的 blob URL 无法被 fetch 正确读取（环境限制），stub fetch 返回真实 fixture 字节，
    // 覆盖 App 层“点击 → 解析 → onMetasParsed 回写 → saveState 持久化”完整链路
    const dicomBytes = new Uint8Array(
      buildDicomFile({ patientName: '', patientID: '', patientIdentityRemoved: 'YES' }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => dicomBytes.slice().buffer,
      })),
    )
    // jsdom 无 2D Canvas：返回 null 触发查看器的“环境不支持”降级分支（不崩溃）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { container } = render(<App />)
    dropFiles(container, [new File([dicomBytes], 'scan.dcm', { type: 'application/dicom' })])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看“scan.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    // CR-003 T-004：查看器嵌入中央查看区，不再声明 aria-modal（非模态语义）
    expect(dialog.getAttribute('aria-modal')).toBeNull()
    await waitFor(() => {
      expect(within(dialog).getByText('CT')).toBeTruthy()
    })
    expect(within(dialog).getAllByText('已置空')).toHaveLength(2)
    expect(within(dialog).getByText('是', { selector: '.dicom-viewer__deid-yes' })).toBeTruthy()
    expect(within(dialog).getByText('1 张（本序列）')).toBeTruthy()

    // 解析出的元数据已回写素材并持久化（刷新后元数据表格仍可展示）
    const stored = loadState()
    const asset = Object.values(stored.state.assets)[0]
    expect(asset?.dicomMeta?.modality).toBe('CT')
    expect(asset?.dicomMeta?.deidentified).toBe(true)
    expect(asset?.dicomMeta?.sliceCount).toBe(1)

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('素材库（1）')).toBeTruthy()
  })

  it('shows the degrade message in the DICOM viewer when the bytes cannot be read', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('scan.dcm', 128)])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看“scan.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    // jsdom 环境 fetch(blob:nodedata:...) 返回乱码（非 DICOM）→ 解析失败 → 降级文案，不崩溃
    await waitFor(() => {
      expect(within(dialog).getAllByText(/无法解析该 DICOM 文件/).length).toBeGreaterThan(0)
    })
    expect(within(dialog).getByText('1 个文件无法解析，已按可用内容降级展示')).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('素材库（1）')).toBeTruthy()
  })

  it('compares two selected images side by side and exits via button and Esc', async () => {
    const { container } = render(<App />)
    dropFiles(container, [
      makeFile('heart.png', 64, 'image/png'),
      makeFile('lung.png', 64, 'image/png'),
      makeFile('brain.png', 64, 'image/png'),
      makeFile('scan.dcm', 128),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 4 个素材')).toBeTruthy()
    })

    // 未选中两张前“比较”不可用；dicom 卡片点击打开 DICOM 查看器（不参与比较选择）
    expect(compareButton().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '查看“scan.dcm”的 DICOM 详情' }))
    expect(screen.getByRole('dialog', { name: 'DICOM 详情' })).toBeTruthy()
    expect(compareButton().disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' }) // 关闭查看器，继续比较流程
    expect(screen.queryByRole('dialog')).toBeNull()

    // 选中第一张：提示已选 1/2，比较仍不可用
    fireEvent.click(screen.getByRole('button', { name: '选择“heart.png”加入比较' }))
    expect(screen.getByText(/已选 1\/2/)).toBeTruthy()
    expect(compareButton().disabled).toBe(true)

    // 选中第二张：自动进入比较，双图并排可见
    fireEvent.click(screen.getByRole('button', { name: '选择“lung.png”加入比较' }))
    const dialog = screen.getByRole('dialog', { name: '图片比较' })
    // CR-003 T-004：比较视图嵌入中央查看区，不再声明 aria-modal（非模态语义）
    expect(dialog.getAttribute('aria-modal')).toBeNull()
    expect(within(dialog).getByText('heart.png')).toBeTruthy()
    expect(within(dialog).getByText('lung.png')).toBeTruthy()

    // 退出按钮关闭比较，保留选中以便再次进入
    fireEvent.click(within(dialog).getByRole('button', { name: '退出比较' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(compareButton().disabled).toBe(false)

    // 已选满两张：点击第三张图片卡片被忽略
    fireEvent.click(screen.getByRole('button', { name: '选择“brain.png”加入比较' }))
    expect(compareButton().disabled).toBe(false)

    // 通过“比较”按钮再次进入，Esc 关闭
    fireEvent.click(compareButton())
    expect(screen.getByRole('dialog', { name: '图片比较' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // 取消选择一张后：比较按钮回到不可用
    fireEvent.click(screen.getByRole('button', { name: '取消选择“heart.png”' }))
    expect(compareButton().disabled).toBe(true)
  })

  it('imports a STL file directly via file selection and opens the 3D viewer from a model card', async () => {
    // R-011：内置样本已移除，STL 仅经文件选择导入。查看器加载 stub fetch：
    // 返回最小二进制 STL（arrayBuffer 供 loader 读取）。
    const stlBytes = new Uint8Array(buildStlFile())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => String(stlBytes.byteLength) },
        body: null,
        arrayBuffer: async () => stlBytes.slice().buffer,
      })),
    )
    // jsdom 无 WebGL：getContext 返回 null → 查看器走降级提示分支
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    // jsdom 无 URL.createObjectURL：注入桩让 model 素材带上会话 objectUrl（查看器需要）
    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => 'blob:mock-model',
      configurable: true,
      writable: true,
    })
    try {
      const { container } = render(<App />)
      dropFiles(container, [
        makeFile('heart.png', 64, 'image/png'),
        new File([stlBytes.slice()], 'aorta.stl', { type: 'model/stl' }),
      ])
      await waitFor(() => {
        expect(screen.getByText('成功导入 2 个素材')).toBeTruthy()
      })
      expect(screen.getByText('aorta.stl')).toBeTruthy()

      // 点击 model 卡片打开 3D 查看器（React.lazy 按需加载 chunk，需等待挂载）；
      // jsdom 无 WebGL → 降级提示而非崩溃
      fireEvent.click(screen.getByRole('button', { name: '查看“aorta.stl”的 3D 模型' }))
      const dialog = await screen.findByRole('dialog', { name: '3D 模型预览' })
      // CR-003 T-004：查看器嵌入中央查看区，不再声明 aria-modal（非模态语义）
      expect(dialog.getAttribute('aria-modal')).toBeNull()
      await waitFor(() => {
        expect(within(dialog).getByText(/不支持 WebGL/)).toBeTruthy()
      })
      expect(within(dialog).getByText('左键拖拽：旋转')).toBeTruthy()
      expect(within(dialog).getByText('右键拖拽：平移')).toBeTruthy()

      // Esc 关闭；素材库仍在；顶栏无内置样本按钮
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByRole('dialog', { name: '3D 模型预览' })).toBeNull()
      expect(screen.getByText('素材库（2）')).toBeTruthy()
      expect(screen.queryByRole('button', { name: '加载内置样本（STL）' })).toBeNull()
    } finally {
      if (originalCreateObjectURL === undefined) {
        delete (URL as { createObjectURL?: unknown }).createObjectURL
      } else {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
      }
    }
  })
})
