/**
 * 非 DICOM 素材信息面板（CR-015 T-001 / R-036，工作台右栏“元数据”页签）。
 *
 * 右栏页签（元数据/评审）对所有素材开放后，非 DICOM 素材的“元数据”页签展示
 * 文件级信息（名称/类型/来源/大小/创建/更新时间）；复用 MetadataPanel 的
 * .meta-row/.meta-label/.meta-value 行样式，不引入新的展示结构。
 * DICOM 素材的元数据页签仍走 MetadataPanel（分组结构不变）。
 */
import type { Asset } from '../../domain/types.ts'
import { ASSET_KIND_LABELS } from '../../domain/types.ts'

/** 字节数 → 人类可读大小：≥1MB 显示 MB、≥1KB 显示 KB（一位小数）、不足 1KB 显示 B */
export function formatAssetSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

export interface AssetInfoPanelProps {
  /** 当前选中的非 DICOM 素材 */
  asset: Asset
}

export default function AssetInfoPanel({ asset }: AssetInfoPanelProps) {
  const rows = [
    { label: '名称', value: asset.name },
    { label: '类型', value: ASSET_KIND_LABELS[asset.kind] },
    { label: '来源', value: asset.source === '' ? '未提供' : asset.source },
    { label: '大小', value: formatAssetSize(asset.file.fileSize) },
    { label: '创建时间', value: new Date(asset.createdAt).toLocaleString() },
    { label: '更新时间', value: new Date(asset.updatedAt).toLocaleString() },
  ]
  return (
    <section className="meta-panel" aria-label="素材信息">
      <h2 className="meta-panel__title">素材信息</h2>
      <div className="meta-panel__body">
        <div className="meta-panel__rows">
          {rows.map((row) => (
            <div key={row.label} className="meta-row">
              <span className="meta-label">{row.label}</span>
              <span className="meta-value is-plain" title={row.value}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
