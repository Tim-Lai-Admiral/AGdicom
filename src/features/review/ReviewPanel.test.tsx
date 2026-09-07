import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, ReviewHistory } from '../../domain/types.ts'
import ReviewPanel from './ReviewPanel.tsx'
import type { ReviewPanelProps } from './ReviewPanel.tsx'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'heart.png',
    kind: 'image',
    status: 'pending',
    tags: ['心脏'],
    note: '初始备注',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    ...overrides,
  }
}

const HISTORY: ReviewHistory = [
  { status: 'pending', comment: '', createdAt: '2026-09-03T08:00:00.000Z' },
  { status: 'passed', comment: '初审通过', createdAt: '2026-09-03T09:30:00.000Z' },
]

function setup(overrides: Partial<ReviewPanelProps> = {}) {
  const onAddTag = vi.fn()
  const onRemoveTag = vi.fn()
  const onSubmitReview = vi.fn()
  const onSaveNote = vi.fn()
  const onClose = vi.fn()
  const props: ReviewPanelProps = {
    asset: makeAsset(),
    history: HISTORY,
    tagNames: ['心脏', '肺部', '复查'],
    onAddTag,
    onRemoveTag,
    onSubmitReview,
    onSaveNote,
    onClose,
    ...overrides,
  }
  const utils = render(<ReviewPanel {...props} />)
  return { ...utils, onAddTag, onRemoveTag, onSubmitReview, onSaveNote, onClose, props }
}

