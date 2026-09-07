/**
 * 素材行列表（CR-004 T-001：UI 全面对齐 rec/ 设计，取代旧卡片网格）。
 *
 * 行（rec SeriesSidebar 行风格）：38px 方形缩略图 + 名称行 + 元信息行
 * （类型 · 状态点，mono 字体）；选中行 accent 左边框 + 底色。
 * 无独立卡片容器、无行内“评审”按钮、无状态徽标按钮——状态与评审统一经
 * “选中素材 → 右栏评审面板”完成（数据持久化契约不变）。
 *
 * 交互：image 行主体可点击切换“比较选中”（最多两张，选中集合与上限由上层
 * 管理，同时作为“在中央查看该图片”）；dicom 行主体可点击打开 DICOM 查看器
 * （onOpenDicom，T-005 接入；未提供时保持不可交互）；model 行主体可点击打开
 * 3D 模型查看器（onOpenModel，T-006 接入；未提供时保持不可交互）。
 * 行内删除（CR-006 T-001 / R-015）：仅选中行（比较选中或工作台当前素材）显示
 * “删除”按钮，点击进入内联确认态（确认/取消），确认后回调 onDeleteAsset。
 *
 * objectUrl 说明：导入时为素材创建会话级 objectUrl（URL.createObjectURL），该字段
 * 不持久化。≤20MB 素材的文件字节已入 IndexedDB，启动时自动重建 objectUrl（CR-006 T-003）；
 * >20MB 或本地二进制库不可用的素材刷新后无文件内容，图片行显示占位与提示
 * （统一措辞，CR-006 T-004：可重新导入水合或删除该素材）。
 * DICOM 行缩略图（CR-007 T-002 / R-017）：素材解析后（dicomMeta 存在）经
 * sliceThumb 生成真实首帧 dataURL（会话级缓存，不持久化、不入导出），生成失败
 * 或无会话字节时保持类型图标占位。
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Asset, AssetKind } from '../../domain/types.ts'
import { ASSET_KIND_LABELS } from '../../domain/types.ts'
import { generateSliceThumb, getCachedSliceThumb } from '../viewer/dicom/sliceThumb.ts'
import StatusDot from './StatusDot.tsx'

export interface AssetGridProps {
  assets: readonly Asset[]
  /** 当前选中的素材 ID（用于图片比较，最多两张） */
  selectedIds: readonly string[]
  /** 点击 image 行主体：切换比较选中 */
  onToggleSelect: (assetId: string) => void
  /** 点击 dicom 行主体：打开 DICOM 查看器（T-005）；未提供时 dicom 行不可交互 */
  onOpenDicom?: (assetId: string) => void
  /** 点击 model 行主体：打开 3D 模型查看器（T-006）；未提供时 model 行不可交互 */
  onOpenModel?: (assetId: string) => void
  /**
   * 行附加内容插槽（CR-003 T-002 工作台布局）：渲染在行主体之后。
   * CR-008 T-001 起患者分组移至左栏独立面板（R-021），App 不再传入；
   * 可选 props 保留向后兼容，未提供时不渲染。
   */
  renderExtras?: (asset: Asset) => ReactNode
  /**
   * 工作台当前素材（中央查看区联动，CR-006 T-001）：与 selectedIds 一样视为
   * “选中行”，共同决定行内删除按钮的显隐；缺省时仅按 selectedIds 判断。
   */
  activeAssetId?: string | null
  /** 删除素材（R-015，二次确认由行内确认态完成，级联清理与持久化由上层负责）；
   *  未提供时行内不渲染删除入口（既有调用方不受影响） */
  onDeleteAsset?: (assetId: string) => void
}

/** 幽灵占位提示统一措辞（CR-006 T-004）：会话文件内容未保留，可重新导入水合或删除该素材 */
const IMAGE_PREVIEW_UNAVAILABLE = '预览不可用：会话失效，可重新导入或删除该素材'
const IMAGE_LOAD_FAILED = '图片加载失败'

