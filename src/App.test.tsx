import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import { loadState } from './store/repository.ts'

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
    expect(screen.getByText('图片', { selector: '.asset-card__kind' })).toBeTruthy()
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

  it('updates the status via the badge and persists it (refresh-safe)', async () => {
    const { container } = render(<App />)
    dropFiles(container, [makeFile('heart.png', 64, 'image/png')])
    await waitFor(() => {
      expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    })

    // 徽标展示当前状态（颜色 + 文字双通道）
    expect(screen.getByText('待评审', { selector: '.status-badge' })).toBeTruthy()

    // 点击徽标：待评审 → 通过
    fireEvent.click(screen.getByRole('button', { name: /当前状态：待评审/ }))
    expect(screen.getByText('通过', { selector: '.status-badge' })).toBeTruthy()

    // 状态刷新后保留（localStorage 持久化 + 评审历史留痕）
    const stored = loadState()
    const asset = Object.values(stored.state.assets)[0]
    if (asset === undefined) throw new Error('asset should exist after import')
    expect(asset.status).toBe('passed')
    expect(stored.state.reviews[asset.id]).toEqual([
      { status: 'passed', comment: '', createdAt: expect.any(String) },
    ])
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

    // 未选中两张前“比较”不可用；非 image 卡片点击不参与选择
    expect(compareButton().disabled).toBe(true)
    fireEvent.click(screen.getByText('scan.dcm'))
    expect(compareButton().disabled).toBe(true)

    // 选中第一张：提示已选 1/2，比较仍不可用
    fireEvent.click(screen.getByRole('button', { name: '选择“heart.png”加入比较' }))
    expect(screen.getByText(/已选 1\/2/)).toBeTruthy()
    expect(compareButton().disabled).toBe(true)

    // 选中第二张：自动进入比较，双图并排可见
    fireEvent.click(screen.getByRole('button', { name: '选择“lung.png”加入比较' }))
    const dialog = screen.getByRole('dialog', { name: '图片比较' })
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
})
