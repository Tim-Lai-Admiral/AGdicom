import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import ImportZone from './ImportZone.tsx'
import type { ImportZoneProps } from './ImportZone.tsx'
import type { ImportFeedback } from './useImport.ts'

function makeFile(name: string, size = 16): File {
  return new File([new Uint8Array(size)], name)
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'heart.png',
    kind: 'image',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    ...overrides,
  }
}

function renderZone(overrides: Partial<ImportZoneProps> = {}) {
  const onImportFiles = vi.fn()
  const props: ImportZoneProps = {
    importing: false,
    feedback: null,
    onImportFiles,
    ...overrides,
  }
  const utils = render(<ImportZone {...props} />)
  const dropzone = utils.container.querySelector('.import-zone__drop') as HTMLDivElement
  const input = utils.container.querySelector('input[type="file"]') as HTMLInputElement
  return { ...utils, dropzone, input, onImportFiles, props }
}

describe('ImportZone', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders drop hint, supported types and the select button', () => {
    renderZone()
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
    expect(screen.getByText(/支持导入/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '选择文件' })).toBeTruthy()
  })

  it('highlights while dragging over and clears on leave', () => {
    const { dropzone } = renderZone()
    expect(dropzone.className).not.toContain('is-active')
    fireEvent.dragEnter(dropzone)
    expect(dropzone.className).toContain('is-active')
    fireEvent.dragOver(dropzone)
    expect(dropzone.className).toContain('is-active')
    fireEvent.dragLeave(dropzone)
    expect(dropzone.className).not.toContain('is-active')
  })

  it('imports dropped files with the drag source', () => {
    const { dropzone, onImportFiles } = renderZone()
    const file = makeFile('heart.png')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    expect(onImportFiles).toHaveBeenCalledTimes(1)
    expect(onImportFiles).toHaveBeenCalledWith([file], '拖拽导入')
  })

  it('imports picked files with the picker source', () => {
    const { input, onImportFiles } = renderZone()
    const file = makeFile('scan.dcm')
    fireEvent.change(input, { target: { files: [file] } })
    expect(onImportFiles).toHaveBeenCalledTimes(1)
    expect(onImportFiles).toHaveBeenCalledWith([file], '文件选择导入')
  })

  it('shows importing status, large-file hint and disables the button while importing', () => {
    renderZone({ importing: true, importingLarge: true })
    expect(screen.getByText('导入中：正在后台处理大文件…')).toBeTruthy()
    const button = screen.getByRole('button', { name: '选择文件' }) as HTMLButtonElement
    expect(button.disabled).toBeTruthy()
  })

  it('renders success, duplicate, unknown and error feedback', () => {
    const feedback: ImportFeedback = {
      created: [makeAsset()],
      duplicates: [{ fileName: 'aorta.stl', fileSize: 512, kind: 'model' }],
      unknown: [
        {
          fileName: 'readme.txt',
          extension: 'txt',
          message: '“readme.txt”不是支持的素材类型。支持导入：图片（png/…）',
        },
      ],
      error: '保存失败：本地存储容量不足',
    }
    renderZone({ feedback })
    expect(screen.getByText('成功导入 1 个素材')).toBeTruthy()
    expect(screen.getByText('已存在，跳过 1 个重复文件：')).toBeTruthy()
    expect(screen.getByText('aorta.stl（3D 模型）')).toBeTruthy()
    expect(screen.getByText('无法导入 1 个文件：')).toBeTruthy()
    expect(screen.getByText('“readme.txt”不是支持的素材类型。支持导入：图片（png/…）')).toBeTruthy()
    expect(screen.getByText('保存失败：本地存储容量不足')).toBeTruthy()
  })

  it('dismisses feedback via the clear button', () => {
    const onClearFeedback = vi.fn()
    const feedback: ImportFeedback = {
      created: [makeAsset()],
      duplicates: [],
      unknown: [],
      error: null,
    }
    const { rerender } = renderZone({ feedback, onClearFeedback })
    fireEvent.click(screen.getByRole('button', { name: '知道了' }))
    expect(onClearFeedback).toHaveBeenCalledTimes(1)
    rerender(
      <ImportZone
        importing={false}
        feedback={null}
        onImportFiles={vi.fn()}
        onClearFeedback={onClearFeedback}
      />,
    )
    expect(screen.queryByText('成功导入 1 个素材')).toBeNull()
  })
})
