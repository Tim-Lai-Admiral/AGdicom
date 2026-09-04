import './styles.css'
import { useState } from 'react'
import type { Asset, AssetStatus, AppState, DicomMeta } from './domain/types.ts'
import { collectTagNames, DEFAULT_ASSET_FILTER, filterAssets } from './domain/filter.ts'
import type { AssetFilter } from './domain/filter.ts'
import { setAssetStatus } from './domain/review.ts'
import { loadState, saveState } from './store/repository.ts'
import type { LoadIssue } from './store/repository.ts'
import ImportZone from './features/library/ImportZone.tsx'
import { useImport } from './features/library/useImport.ts'
import Filters from './features/library/Filters.tsx'
import AssetGrid from './features/library/AssetGrid.tsx'
import CompareView from './features/library/CompareView.tsx'
import DicomViewer from './features/viewer/dicom/DicomViewer.tsx'

/** 读取异常的可提示文案（T-002 仓储契约的 UI 呈现） */
const LOAD_ISSUE_MESSAGES: Readonly<Record<LoadIssue, string>> = {
  corrupted: '本地存储数据异常，已恢复为空素材库；如有导出的 JSON 备份可稍后导入恢复。',
  'storage-unavailable': '浏览器本地存储不可用：素材仍可导入，但刷新后无法保留。',
}

/** 比较视图最多可选图片数（R-002：两张并排比较） */
const COMPARE_SELECTION_LIMIT = 2

