/**
 * 素材网格（CR-001 T-004 / R-002）。
 *
 * 卡片：缩略图（image 用会话级 objectUrl 渲染，缺失或加载失败时显示占位与提示，
 * 不破坏网格；dicom/model 显示类型图标占位）、名称、类型中文标签、状态徽标。
 * 交互：image 卡片主体可点击切换“比较选中”（最多两张，选中集合与上限由上层管理）；
 * dicom 卡片主体可点击打开 DICOM 查看器（onOpenDicom，T-005 接入；未提供时保持
 * 不可交互，兼容无查看器的使用场景）；model 卡片主体可点击打开 3D 模型查看器
 * （onOpenModel，T-006 接入；未提供时保持不可交互）；
 * 状态徽标可点击切换状态（setAssetStatus 计算与 saveState 持久化由上层完成）。
 *
 * objectUrl 说明：T-003 导入时为 image 素材创建会话级 objectUrl（URL.createObjectURL），
 * 该字段不持久化——刷新后无法从 fileName 重建（原始 File 引用不在持久化数据中），
 * 因此刷新后图片卡片显示占位与提示；重新导入同一文件可恢复预览。
 */
import { useEffect, useState } from 'react'
import type { Asset, AssetKind, AssetStatus } from '../../domain/types.ts'
import { ASSET_KIND_LABELS } from '../../domain/types.ts'
import StatusBadge from './StatusBadge.tsx'

export interface AssetGridProps {
  assets: readonly Asset[]
  /** 当前选中的素材 ID（用于图片比较，最多两张） */
  selectedIds: readonly string[]
  /** 点击 image 卡片主体：切换比较选中 */
  onToggleSelect: (assetId: string) => void
  /** 点击状态徽标：设置新状态（持久化由上层完成） */
  onSetStatus: (assetId: string, status: AssetStatus) => void
  /** 点击 dicom 卡片主体：打开 DICOM 查看器（T-005）；未提供时 dicom 卡片不可交互 */
  onOpenDicom?: (assetId: string) => void
  /** 点击 model 卡片主体：打开 3D 模型查看器（T-006）；未提供时 model 卡片不可交互 */
  onOpenModel?: (assetId: string) => void
}

/** 图片预览缺失时的占位提示（objectUrl 为会话字段，刷新后需重新导入该图片） */
const IMAGE_PREVIEW_UNAVAILABLE = '预览不可用：刷新后需重新导入该图片'
const IMAGE_LOAD_FAILED = '图片加载失败'

/** 类型图标（纯装饰）：image=图片、dicom=扫描框、model=立方体 */
function KindGlyph({ kind }: { kind: AssetKind }) {
  if (kind === 'image') {
    return (
      <svg
        className="asset-card__glyph"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="9.5" r="1.5" />
        <path d="M4 16.5l4.5-5 3 3.5 3.5-4 5 5.5" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'dicom') {
    return (
      <svg
        className="asset-card__glyph"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg
      className="asset-card__glyph"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  )
}

/** 卡片缩略图：image 渲染 objectUrl，缺失 / 加载失败 / 其他类型显示占位 */
function CardThumb({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false)
  const objectUrl = asset.objectUrl
  // objectUrl 变化（如重新导入后）时复位加载失败状态
  useEffect(() => {
    setFailed(false)
  }, [objectUrl])

  if (asset.kind !== 'image' || objectUrl === undefined || failed) {
    return (
      <div className="asset-card__thumb">
        <KindGlyph kind={asset.kind} />
        {asset.kind === 'image' ? (
          <p className="asset-card__thumb-hint">
            {failed ? IMAGE_LOAD_FAILED : IMAGE_PREVIEW_UNAVAILABLE}
          </p>
        ) : null}
      </div>
    )
  }
  return (
    <div className="asset-card__thumb">
      <img
        className="asset-card__img"
        src={objectUrl}
        alt={`素材“${asset.name}”的图片预览`}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function AssetCard({
  asset,
  selected,
  onToggleSelect,
  onSetStatus,
  onOpenDicom,
  onOpenModel,
}: {
  asset: Asset
  selected: boolean
  onToggleSelect: (assetId: string) => void
  onSetStatus: (assetId: string, status: AssetStatus) => void
  onOpenDicom?: (assetId: string) => void
  onOpenModel?: (assetId: string) => void
}) {
  const isImage = asset.kind === 'image'
  const isDicomOpenable = asset.kind === 'dicom' && onOpenDicom !== undefined
  const isModelOpenable = asset.kind === 'model' && onOpenModel !== undefined
  const mainContent = (
    <>
      <CardThumb asset={asset} />
      <p className="asset-card__name" title={asset.name}>
        {asset.name}
      </p>
    </>
  )
  return (
    <li className={selected ? 'asset-card is-selected' : 'asset-card'}>
      {isImage ? (
        <button
          type="button"
          className="asset-card__main"
          aria-pressed={selected}
          aria-label={
            selected ? `取消选择“${asset.name}”` : `选择“${asset.name}”加入比较`
          }
          onClick={() => onToggleSelect(asset.id)}
        >
          {mainContent}
        </button>
      ) : isDicomOpenable ? (
        <button
          type="button"
          className="asset-card__main"
          aria-label={`查看“${asset.name}”的 DICOM 详情`}
          onClick={() => onOpenDicom?.(asset.id)}
        >
          {mainContent}
        </button>
      ) : isModelOpenable ? (
        <button
          type="button"
          className="asset-card__main"
          aria-label={`查看“${asset.name}”的 3D 模型`}
          onClick={() => onOpenModel?.(asset.id)}
        >
          {mainContent}
        </button>
      ) : (
        <div className="asset-card__main">{mainContent}</div>
      )}
      {selected ? (
        <span className="asset-card__selected-mark" aria-hidden="true">
          已选中
        </span>
      ) : null}
      <div className="asset-card__meta">
        <span className="asset-card__kind">{ASSET_KIND_LABELS[asset.kind]}</span>
        <StatusBadge
          status={asset.status}
          onSetStatus={(status) => onSetStatus(asset.id, status)}
        />
      </div>
    </li>
  )
}

export default function AssetGrid({
  assets,
  selectedIds,
  onToggleSelect,
  onSetStatus,
  onOpenDicom,
  onOpenModel,
}: AssetGridProps) {
  return (
    <ul className="asset-grid">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          selected={selectedIds.includes(asset.id)}
          onToggleSelect={onToggleSelect}
          onSetStatus={onSetStatus}
          onOpenDicom={onOpenDicom}
          onOpenModel={onOpenModel}
        />
      ))}
    </ul>
  )
}
