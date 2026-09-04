import './styles.css'
import { useState } from 'react'
import type { Asset, AssetStatus, AppState, DicomMeta } from './domain/types.ts'
import { collectTagNames, DEFAULT_ASSET_FILTER, filterAssets } from './domain/filter.ts'
import type { AssetFilter } from './domain/filter.ts'
import { addAssetTag, applyReview, removeAssetTag, setAssetStatus, updateAssetName, updateAssetNote } from './domain/review.ts'
import { loadState, saveState } from './store/repository.ts'
import type { LoadIssue } from './store/repository.ts'
import ImportZone from './features/library/ImportZone.tsx'
import { useImport } from './features/library/useImport.ts'
import Filters from './features/library/Filters.tsx'
import AssetGrid from './features/library/AssetGrid.tsx'
import CompareView from './features/library/CompareView.tsx'
import DicomViewer from './features/viewer/dicom/DicomViewer.tsx'
import Model3DViewer from './features/viewer/model3d/Model3DViewer.tsx'
import ReviewPanel from './features/review/ReviewPanel.tsx'
import ExportImport from './features/review/ExportImport.tsx'

/** 读取异常的可提示文案（T-002 仓储契约的 UI 呈现） */
const LOAD_ISSUE_MESSAGES: Readonly<Record<LoadIssue, string>> = {
  corrupted: '本地存储数据异常，已恢复为空素材库；如有导出的 JSON 备份可稍后导入恢复。',
  'storage-unavailable': '浏览器本地存储不可用：素材仍可导入，但刷新后无法保留。',
}

/** 比较视图最多可选图片数（R-002：两张并排比较） */
const COMPARE_SELECTION_LIMIT = 2

/** 内置 STL 样本（public/samples/stl/，T-009 复制的 4 个心脏 STL）：可从素材库一键加载 */
const SAMPLE_STL_NAMES: readonly string[] = ['aorta.stl', 'CB.stl', 'LA.stl', 'LVOT.stl']

