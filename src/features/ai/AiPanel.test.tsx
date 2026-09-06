import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import AiPanel from './AiPanel.tsx'
import type { AiPanelProps } from './AiPanel.tsx'
import type { AIProvider } from './types.ts'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'file1.dcm',
    kind: 'dicom',
    status: 'pending',
    tags: ['CT'],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'file1.dcm', fileSize: 524288, fileType: '' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    dicomMeta: {
      modality: 'CT',
      seriesInstanceUID: '1.2.840.10008',
      sliceCount: 12,
      deidentified: true,
    },
    ...overrides,
  }
}

const THROWING_PROVIDER: AIProvider = {
  id: 'boom',
  label: '抛错提供方',
  suggest(): never {
    throw new Error('boom')
  },
}

function setup(overrides: Partial<AiPanelProps> = {}) {
  const onAddTag = vi.fn()
  const onAcceptName = vi.fn()
  const props: AiPanelProps = {
    asset: makeAsset(),
    onAddTag,
    onAcceptName,
    ...overrides,
  }
  const utils = render(<AiPanel {...props} />)
  return { ...utils, onAddTag, onAcceptName, props }
}

describe('AiPanel', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders the Mock notice with name, tag and summary suggestions', () => {
    setup()
    expect(screen.getByText('AI 建议')).toBeTruthy()
    expect(screen.getByText('Mock 生成')).toBeTruthy()
    expect(screen.getByText('CT-序列1.2.840-12切片')).toBeTruthy()
    const tags = Array.from(document.querySelectorAll('.ai-panel__tag'))
    expect(tags).toHaveLength(4) // DICOM / CT（已存在） / 已去标识化 / 多切片序列
    expect(tags[1]?.textContent).toContain('（已存在）')
    expect(screen.getByText('CT 序列（已去标识化），共 12 张切片。')).toBeTruthy()
  })

  it('accepts the name suggestion by calling onAcceptName (never renames automatically)', () => {
    const { onAcceptName } = setup()
    expect(onAcceptName).not.toHaveBeenCalled() // 未点击前不得有任何自动变更
    fireEvent.click(screen.getByRole('button', { name: '采纳命名（填入名称）' }))
    expect(onAcceptName).toHaveBeenCalledTimes(1)
    expect(onAcceptName).toHaveBeenCalledWith('CT-序列1.2.840-12切片')
    expect(screen.getByRole('status').textContent).toContain('已采纳命名建议')
  })

  it('merges only the tags not yet on the asset via onAddTag', () => {
    const { onAddTag } = setup()
    fireEvent.click(screen.getByRole('button', { name: '采纳标签（合并 3 个）' }))
    expect(onAddTag).toHaveBeenCalledTimes(3)
    expect(onAddTag).toHaveBeenCalledWith('DICOM')
    expect(onAddTag).toHaveBeenCalledWith('已去标识化')
    expect(onAddTag).toHaveBeenCalledWith('多切片序列')
    expect(onAddTag).not.toHaveBeenCalledWith('CT') // 已存在的标签不重复合并
    expect(screen.getByRole('status').textContent).toContain('已合并 3 个标签建议')
  })

  it('ignoring produces no side effects and hides the suggestions', () => {
    const { onAddTag, onAcceptName } = setup()
    fireEvent.click(screen.getByRole('button', { name: '忽略建议' }))
    expect(onAddTag).not.toHaveBeenCalled()
    expect(onAcceptName).not.toHaveBeenCalled()
    expect(screen.queryByText('CT-序列1.2.840-12切片')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('未产生任何变更')
  })

  it('degrades to an empty suggestion without crashing when the provider throws', () => {
    setup({ provider: THROWING_PROVIDER })
    expect(screen.getByText('暂无建议：生成失败，素材数据不受影响。')).toBeTruthy()
    expect(screen.queryByText('Mock 生成')).toBeTruthy() // Mock 标注仍在
    expect(screen.queryByRole('button', { name: '忽略建议' })).toBeNull()
  })
})
