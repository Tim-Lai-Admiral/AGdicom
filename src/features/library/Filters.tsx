/**
 * 素材筛选栏（CR-001 T-004 / R-002）。
 *
 * 交互：类型 / 状态 / 标签 / 名称搜索四个并列控件，为受控组件——任一变更立即
 * 回调 onChange（由上层重算网格，即时生效）；“清空筛选”一键恢复默认条件。
 * 布局：控件单行并列；窄屏（溢出时）横向滚动，不溢出页面。
 *
 * 值映射：类型/状态用枚举值 + “all”（isAssetKind / isAssetStatus 归一化为 null
 * 表示全部）；标签用空串表示“全部标签”（正常流程不会产生空名标签：
 * addAssetTag 拒绝空白名，且标签注册表键为非空原文）。
 */
import type { ChangeEvent } from 'react'
import {
  ASSET_KIND_LABELS,
  ASSET_STATUS_LABELS,
  isAssetKind,
  isAssetStatus,
} from '../../domain/types.ts'
import type { AssetFilter } from '../../domain/filter.ts'
import { DEFAULT_ASSET_FILTER, isDefaultAssetFilter } from '../../domain/filter.ts'

const KIND_OPTIONS: readonly ('image' | 'dicom' | 'model')[] = ['image', 'dicom', 'model']
const STATUS_OPTIONS: readonly ('pending' | 'passed' | 'rejected')[] = [
  'pending',
  'passed',
  'rejected',
]

export interface FiltersProps {
  filter: AssetFilter
  /** 可选标签名列表（注册表 ∪ 素材在用标签，由 App 用 collectTagNames 计算） */
  tagNames: readonly string[]
  /** 任一筛选条件变更时回调，携带完整的新筛选条件（各条件组合由上层 AND 生效） */
  onChange: (filter: AssetFilter) => void
}

export default function Filters({ filter, tagNames, onChange }: FiltersProps) {
  const handleKindChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = event.currentTarget.value
    onChange({ ...filter, kind: isAssetKind(value) ? value : null })
  }

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = event.currentTarget.value
    onChange({ ...filter, status: isAssetStatus(value) ? value : null })
  }

  const handleTagChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = event.currentTarget.value
    onChange({ ...filter, tag: value === '' ? null : value })
  }

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...filter, search: event.currentTarget.value })
  }

  const handleReset = (): void => {
    onChange({ ...DEFAULT_ASSET_FILTER })
  }

  return (
    <div className="filters" role="group" aria-label="素材筛选">
      <div className="filters__field">
        <label className="filters__label" htmlFor="library-filter-kind">
          类型
        </label>
        <select
          id="library-filter-kind"
          className="filters__select"
          value={filter.kind ?? 'all'}
          onChange={handleKindChange}
        >
          <option value="all">全部类型</option>
          {KIND_OPTIONS.map((kind) => (
            <option key={kind} value={kind}>
              {ASSET_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>
      <div className="filters__field">
        <label className="filters__label" htmlFor="library-filter-status">
          状态
        </label>
        <select
          id="library-filter-status"
          className="filters__select"
          value={filter.status ?? 'all'}
          onChange={handleStatusChange}
        >
          <option value="all">全部状态</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {ASSET_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="filters__field">
        <label className="filters__label" htmlFor="library-filter-tag">
          标签
        </label>
        <select
          id="library-filter-tag"
          className="filters__select"
          value={filter.tag ?? ''}
          onChange={handleTagChange}
        >
          <option value="">全部标签</option>
          {tagNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="filters__field filters__field--search">
        <label className="filters__label" htmlFor="library-filter-search">
          搜索
        </label>
        <input
          id="library-filter-search"
          className="filters__search"
          type="search"
          placeholder="按名称搜索"
          value={filter.search}
          onChange={handleSearchChange}
        />
      </div>
      <button
        type="button"
        className="filters__reset"
        disabled={isDefaultAssetFilter(filter)}
        onClick={handleReset}
      >
        清空筛选
      </button>
    </div>
  )
}