function App() {
  const [initialLoad] = useState(() => loadState())
  const [state, setState] = useState<AppState>(initialLoad.state)
  const [filter, setFilter] = useState<AssetFilter>(DEFAULT_ASSET_FILTER)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [dicomViewerAssetId, setDicomViewerAssetId] = useState<string | null>(null)
  const [modelViewerAssetId, setModelViewerAssetId] = useState<string | null>(null)
  const [reviewAssetId, setReviewAssetId] = useState<string | null>(null)
  const [samplesLoading, setSamplesLoading] = useState(false)
  const [samplesError, setSamplesError] = useState<string | null>(null)
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
  const modelViewerAsset =
    modelViewerAssetId !== null ? state.assets[modelViewerAssetId] : undefined
  const reviewAsset = reviewAssetId !== null ? state.assets[reviewAssetId] : undefined
  // 比较素材：按选中先后顺序（先选的在左）
  const compareAssets = selectedIds
    .map((id) => state.assets[id])
    .filter((asset): asset is Asset => asset !== undefined)

  /**
   * 领域函数结果落库：立即更新会话状态并持久化（R-002/R-005：刷新后仍保留）。
   * 保存失败时提示（本会话内变更仍有效，刷新后可能丢失）。
   */
  const commit = (next: AppState, failPrefix: string): void => {
    setState(next)
    try {
      saveState(next)
      setSaveError(null)
    } catch (error) {
      const reason = error instanceof Error && error.message !== '' ? error.message : String(error)
      setSaveError(`${failPrefix}（${reason}）。刷新后可能无法保留。`)
    }
  }

  /** 设置状态：领域纯函数计算 + 立即持久化（R-002：刷新后仍保留） */
  const handleSetStatus = (assetId: string, status: AssetStatus): void => {
    const next = setAssetStatus(state, assetId, status)
    if (next === state) return
    commit(next, '状态已在本会话更新，但保存失败')
  }

  /** 打开/关闭 DICOM 查看器（T-005）：点击 dicom 素材卡片触发 */
  const handleOpenDicom = (assetId: string): void => {
    setDicomViewerAssetId(assetId)
  }
  const handleCloseDicom = (): void => {
    setDicomViewerAssetId(null)
  }

  /** 打开/关闭 3D 模型查看器（T-006）：点击 model 素材卡片触发 */
  const handleOpenModel = (assetId: string): void => {
    setModelViewerAssetId(assetId)
  }
  const handleCloseModel = (): void => {
    setModelViewerAssetId(null)
  }

  /** 打开/关闭评审面板（T-007）：点击卡片“评审”按钮触发；查看器打开时覆盖面板（并存） */
  const handleOpenReview = (assetId: string): void => {
    setReviewAssetId(assetId)
  }
  const handleCloseReview = (): void => {
    setReviewAssetId(null)
  }

  /** 评审面板：添加标签（含自建，注册表合并由 addAssetTag 完成）并持久化 */
  const handleAddTag = (assetId: string, tagName: string): void => {
    const next = addAssetTag(state, assetId, tagName)
    if (next === state) return
    commit(next, '标签已在本会话更新，但保存失败')
  }

  /** 评审面板：移除标签并持久化 */
  const handleRemoveTag = (assetId: string, tagName: string): void => {
    const next = removeAssetTag(state, assetId, tagName)
    if (next === state) return
    commit(next, '标签已在本会话更新，但保存失败')
  }

  /** 评审面板：提交一次评审（更新状态 + 追加历史留痕）并持久化 */
  const handleSubmitReview = (assetId: string, status: AssetStatus, comment: string): void => {
    const next = applyReview(state, assetId, { status, comment })
    if (next === state) return
    commit(next, '评审已在本会话保存，但持久化失败')
  }

  /** 评审面板：保存备注（不追加评审历史）并持久化 */
  const handleSaveNote = (assetId: string, note: string): void => {
    const next = updateAssetNote(state, assetId, note)
    if (next === state) return
    commit(next, '备注已在本会话保存，但持久化失败')
  }

  /** 评审面板 AI 建议：采纳命名建议（重命名素材并持久化，仅用户点击触发，绝不自动改名） */
  const handleRenameAsset = (assetId: string, name: string): void => {
    const next = updateAssetName(state, assetId, name)
    if (next === state) return
    commit(next, '命名已在本会话更新，但保存失败')
  }

  /** 导入备份：以备份数据整体替换当前状态（导入前已经过 io.ts 深度校验与冲突确认） */
  const handleImportState = (incoming: AppState): void => {
    commit(incoming, '导入已在本会话生效，但保存失败')
  }

  /**
   * 加载内置 STL 样本（T-006 / R-004 验收）：fetch public/samples/stl/ 下 4 个心脏 STL
   * → 转为 File → 复用 T-003 导入管线（useImport）注册为素材（重复导入由管线去重提示）。
   * 大文件（LA 约 14MB）导入期间由 ImportZone 的 importing/importingLarge 状态提示。
   */
  const handleLoadSamples = (): void => {
    if (importing || samplesLoading) return
    setSamplesLoading(true)
    setSamplesError(null)
    void (async () => {
      try {
        const files: File[] = []
        for (const name of SAMPLE_STL_NAMES) {
          const response = await fetch(`${import.meta.env.BASE_URL}samples/stl/${name}`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          files.push(new File([await response.blob()], name, { type: 'model/stl' }))
        }
        await importFiles(files, '内置样本')
      } catch (error) {
        const reason =
          error instanceof Error && error.message !== '' ? error.message : String(error)
        setSamplesError(`内置样本加载失败（${reason}）。请通过 Vite 启动应用后重试。`)
      } finally {
        setSamplesLoading(false)
      }
    })()
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
    commit(next, 'DICOM 元数据已在本会话更新，但保存失败')
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
      <ExportImport state={state} onImport={handleImportState} />
      <section className="library" aria-label="素材库">
        <header className="library__header">
          <h2 className="library__title">素材库（{assets.length}）</h2>
          <button
            type="button"
            className="library__samples"
            disabled={importing || samplesLoading}
            onClick={handleLoadSamples}
          >
            {samplesLoading ? '样本加载中…' : '加载内置样本（STL）'}
          </button>
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
        {samplesError !== null ? (
          <p className="library__samples-error" role="alert">
            {samplesError}
          </p>
        ) : null}
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
                onOpenModel={handleOpenModel}
                onOpenReview={handleOpenReview}
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
      {modelViewerAsset !== undefined && modelViewerAsset.kind === 'model' ? (
        <Model3DViewer asset={modelViewerAsset} onClose={handleCloseModel} />
      ) : null}
      {reviewAsset !== undefined ? (
        <ReviewPanel
          asset={reviewAsset}
          history={state.reviews[reviewAsset.id]}
          tagNames={tagNames}
          onAddTag={(tagName) => handleAddTag(reviewAsset.id, tagName)}
          onRemoveTag={(tagName) => handleRemoveTag(reviewAsset.id, tagName)}
          onSubmitReview={(status, comment) => handleSubmitReview(reviewAsset.id, status, comment)}
          onSaveNote={(note) => handleSaveNote(reviewAsset.id, note)}
          onAcceptAiName={(name) => handleRenameAsset(reviewAsset.id, name)}
          onClose={handleCloseReview}
        />
      ) : null}
    </main>
  )
}

export default App
