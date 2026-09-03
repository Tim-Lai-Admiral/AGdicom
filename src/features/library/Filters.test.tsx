import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ASSET_FILTER } from '../../domain/filter.ts'
import type { AssetFilter } from '../../domain/filter.ts'
import Filters from './Filters.tsx'

function renderFilters(
  filter: AssetFilter = DEFAULT_ASSET_FILTER,
  tagNames: readonly string[] = ['复查', '心脏'],
) {
  const onChange = vi.fn()
  render(<Filters filter={filter} tagNames={tagNames} onChange={onChange} />)
  return { onChange }
}

describe('Filters', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders the four parallel controls with the tag list and a disabled clear button by default', () => {
    renderFilters()
    expect(screen.getByLabelText('类型')).toBeTruthy()
    expect(screen.getByLabelText('状态')).toBeTruthy()
    expect(screen.getByLabelText('标签')).toBeTruthy()
    expect(screen.getByLabelText('搜索')).toBeTruthy()
    const tagSelect = screen.getByLabelText('标签') as HTMLSelectElement
    // 全部标签 + 两个现有标签
    expect(tagSelect.options).toHaveLength(3)
    expect(tagSelect.options[0]?.textContent).toBe('全部标签')
    const reset = screen.getByRole('button', { name: '清空筛选' }) as HTMLButtonElement
    expect(reset.disabled).toBe(true) // 默认条件无可清空
  })

  it('changes the kind filter and maps “全部类型” back to null', () => {
    const { onChange } = renderFilters(DEFAULT_ASSET_FILTER, [])
    fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'image' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_ASSET_FILTER, kind: 'image' })
    fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'all' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_ASSET_FILTER, kind: null })
  })

  it('changes the status filter and maps “全部状态” back to null', () => {
    const { onChange } = renderFilters(DEFAULT_ASSET_FILTER, [])
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'passed' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_ASSET_FILTER, status: 'passed' })
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'all' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_ASSET_FILTER, status: null })
  })

  it('changes the tag filter and maps “全部标签” (empty value) back to null', () => {
    const { onChange } = renderFilters(DEFAULT_ASSET_FILTER, ['心脏'])
    fireEvent.change(screen.getByLabelText('标签'), { target: { value: '心脏' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_ASSET_FILTER, tag: '心脏' })
    fireEvent.change(screen.getByLabelText('标签'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_ASSET_FILTER, tag: null })
  })

  it('updates the search keyword immediately on each keystroke', () => {
    const { onChange } = renderFilters(DEFAULT_ASSET_FILTER, [])
    fireEvent.change(screen.getByLabelText('搜索'), { target: { value: 'h' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_ASSET_FILTER, search: 'h' })
    fireEvent.change(screen.getByLabelText('搜索'), { target: { value: 'he' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_ASSET_FILTER, search: 'he' })
  })

  it('preserves the other conditions when a single control changes (AND 组合)', () => {
    const filter: AssetFilter = {
      kind: 'image',
      status: 'passed',
      tag: '心脏',
      search: 'heart',
    }
    const { onChange } = renderFilters(filter, ['心脏'])
    fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'dicom' } })
    expect(onChange).toHaveBeenCalledWith({
      kind: 'dicom',
      status: 'passed',
      tag: '心脏',
      search: 'heart',
    })
  })

  it('resets to the default filter via the clear button once any condition is active', () => {
    const { onChange } = renderFilters({ ...DEFAULT_ASSET_FILTER, kind: 'image' }, [])
    const reset = screen.getByRole('button', { name: '清空筛选' }) as HTMLButtonElement
    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_ASSET_FILTER })
  })
})