/** 类型图标（纯装饰）：image=图片、dicom=扫描框、model=立方体 */
function RowGlyph({ kind }: { kind: AssetKind }) {
  if (kind === 'image') {
    return (
      <svg
        className="asset-row__glyph"
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
        className="asset-row__glyph"
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
      className="asset-row__glyph"
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

/**
 * 行缩略图：image 渲染 objectUrl；dicom 已解析且像素可解码时渲染真实首帧
 * （sliceThumb 会话级 dataURL，R-017；该素材解析后自动生成），未生成/生成失败
 * （压缩/解码失败/会话失效）回退类型占位；缺失 / 加载失败 / 其他类型显示类型占位
 * （title 附提示）。
 */
function RowThumb({
  asset,
  broken,
  hint,
  onImageError,
}: {
  asset: Asset
  broken: boolean
  hint: string | null
  onImageError: () => void
}) {
  const title = hint ?? undefined
  /** dicom 行真实首帧缩略图；null = 未生成 / 生成失败 → RowGlyph 占位 */
  const [dicomThumb, setDicomThumb] = useState<string | null>(() =>
    asset.kind === 'dicom' ? (getCachedSliceThumb(asset.id) ?? null) : null,
  )
  const objectUrl = asset.objectUrl
  const parsed = asset.dicomMeta !== undefined
  // 行缩略图生成（R-017）：该素材已解析（dicomMeta 存在）且有会话 objectUrl 时生成；
  // 会话缓存由 sliceThumb 承担（失败为确定性结果，不重复重试）。objectUrl 恢复
  // （blob 水合）/变化时重新评估。
  useEffect(() => {
    if (asset.kind !== 'dicom' || objectUrl === undefined || !parsed) {
      setDicomThumb(null)
      return
    }
    let cancelled = false
    const cached = getCachedSliceThumb(asset.id) ?? null
    setDicomThumb(cached)
    if (cached !== null) return
    void generateSliceThumb(asset).then((dataUrl) => {
      if (!cancelled && dataUrl !== null) setDicomThumb(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [asset, objectUrl, parsed])
  if (asset.kind === 'image' && asset.objectUrl !== undefined && !broken) {
    return (
      <div className="sidebar-thumb asset-row__thumb" title={title}>
        <img
          className="asset-row__img"
          src={asset.objectUrl}
          alt={`素材“${asset.name}”的图片预览`}
          onError={onImageError}
        />
      </div>
    )
  }
  if (asset.kind === 'dicom' && dicomThumb !== null) {
    return (
      <div className="sidebar-thumb asset-row__thumb" title={title}>
        <img
          className="asset-row__img"
          src={dicomThumb}
          alt={`素材“${asset.name}”的切片缩略图`}
        />
      </div>
    )
  }
  return (
    <div className="sidebar-thumb asset-row__thumb" title={title}>
      <RowGlyph kind={asset.kind} />
    </div>
  )
}

function AssetRow({
  asset,
  selected,
  active,
  onToggleSelect,
  onOpenDicom,
  onOpenModel,
  renderExtras,
  onDelete,
}: {
  asset: Asset
  selected: boolean
  /** 工作台当前素材（与 selected 共同决定删除按钮显隐） */
  active: boolean
  onToggleSelect: (assetId: string) => void
  onOpenDicom?: (assetId: string) => void
  onOpenModel?: (assetId: string) => void
  renderExtras?: (asset: Asset) => ReactNode
  onDelete?: (assetId: string) => void
}) {
  const isImage = asset.kind === 'image'
  const isDicomOpenable = asset.kind === 'dicom' && onOpenDicom !== undefined
  const isModelOpenable = asset.kind === 'model' && onOpenModel !== undefined
  const [imgFailed, setImgFailed] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const objectUrl = asset.objectUrl
  // objectUrl 变化（如重新导入后）时复位加载失败状态
  useEffect(() => {
    setImgFailed(false)
  }, [objectUrl])
  // 行不再处于选中态（取消比较选中 / 切走工作台素材）时复位删除确认，避免残留确认态
  const canDelete = onDelete !== undefined && (selected || active)
  useEffect(() => {
    if (!canDelete) setConfirmingDelete(false)
  }, [canDelete])
  const previewBroken = asset.kind === 'image' && (objectUrl === undefined || imgFailed)
  const previewHint = previewBroken
    ? imgFailed
      ? IMAGE_LOAD_FAILED
      : IMAGE_PREVIEW_UNAVAILABLE
    : null
  const rowContent = (
    <>
      <RowThumb
        asset={asset}
        broken={previewBroken}
        hint={previewHint}
        onImageError={() => setImgFailed(true)}
      />
      <span className="asset-row__text">
        <span className="asset-row__name" title={asset.name}>
          {asset.name}
        </span>
        <span className="asset-row__meta">
          <span className="asset-row__kind">{ASSET_KIND_LABELS[asset.kind]}</span>
          <span className="asset-row__meta-sep" aria-hidden="true">
            ·
          </span>
          <StatusDot status={asset.status} />
        </span>
        {previewHint !== null ? (
          <span className="asset-row__hint">{previewHint}</span>
        ) : null}
      </span>
    </>
  )
  return (
    <li className={selected ? 'asset-row is-selected' : 'asset-row'}>
      {isImage ? (
        <button
          type="button"
          className="asset-row__main"
          aria-pressed={selected}
          aria-label={
            selected ? `取消选择“${asset.name}”` : `选择“${asset.name}”加入比较`
          }
          onClick={() => onToggleSelect(asset.id)}
        >
          {rowContent}
        </button>
      ) : isDicomOpenable ? (
        <button
          type="button"
          className="asset-row__main"
          aria-label={`查看“${asset.name}”的 DICOM 详情`}
          onClick={() => onOpenDicom?.(asset.id)}
        >
          {rowContent}
        </button>
      ) : isModelOpenable ? (
        <button
          type="button"
          className="asset-row__main"
          aria-label={`查看“${asset.name}”的 3D 模型`}
          onClick={() => onOpenModel?.(asset.id)}
        >
          {rowContent}
        </button>
      ) : (
        <div className="asset-row__main">{rowContent}</div>
      )}
      {/* 行内删除（CR-006 T-001 / R-015）：仅选中行显示；内联二次确认（确认/取消） */}
      {canDelete ? (
        <span className="asset-row__actions">
          {confirmingDelete ? (
            <>
              <span className="asset-row__confirm-text">确认删除？</span>
              <button
                type="button"
                className="asset-row__confirm-yes"
                aria-label={`确认删除“${asset.name}”`}
                onClick={() => onDelete?.(asset.id)}
              >
                确认
              </button>
              <button
                type="button"
                className="asset-row__confirm-no"
                aria-label={`取消删除“${asset.name}”`}
                onClick={() => setConfirmingDelete(false)}
              >
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              className="asset-row__delete"
              aria-label={`删除素材 ${asset.name}`}
              onClick={() => setConfirmingDelete(true)}
            >
              删除
            </button>
          )}
        </span>
      ) : null}
      {renderExtras !== undefined ? renderExtras(asset) : null}
    </li>
  )
}

export default function AssetGrid({
  assets,
  selectedIds,
  onToggleSelect,
  onOpenDicom,
  onOpenModel,
  renderExtras,
  activeAssetId,
  onDeleteAsset,
}: AssetGridProps) {
  return (
    <ul className="asset-list">
      {assets.map((asset) => (
        <AssetRow
          key={asset.id}
          asset={asset}
          selected={selectedIds.includes(asset.id)}
          active={activeAssetId === asset.id}
          onToggleSelect={onToggleSelect}
          onOpenDicom={onOpenDicom}
          onOpenModel={onOpenModel}
          renderExtras={renderExtras}
          onDelete={onDeleteAsset}
        />
      ))}
    </ul>
  )
}
