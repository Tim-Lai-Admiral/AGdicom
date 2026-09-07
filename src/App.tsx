import './styles.css'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Asset, AssetStatus, AppState, DicomMeta } from './domain/types.ts'
import { collectTagNames, DEFAULT_ASSET_FILTER, filterAssets } from './domain/filter.ts'
import type { AssetFilter } from './domain/filter.ts'
import { addAssetTag, applyReview, removeAsset, removeAssetTag, updateAssetName, updateAssetNote } from './domain/review.ts'
import { loadState, saveState } from './store/repository.ts'
import type { LoadIssue } from './store/repository.ts'
import { deleteAssetBlob, restoreAssetBlobs } from './features/library/blobPersistence.ts'
import ImportZone from './features/library/ImportZone.tsx'
import { useImport } from './features/library/useImport.ts'
import AssetGrid from './features/library/AssetGrid.tsx'
import CompareView from './features/library/CompareView.tsx'
import DicomViewer from './features/viewer/dicom/DicomViewer.tsx'
import { AUTO_WINDOW_LEVEL } from './features/viewer/dicom/windowLevel.ts'
import type { WindowLevelState } from './features/viewer/dicom/windowLevel.ts'
// TD-002：three.js（~800KB）随 3D 查看器拆为独立 chunk，仅在首次打开 3D 模型时按需加载
const Model3DViewer = lazy(() => import('./features/viewer/model3d/Model3DViewer.tsx'))
import ReviewPanel from './features/review/ReviewPanel.tsx'
import ExportImport from './features/review/ExportImport.tsx'
import TopToolbar from './features/workbench/TopToolbar.tsx'
import MetadataPanel from './features/workbench/MetadataPanel.tsx'
import WindowLevelPanel from './features/workbench/WindowLevelPanel.tsx'
import DicomSeriesExpansion from './features/workbench/DicomSeriesExpansion.tsx'
import ImageStage from './features/workbench/ImageStage.tsx'

/** 读取异常的可提示文案（T-002 仓储契约的 UI 呈现） */
const LOAD_ISSUE_MESSAGES: Readonly<Record<LoadIssue, string>> = {
  corrupted: '本地存储数据异常，已恢复为空素材库；如有导出的 JSON 备份可稍后导入恢复。',
  'storage-unavailable': '浏览器本地存储不可用：素材仍可导入，但刷新后无法保留。',
}

/** 比较视图最多可选图片数（R-002：两张并排比较） */
const COMPARE_SELECTION_LIMIT = 2

/** 右栏信息面板页签：DICOM 默认元数据分组，其余素材评审（R：右栏自动切换） */
type RightTab = 'meta' | 'review'