function App() {
  const [initialLoad] = useState(() => loadState())
  const [state, setState] = useState<AppState>(initialLoad.state)
  const [filter, setFilter] = useState<AssetFilter>(DEFAULT_ASSET_FILTER)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [dicomViewerAssetId, setDicomViewerAssetId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { importFiles, importing, importingLarge, feedback, clearFeedback } = useImport({
    state,
    onStateChange: setState,
  })

  const assets = Object.values(state.assets)
  const filteredAssets = filterAssets(assets, filter)
  const tagNames = collectTagNames(state)
  const hasImages = assets.some((asset) => asset.kind === 'image')
  const dicomAssets = assets.filter((asset) => asset.kind === 'dicom')
  const dicomViewerAsset =
    dicomViewerAssetId !== null ? state.assets[dicomViewerAssetId] : undefined
  // 比较素材：按选中先后顺序（先选的在左）
  const compareAssets = selectedIds
    .map((id) => state.assets[id])
    .filter((asset): asset is Asset => asset !== undefined)

  /** 设置状态：领域纯函数计算 + 立即持久化（R-002：刷新后仍保留） */
  const handleSetStatus = (assetId: string, status: AssetStatus): void => {
    const next = setAssetStatus(state, assetId, status)
    if (next === state) return
    setState(next)
    try {
      saveState(next)
      setSaveError(null)
    } catch (error) {
      const reason = error instanceof Error && error.message !== '' ? error.message : String(error)
      setSaveError(`状态已在本会话更新，但保存失败（${reason}）。刷新后该状态可能无法保留。`)
    }
  }

  /** 打开/关闭 DICOM 查看器（T-005）：点击 dicom 素材卡片触发 */
  const handleOpenDicom = (assetId: string): void => {
    setDicomViewerAssetId(assetId)
  }
  const handleCloseDicom = (): void => {
    setDicomViewerAssetId(null)
  }

  /**
   * DICOM 查看器解析出元数据后的批量回写（T-005）：填充 Asset.dicomMeta（含按 series
   * 分组统计的 sliceCount）并持久化，刷新后元数据表格仍可展示（预览仍需重新导入）。
   * 元数据未变化的素材不重写（避免重复保存与 updatedAt 抖动）。
   */
  const handleDicomMetasParsed = (metas: Record<string, DicomMeta>): void => {
    const at = new Date().toISOString()
    const assets: Record<string, Asset> = { ...state.assets }
    let changed = 0
    for (const [assetId, meta] of Object.entries(metas)) {
      const target = assets[assetId]
      if (target === undefined || target.kind !== 'dicom') continue
      if (JSON.stringify(target.dicomMeta) === JSON.stringify(meta)) continue
      assets[assetId] = { ...target, dicomMeta: meta, updatedAt: at }
      changed += 1
    }
    if (changed === 0) return
    const next: AppState = { assets, tags: state.tags, reviews: state.reviews }
    setState(next)
    try {
      saveState(next)
      setSaveError(null)
    } catch (error) {
      const reason = error instanceof Error && error.message !== '' ? error.message : String(error)
      setSaveError(`DICOM 元数据已在本会话更新，但保存失败（${reason}）。刷新后可能无法保留。`)
    }
  }

  /** 切换比较选中：仅 image；最多两张；选中第二张时自动进入比较 */
  const handleToggleSelect = (assetId: string): void => {
    const asset = state.assets[assetId]
    if (asset === undefined || asset.kind !== 'image') return
    if (selectedIds.includes(assetId)) {
      setSelectedIds(selectedIds.filter((id) => id !== assetId))
      return
    }
    if (selectedIds.length >= COMPARE_SELECTION_LIMIT) return // 已选满两张：忽略更多选择
    const next = [...selectedIds, assetId]
    setSelectedIds(next)
    if (next.length === COMPARE_SELECTION_LIMIT) setCompareOpen(true)
  }

  const openCompare = (): void => setCompareOpen(true)
  const closeCompare = (): void => setCompareOpen(false) // 退出比较但保留选中，便于再次进入
  const showCompare = compareOpen && compareAssets.length === COMPARE_SELECTION_LIMIT

  return (
    <main className="app">
      <h1 className="app__title">素材评审工作台</h1>
      {initialLoad.issue !== null ? (
        <p className="app__storage-warning" role="alert">
          {LOAD_ISSUE_MESSAGES[initialLoad.issue]}
        </p>
      ) : null}
      {saveError !== null ? (
        <p className="app__save-warning" role="alert">
          {saveError}
        </p>
      ) : null}
      <ImportZone
        importing={importing}
        importingLarge={importingLarge}
        feedback={feedback}
        onImportFiles={importFiles}
        onClearFeedback={clearFeedback}
      />
      <section className="library" aria-label="素材库">
        <header className="library__header">
          <h2 className="library__title">素材库（{assets.length}）</h2>
          <button
            type="button"
            className="library__compare"
            disabled={selectedIds.length !== COMPARE_SELECTION_LIMIT}
            onClick={openCompare}
            title={
              selectedIds.length === COMPARE_SELECTION_LIMIT
                ? '并排比较所选的两张图片'
                : '先选中两张图片'
            }
          >
            比较
          </button>
        </header>
        {assets.length === 0 ? (
          <p className="library__empty">
            尚无素材：拖拽或选择文件导入，导入后素材保存在本地浏览器中
          </p>
        ) : (
          <>
            <Filters filter={filter} tagNames={tagNames} onChange={setFilter} />
            {hasImages ? (
              <p className="library__select-hint">
                {`点击图片卡片可选择两张图片进行并排比较（已选 ${selectedIds.length}/${COMPARE_SELECTION_LIMIT}）`}
              </p>
            ) : null}
            {filteredAssets.length > 0 ? (
              <AssetGrid
                assets={filteredAssets}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSetStatus={handleSetStatus}
                onOpenDicom={handleOpenDicom}
              />
            ) : (
              <p className="library__empty">没有符合当前筛选条件的素材：可调整上方筛选条件</p>
            )}
          </>
        )}
      </section>
      {showCompare ? (
        <CompareView left={compareAssets[0]} right={compareAssets[1]} onExit={closeCompare} />
      ) : null}
      {dicomViewerAsset !== undefined && dicomViewerAsset.kind === 'dicom' ? (
        <DicomViewer
          asset={dicomViewerAsset}
          dicomAssets={dicomAssets}
          onMetasParsed={handleDicomMetasParsed}
          onClose={handleCloseDicom}
        />
      ) : null}
    </main>
  )
}

export default App
