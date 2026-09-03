import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import { loadState } from './store/repository.ts'

function makeFile(name: string, size = 64, type = ''): File {
  return new File([new Uint8Array(size)], name, { type })
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
    const dropzone = container.querySelector('.import-zone__drop') as HTMLDivElement

    // 三类素材各一个：成功导入并持久化
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [
          makeFile('heart.png', 64, 'image/png'),
          makeFile('scan.dcm', 128),
          makeFile('aorta.stl', 256),
        ],
      },
    })
    await waitFor(() => {
      expect(screen.getByText('成功导入 3 个素材')).toBeTruthy()
    })
    expect(screen.getByText('素材库（3）')).toBeTruthy()
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('图片')).toBeTruthy()
    expect(Object.keys(loadState().state.assets)).toHaveLength(3)

    // 重复导入同一文件：提示已存在，不重复注册
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('heart.png', 64, 'image/png')] },
    })
    await waitFor(() => {
      expect(screen.getByText('已存在，跳过 1 个重复文件：')).toBeTruthy()
    })
    expect(screen.getByText('素材库（3）')).toBeTruthy()

    // 未知扩展名：明确提示，不注册
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('readme.txt', 32, 'text/plain')] },
    })
    await waitFor(() => {
      expect(screen.getByText('无法导入 1 个文件：')).toBeTruthy()
    })
    expect(screen.getByText(/“readme\.txt”不是支持的素材类型/)).toBeTruthy()
    expect(screen.getByText('素材库（3）')).toBeTruthy()
    expect(Object.keys(loadState().state.assets)).toHaveLength(3)
  })
})