describe('ReviewPanel', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders asset info, current status, tags and the review history', () => {
    setup()
    expect(screen.getByText('评审面板')).toBeTruthy()
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('图片', { selector: '.review-panel__asset-kind' })).toBeTruthy()
    // 当前状态指示（限定素材信息区，历史记录里也会有同文案）
    expect(screen.getByText('待评审', { selector: '.review-panel__asset .status-dot' })).toBeTruthy()
    expect(screen.getByLabelText('移除标签“心脏”')).toBeTruthy()
    expect(screen.getByText('评审历史（2）')).toBeTruthy()
  })

  it('adds a self-created tag via the input (trimmed) with feedback', () => {
    const { onAddTag } = setup()
    fireEvent.change(screen.getByLabelText('新建标签名'), { target: { value: '  随访  ' } })
    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    expect(onAddTag).toHaveBeenCalledTimes(1)
    expect(onAddTag).toHaveBeenCalledWith('随访')
    expect(screen.getByRole('status').textContent).toContain('已添加标签“随访”')
    expect((screen.getByLabelText('新建标签名') as HTMLInputElement).value).toBe('')
  })

  it('adds nothing when the new tag name is blank or duplicated', () => {
    const { onAddTag } = setup()
    fireEvent.change(screen.getByLabelText('新建标签名'), { target: { value: '   ' } })
    const add = screen.getByRole('button', { name: '添加标签' }) as HTMLButtonElement
    expect(add.disabled).toBeTruthy()
    fireEvent.click(add)
    expect(onAddTag).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('新建标签名'), { target: { value: '心脏' } })
    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    expect(onAddTag).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('标签“心脏”已存在')
  })

  it('quick-adds a tag from the global library and hides tags already on the asset', () => {
    const { onAddTag } = setup()
    // 已在素材上的“心脏”不再出现在全局标签库复用区
    expect(screen.queryByRole('button', { name: '添加标签“心脏”' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '添加标签“肺部”' }))
    expect(onAddTag).toHaveBeenCalledWith('肺部')
    fireEvent.click(screen.getByRole('button', { name: '添加标签“复查”' }))
    expect(onAddTag).toHaveBeenCalledWith('复查')
  })

  it('removes a tag via its remove button', () => {
    const { onRemoveTag } = setup()
    fireEvent.click(screen.getByRole('button', { name: '移除标签“心脏”' }))
    expect(onRemoveTag).toHaveBeenCalledTimes(1)
    expect(onRemoveTag).toHaveBeenCalledWith('心脏')
    expect(screen.getByRole('status').textContent).toContain('已移除标签“心脏”')
  })

  it('submits a review with the chosen status and comment, then clears the comment', () => {
    const { onSubmitReview } = setup()
    fireEvent.click(screen.getByLabelText('驳回'))
    fireEvent.change(screen.getByLabelText('评审意见'), {
      target: { value: '伪影明显，需重拍' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存评审' }))
    expect(onSubmitReview).toHaveBeenCalledTimes(1)
    expect(onSubmitReview).toHaveBeenCalledWith('rejected', '伪影明显，需重拍')
    expect((screen.getByLabelText('评审意见') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByRole('status').textContent).toContain('评审已保存：驳回')
  })

  it('syncs the status draft when the asset status changes externally (badge click)', () => {
    const { props, rerender } = setup()
    // 初始草稿与当前状态一致（待评审）
    expect((screen.getByLabelText('待评审') as HTMLInputElement).checked).toBe(true)
    // 模拟上层通过卡片徽标把状态改为“驳回”：面板草稿同步，不遗留旧选择
    rerender(<ReviewPanel {...props} asset={makeAsset({ status: 'rejected' })} />)
    expect((screen.getByLabelText('驳回') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('待评审') as HTMLInputElement).checked).toBe(false)
  })

  it('saves the note with feedback', () => {
    const { onSaveNote } = setup()
    fireEvent.change(screen.getByLabelText('备注内容'), {
      target: { value: '更新后的备注内容' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存备注' }))
    expect(onSaveNote).toHaveBeenCalledTimes(1)
    expect(onSaveNote).toHaveBeenCalledWith('更新后的备注内容')
    expect(screen.getByRole('status').textContent).toContain('备注已保存')
  })

  it('shows appended history after a new record arrives (append-only display)', () => {
    const { props, rerender } = setup()
    const extended: ReviewHistory = [
      ...HISTORY,
      { status: 'rejected', comment: '复审判定为不通过', createdAt: '2026-09-04T10:00:00.000Z' },
    ]
    rerender(<ReviewPanel {...props} history={extended} />)
    expect(screen.getByText('评审历史（3）')).toBeTruthy()
    // 限定历史列表项（面板里还有标签 <li>）
    const items = Array.from(document.querySelectorAll('.review-history__item'))
    expect(items).toHaveLength(3)
    expect(items[0]?.textContent).toContain('复审判定为不通过') // 最新在前
  })

  it('hides the delete entry when onDeleteAsset is not provided (CR-006 T-001)', () => {
    setup()
    expect(screen.queryByRole('button', { name: '删除素材' })).toBeNull()
    expect(screen.queryByRole('button', { name: '确认删除' })).toBeNull()
  })

  it('deletes only after the inline confirm; cancel keeps the asset (CR-006 T-001 / R-015)', () => {
    const onDeleteAsset = vi.fn()
    setup({ onDeleteAsset })
    // 入口存在且默认非确认态
    fireEvent.click(screen.getByRole('button', { name: '删除素材' }))
    expect(onDeleteAsset).not.toHaveBeenCalled()
    expect(
      screen.getByText(/确定删除“heart.png”？其评审历史与标签引用将一并清除/),
    ).toBeTruthy()

    // 取消：回到入口态，未删除
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onDeleteAsset).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '删除素材' })).toBeTruthy()

    // 确认：删除回调触发一次
    fireEvent.click(screen.getByRole('button', { name: '删除素材' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDeleteAsset).toHaveBeenCalledTimes(1)
  })

  it('resets the delete confirmation when switching to another asset', () => {
    const onDeleteAsset = vi.fn()
    const { props, rerender } = setup({ onDeleteAsset })
    fireEvent.click(screen.getByRole('button', { name: '删除素材' }))
    expect(screen.getByRole('button', { name: '确认删除' })).toBeTruthy()
    // 切换素材：确认态复位，不把上一素材的确认带到下一素材
    rerender(<ReviewPanel {...props} asset={makeAsset({ id: 'asset-2', name: 'lung.png' })} />)
    expect(screen.queryByRole('button', { name: '确认删除' })).toBeNull()
    expect(screen.getByRole('button', { name: '删除素材' })).toBeTruthy()
  })
})