function App() {
  const [initialLoad] = useState(() => loadState())
  const [state, setState] = useState<AppState>(initialLoad.state)
  const [filter, setFilter] = useState<AssetFilter>(DEFAULT_ASSET_FILTER)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  /** 工作台当前素材（中央查看区 + 右栏联动）；null = 导入视图（T-002 布局壳） */
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('review')
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  /** 左栏展开切片列表的 DICOM 素材（同一时间至多一个） */
  const [expandedDicomId, setExpandedDicomId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** 启动时从本地二进制库恢复的素材数（R-016 提示）；null 表示无恢复 */
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  /** 窗宽窗位（CR-003 T-003 / R-003 修改）：默认自动 min-max；右栏面板调节，中央查看器消费 */
  const [windowLevel, setWindowLevel] = useState<WindowLevelState>(AUTO_WINDOW_LEVEL)
  const { importFiles, importing, importingLarge, feedback, clearFeedback } = useImport({
    state,
    onStateChange: setState,
  })

  // 进入/切换素材时 W/L 复位为自动 min-max（R-003：默认进入时自动 min-max）
  useEffect(() => {
    setWindowLevel(AUTO_WINDOW_LEVEL)
  }, [activeAssetId])

  /**
   * 启动二进制恢复（CR-006 T-003 / R-016）：loadState 后按去重键匹配 IndexedDB 中
   * 已入库 blob，为幽灵资产重建会话 objectUrl（刷新后预览/查看立即可用，无需重导入）。
   * 恢复为异步：命中后以函数式 setState 合并（不覆盖期间的其他状态变更）；
   * 存储不可用等失败不打扰用户（素材保持幽灵态，重导入可走 R-014 水合兜底）。
   */
  useEffect(() => {
    let cancelled = false
    void restoreAssetBlobs(initialLoad.state.assets).then((result) => {
      if (cancelled) return
      const restoredIds = Object.keys(result.objectUrls)
      if (restoredIds.length === 0) {
        if (result.error !== null) console.warn('本地二进制恢复不可用：', result.error)
        return
      }
      setState((current) => {
        const assets: Record<string, Asset> = { ...current.assets }
        for (const assetId of restoredIds) {
          const asset = assets[assetId]
          const url = result.objectUrls[assetId]
          if (asset === undefined || asset.objectUrl !== undefined || url === undefined) continue
          assets[assetId] = { ...asset, objectUrl: url }
        }
        return { assets, tags: current.tags, reviews: current.reviews }
      })
      setRestoreNotice(`已从本地恢复 ${restoredIds.length} 个素材的预览（无需重新导入）`)
    })
    return () => {
      cancelled = true
    }
  }, [initialLoad])

  const assets = Object.values(state.assets)
  const filteredAssets = filterAssets(assets, filter)
  const tagNames = collectTagNames(state)
  const hasImages = assets.some((asset) => asset.kind === 'image')
  const dicomAssets = assets.filter((asset) => asset.kind === 'dicom')
  const activeAsset = activeAssetId !== null ? state.assets[activeAssetId] : undefined
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

  /** 选中素材（工作台）：中央查看区 + 右栏面板联动（DICOM → 元数据分组，其余 → 评审）；
   *  DICOM 同时自动展开其患者分组面板（CR-005 T-002 / R-012：选中素材时对应患者组自动展开） */
  const selectAsset = (assetId: string): void => {
    setActiveAssetId(assetId)
    setRightOpen(true)
    const asset = state.assets[assetId]
    setRightTab(asset !== undefined && asset.kind === 'dicom' ? 'meta' : 'review')
    if (asset !== undefined && asset.kind === 'dicom') setExpandedDicomId(assetId)
  }

  /** 关闭中央查看区：回到导入视图（查看器“关闭”/Esc 与评审面板“关闭”/Esc 共用） */
  const closeActiveAsset = (): void => {
    setActiveAssetId(null)
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

  /**
   * 删除素材（CR-006 T-001 / R-015）：级联清理（资产 + 评审历史 + 标签计数重算）
   * 后，清空工作台选中/中央查看器/series 展开分组并持久化；series 分组按剩余
   * 素材即时重建（dicomAssets 为派生数据，随状态自动重算）。
   * 二进制级联（R-016）：按去重键同步删除 IndexedDB blob（失败仅告警，不阻塞删除）。
   */
  const handleDeleteAsset = (assetId: string): void => {
    const target = state.assets[assetId]
    const next = removeAsset(state, assetId)
    if (next === state) return
    if (activeAssetId === assetId) setActiveAssetId(null)
    setSelectedIds((current) => current.filter((id) => id !== assetId))
    if (expandedDicomId === assetId) setExpandedDicomId(null)
    commit(next, '素材已在本会话删除，但保存失败')
    if (target !== undefined) void deleteAssetBlob(target)
  }

  /** 导入备份：以备份数据整体替换当前状态（导入前已经过 io.ts 深度校验与冲突确认） */
  const handleImportState = (incoming: AppState): void => {
    commit(incoming, '导入已在本会话生效，但保存失败')
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

  /** 切换比较选中：仅 image；最多两张；选中第二张时自动进入比较。
   *  工作台布局下点击图片卡片同时作为“在中央查看该图片”（T-002 布局壳） */
  const handleToggleSelect = (assetId: string): void => {
    const asset = state.assets[assetId]
    if (asset === undefined || asset.kind !== 'image') return
    selectAsset(assetId)
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

  /** 中央查看区（统一容器）：比较 > 查看器（DICOM/3D）> 图片预览 > 导入视图 */
  let centerView: ReactNode
  if (showCompare) {
    centerView = <CompareView left={compareAssets[0]} right={compareAssets[1]} onExit={closeCompare} />
  } else if (activeAsset !== undefined && activeAsset.kind === 'dicom') {
    centerView = (
      <DicomViewer
        key={activeAsset.id}
        asset={activeAsset}
        dicomAssets={dicomAssets}
        onMetasParsed={handleDicomMetasParsed}
        onClose={closeActiveAsset}
        windowLevel={windowLevel}
      />
    )
  } else if (activeAsset !== undefined && activeAsset.kind === 'model') {
    centerView = (
      <Suspense
        fallback={
          <div className="model3d-lazy-loading" role="status">
            正在加载 3D 模型查看器…
          </div>
        }
      >
        <Model3DViewer asset={activeAsset} onClose={closeActiveAsset} />
      </Suspense>
    )
  } else if (activeAsset !== undefined && activeAsset.kind === 'image') {
    centerView = <ImageStage asset={activeAsset} />
  } else {
    centerView = (
      <div className="workbench__viewport-empty">
        <ImportZone
          importing={importing}
          importingLarge={importingLarge}
          feedback={feedback}
          onImportFiles={importFiles}
          onClearFeedback={clearFeedback}
        />
      </div>
    )
  }

  /** 左栏卡片附加内容：DICOM 素材的 series/切片展开区（T-002 验收 ②） */
  const renderCardExtras = (asset: Asset): ReactNode => {
    if (asset.kind !== 'dicom') return null
    return (
      <DicomSeriesExpansion
        asset={asset}
        dicomAssets={dicomAssets}
        open={expandedDicomId === asset.id}
        activeSliceAssetId={
          activeAsset !== undefined && activeAsset.kind === 'dicom' ? activeAsset.id : null
        }
        onToggle={() => {
          setExpandedDicomId(expandedDicomId === asset.id ? null : asset.id)
        }}
        onOpenSlice={(sliceAssetId) => {
          selectAsset(sliceAssetId)
        }}
      />
    )
  }

  const showReviewPanel = activeAsset !== undefined && activeAsset.kind !== 'dicom'
  const showMetaPanel =
    activeAsset !== undefined && activeAsset.kind === 'dicom' && rightTab === 'meta'
  const showDicomReview =
    activeAsset !== undefined && activeAsset.kind === 'dicom' && rightTab === 'review'

  return (
    <div className="workbench">
      <TopToolbar
        filter={filter}
        tagNames={tagNames}
        onFilterChange={setFilter}
        compareReady={selectedIds.length === COMPARE_SELECTION_LIMIT}
        onOpenCompare={openCompare}
        importActive={activeAssetId === null}
        onOpenImport={closeActiveAsset}
        exportOpen={exportOpen}
        onToggleExport={() => setExportOpen(!exportOpen)}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen(!leftOpen)}
        onToggleRight={() => setRightOpen(!rightOpen)}
      />
      {exportOpen ? (
        <div className="workbench__export-pop">
          <ExportImport state={state} onImport={handleImportState} />
        </div>
      ) : null}

      {initialLoad.issue !== null || saveError !== null || restoreNotice !== null ? (
        <div className="workbench__warnings">
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
          {restoreNotice !== null ? (
            <p className="app__restore-info" role="status">
              {restoreNotice}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="workbench__body">
        {leftOpen ? (
          <aside className="workbench__left" aria-label="素材列表">
            <header className="workbench__left-head">
              <h2 className="workbench__library-title">素材库（{assets.length}）</h2>
            </header>
            {assets.length === 0 ? (
              <p className="library__empty">
                尚无素材：点击顶栏“导入”选择文件，或将文件拖到中央导入区，导入后素材保存在本地浏览器中
              </p>
            ) : (
              <div className="workbench__left-body">
                {hasImages ? (
                  <p className="library__select-hint">
                    {`点击图片行可选择两张图片进行并排比较（已选 ${selectedIds.length}/${COMPARE_SELECTION_LIMIT}）`}
                  </p>
                ) : null}
                {filteredAssets.length > 0 ? (
                  <AssetGrid
                    assets={filteredAssets}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onOpenDicom={selectAsset}
                    onOpenModel={selectAsset}
                    renderExtras={renderCardExtras}
                    activeAssetId={activeAssetId}
                    onDeleteAsset={handleDeleteAsset}
                  />
                ) : (
                  <p className="library__empty">没有符合当前筛选条件的素材：可调整上方筛选条件</p>
                )}
              </div>
            )}
          </aside>
        ) : null}

        <main className="workbench__viewport" aria-label="查看区">
          {centerView}
        </main>

        {rightOpen ? (
          <aside className="workbench__right" aria-label="信息面板">
            {activeAsset === undefined ? (
              <p className="workbench__right-empty">
                在左栏选择素材：DICOM 显示元数据分组，其余素材显示评审面板；顶栏按钮可折叠本面板。
              </p>
            ) : null}
            {activeAsset !== undefined && activeAsset.kind === 'dicom' ? (
              <div className="workbench__right-tabs">
                <button
                  type="button"
                  className={rightTab === 'meta' ? 'workbench__tab is-active' : 'workbench__tab'}
                  aria-pressed={rightTab === 'meta'}
                  onClick={() => setRightTab('meta')}
                >
                  元数据
                </button>
                <button
                  type="button"
                  className={rightTab === 'review' ? 'workbench__tab is-active' : 'workbench__tab'}
                  aria-pressed={rightTab === 'review'}
                  onClick={() => setRightTab('review')}
                >
                  评审
                </button>
              </div>
            ) : null}
            {showMetaPanel && activeAsset !== undefined ? (
              <>
                <WindowLevelPanel windowLevel={windowLevel} onChange={setWindowLevel} />
                <MetadataPanel asset={activeAsset} />
              </>
            ) : null}
            {(showReviewPanel || showDicomReview) && activeAsset !== undefined ? (
              <ReviewPanel
                asset={activeAsset}
                history={state.reviews[activeAsset.id]}
                tagNames={tagNames}
                onAddTag={(tagName) => handleAddTag(activeAsset.id, tagName)}
                onRemoveTag={(tagName) => handleRemoveTag(activeAsset.id, tagName)}
                onSubmitReview={(status, comment) =>
                  handleSubmitReview(activeAsset.id, status, comment)
                }
                onSaveNote={(note) => handleSaveNote(activeAsset.id, note)}
                onAcceptAiName={(name) => handleRenameAsset(activeAsset.id, name)}
                onDeleteAsset={() => handleDeleteAsset(activeAsset.id)}
                onClose={closeActiveAsset}
              />
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

export default App
