/**
 * 非 DICOM 素材信息面板单测（CR-015 T-001 / R-036）。
 *
 * 覆盖验收“非 DICOM 元数据页签显示文件信息”：名称/类型/来源/大小/创建/更新时间
 * 行渲染、.meta-row 行样式复用、大小格式化（B/KB/MB）与时间本地化输出。
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import AssetInfoPanel, { formatAssetSize } from './AssetInfoPanel.tsx'
import type { Asset } from '../../domain/types.ts'

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

describe('AssetInfoPanel（CR-015 T-001 / R-036）', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders name/kind/source/size/created/updated rows reusing meta-row styles', () => {
    const asset = makeAsset({
      name: 'aorta.stl',
      kind: 'model',
      file: { fileName: 'aorta.stl', fileSize: 512, fileType: '' },
    })
    const { container } = render(<AssetInfoPanel asset={asset} />)
    expect(screen.getByText('素材信息')).toBeTruthy()
    expect(screen.getByText('aorta.stl')).toBeTruthy()
    expect(screen.getByText('3D 模型')).toBeTruthy()
    expect(screen.getByText('拖拽导入')).toBeTruthy()
    expect(screen.getByText('512B')).toBeTruthy()
    // 时间本地化：与同一环境的 toLocaleString 输出一致（创建/更新两行各一）
    expect(screen.getAllByText(new Date('2026-09-03T08:00:00.000Z').toLocaleString())).toHaveLength(2)
    // 复用 MetadataPanel 的行样式
    expect(container.querySelectorAll('.meta-row')).toHaveLength(6)
    expect(container.querySelectorAll('.meta-label')).toHaveLength(6)
    expect(container.querySelectorAll('.meta-value')).toHaveLength(6)
  })

  it('formats sizes as B below 1KB, KB below 1MB and MB above (one decimal)', () => {
    expect(formatAssetSize(64)).toBe('64B')
    expect(formatAssetSize(1024)).toBe('1.0KB')
    expect(formatAssetSize(2048)).toBe('2.0KB')
    expect(formatAssetSize(1024 * 1024)).toBe('1.0MB')
    expect(formatAssetSize(5 * 1024 * 1024 + 1200)).toBe('5.0MB')
  })
})
