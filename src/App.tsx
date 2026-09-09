import './styles.css'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Asset, AssetKind, AssetStatus, AppState, DicomMeta } from './domain/types.ts'
import { ASSET_KIND_LABELS } from './domain/types.ts'
import { collectTagNames, DEFAULT_ASSET_FILTER, filterAssets } from './domain/filter.ts'
import type { AssetFilter } from './domain/filter.ts'
import { addAssetTag, applyReview, removeAsset, removeAssetTag, updateAssetName, updateAssetNote } from './domain/review.ts'
import { loadState, saveState } from './store/repository.ts'
import type { LoadIssue } from './store/repository.ts'
import { loadSettings, saveSettings } from './features/settings/settingsStore.ts'
import type { ApiSettings } from './features/settings/settingsStore.ts'
import { selectAiProvider } from './features/ai/remoteProvider.ts'
import { deleteAssetBlob, restoreAssetBlobs } from './features/library/blobPersistence.ts'
import ImportZone from './features/library/ImportZone.tsx'
import { useImport } from './features/library/useImport.ts'
import AssetGrid from './features/library/AssetGrid.tsx'
import CompareView from './features/library/CompareView.tsx'
import DicomViewer from './features/viewer/dicom/DicomViewer.tsx'
import { AUTO_WINDOW_LEVEL } from './features/viewer/dicom/windowLevel.ts'
import type { WindowLevelState } from './features/viewer/dicom/windowLevel.ts'
import { DEFAULT_VIEWER_TOOL } from './features/viewer/viewerTools.ts'
import type { ViewerTool } from './features/viewer/viewerTools.ts'
// TD-002：three.js（~800KB）随 3D 查看器拆为独立 chunk，仅在首次打开 3D 模型时按需加载
const Model3DViewer = lazy(() => import('./features/viewer/model3d/Model3DViewer.tsx'))
import ReviewPanel from './features/review/ReviewPanel.tsx'
import ExportImport from './features/review/ExportImport.tsx'
import SettingsDialog from './features/settings/SettingsDialog.tsx'
import TopToolbar from './features/workbench/TopToolbar.tsx'
import MetadataPanel from './features/workbench/MetadataPanel.tsx'
import WindowLevelPanel from './features/workbench/WindowLevelPanel.tsx'
import PatientGroupPanel from './features/workbench/PatientGroupPanel.tsx'
import ImageStage from './features/workbench/ImageStage.tsx'

/** 读取异常的可提示文案（T-002 仓储契约的 UI 呈现） */
const LOAD_ISSUE_MESSAGES: Readonly<Record<LoadIssue, string>> = {
  corrupted: '本地存储数据异常，已恢复为空素材库；如有导出的 JSON 备份可稍后导入恢复。',
  'storage-unavailable': '浏览器本地存储不可用：素材仍可导入，但刷新后无法保留。',
}

/** 比较视图最多可选素材数（R-002：两张并排比较） */
const COMPARE_SELECTION_LIMIT = 2

/**
 * 比较模式可选素材类型（CR-012 T-003 / R-029 + T-004 / R-030）：image + dicom + model。
 * 比较仍限“两个同类型素材”，混合类型由 handleToggleCompareSelect 的同类约束拒绝。
 */
const COMPARE_SELECTABLE_KINDS: readonly AssetKind[] = ['image', 'dicom', 'model']

/** 右栏信息面板页签：DICOM 默认元数据分组，其余素材评审（R：右栏自动切换） */
type RightTab = 'meta' | 'review'

function App() {
  const [initialLoad] = useState(() => loadState())
  const [state, setState] = useState<AppState>(initialLoad.state)
  const [filter, setFilter] = useState<AssetFilter>(DEFAULT_ASSET_FILTER)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  /** 显式比较模式（CR-011 T-002 / R-002）：进入后列表过滤为可比较素材
   *  （image/dicom/model，CR-012 T-003/T-004）、行点击切换比较选中（满 2 自动比较）；
   *  退出清空选择并恢复列表 */
  const [compareMode, setCompareMode] = useState(false)
  /** 工作台当前素材（中央查看区 + 右栏联动）；null = 导入视图（T-002 布局壳） */
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  /** 左栏分组面板高亮数据源（CR-008 T-002 / R-022）：中央查看器当前选中的切片素材 ID。
   *  点击左栏切片/素材行（selectAsset）设置；查看器内滑动条等路径切换切片经
   *  onSelectedSliceChange 跟随更新；关闭查看器 / 切换到非 DICOM 素材 / 删除对应
   *  素材时清理（null = 无高亮） */
  const [activeSliceAssetId, setActiveSliceAssetId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('review')
  /** 左/右栏抽屉开合（CR-003 T-002；CR-009 T-003 / R-026：收起不卸载，宽度过渡动画） */
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  /** 设置弹窗开合（CR-012 T-001 / R-027）：条件挂载 SettingsDialog */
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** AI API 设置（CR-012 T-002 / R-027）：启动时从本机 localStorage 读取（损坏回退默认值）；
   *  保存（弹窗「保存」）经 saveSettings 持久化后更新会话状态 */
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => loadSettings())
  /** CR-011 T-001 修复（审查 B1）：图片预览的 Esc 关闭回归——评审面板移除 Esc 后，
   *  App 层兜底：中央图片预览按 Esc 关闭回到导入视图（DICOM/3D/比较各自处理自身 Esc；
   *  图片在 ImageStage 内按 Esc 仅复位视图，本监听负责关闭）。
   *  CR-012 T-001：设置弹窗打开期间跳过（弹窗自身处理 Esc），避免一键关闭两层 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (settingsOpen) return
      const asset = activeAssetId !== null ? state.assets[activeAssetId] : undefined
      if (asset !== undefined && asset.kind === 'image') closeActiveAsset()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssetId, state.assets, settingsOpen])
  /** 分组面板中处于展开态的患者组键（面板级状态；点击切片不改变，CR-008 T-001 / R-021） */
  const [openGroupKeys, setOpenGroupKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [saveError, setSaveError] = useState<string | null>(null)
  /** 启动时从本地二进制库恢复的素材数（R-016 提示）；null 表示无恢复 */
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  /** 窗宽窗位（CR-003 T-003 / R-003 修改）：默认自动 min-max；右栏面板调节，中央查看器消费 */
  const [windowLevel, setWindowLevel] = useState<WindowLevelState>(AUTO_WINDOW_LEVEL)
  /** 视口激活工具（CR-009 T-002 / R-024）：顶栏工具组切换，中央查看器按工具解释拖拽 */
  const [viewerTool, setViewerTool] = useState<ViewerTool>(DEFAULT_VIEWER_TOOL)
  const { importFiles, importing, importingLarge, feedback, clearFeedback } = useImport({
    state,
    onStateChange: setState,
  })

  /** AI provider 选择（CR-012 T-002 / R-028）：设置启用且 baseURL/apiKey 齐备 →
   *  远程 provider（fallbackToMock 决定是否附带 Mock 兜底），否则全本地 Mock。
   *  设置对象仅在保存时替换，useMemo 保证 provider 实例稳定（不触发无谓重生成） */
  const aiSelection = useMemo(() => selectAiProvider(apiSettings), [apiSettings])

  /** 设置弹窗「保存」：持久化到本机 localStorage（独立 key，不随素材导出），
   *  成功后更新会话状态即时生效；失败时本会话仍生效并提示（与评审保存同模式） */
  const handleSaveSettings = (next: ApiSettings): void => {
    setApiSettings(next)
    try {
      saveSettings(next)
      setSaveError(null)
    } catch (error) {
      const reason = error instanceof Error && error.message !== '' ? error.message : String(error)
      setSaveError(`设置已在本会话生效，但保存失败（${reason}）。`)
    }
  }

  // 进入/切换素材时 W/L 复位为自动 min-max（R-003：默认进入时自动 min-max），
  // 视口工具复位为平移（R-024 默认；视口变换随查看器重挂载自然归零）
  useEffect(() => {
    setWindowLevel(AUTO_WINDOW_LEVEL)
    setViewerTool(DEFAULT_VIEWER_TOOL)
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
  // 比较模式列表过滤（CR-011 T-002 / R-002；CR-012 T-003/T-004 扩展）：叠加可比较
  // 类型（image+dicom+model），其余行隐藏；退出比较模式即恢复完整列表（筛选条件不变）
  const gridAssets = compareMode
    ? filteredAssets.filter((asset) => COMPARE_SELECTABLE_KINDS.includes(asset.kind))
    : filteredAssets
  const tagNames = collectTagNames(state)
  // 库中存在可比较素材（image/dicom/model）时比较入口可用（CR-012 T-003/T-004 扩展）
  const hasComparable = assets.some((asset) => COMPARE_SELECTABLE_KINDS.includes(asset.kind))
  const dicomAssets = assets.filter((asset) => asset.kind === 'dicom')
  const activeAsset = activeAssetId !== null ? state.assets[activeAssetId] : undefined
  // 右栏元数据页签数据源（CR-013 T-001 / R-022 扩展）：DICOM 查看时跟随当前切片
  // （查看器内滑动条等路径切换 → 元数据同步展示当前切片 meta）；无当前切片高亮
  // （或切片素材已被清理）时回退选中素材。仅 meta 页签消费；评审页签仍绑定
  // activeAsset（选中素材），不随切片改变。
  const metaAsset =
    (activeSliceAssetId !== null ? state.assets[activeSliceAssetId] : undefined) ?? activeAsset
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
   *  左栏分组面板高亮随选中设置/清理（CR-008 T-002 / R-022）；患者分组面板的展开
   *  联动由面板自身完成（当前切片所属分组自动展开，幂等） */
  const selectAsset = (assetId: string): void => {
    setActiveAssetId(assetId)
    setRightOpen(true)
    const asset = state.assets[assetId]
    setRightTab(asset !== undefined && asset.kind === 'dicom' ? 'meta' : 'review')
    setActiveSliceAssetId(asset !== undefined && asset.kind === 'dicom' ? assetId : null)
  }

  /** 分组面板：切换患者组展开/折叠（分组头点击；面板级状态，与素材行解耦） */
  const toggleGroupOpen = (groupKey: string): void => {
    setOpenGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  /** 分组面板：当前切片所属患者组自动展开（幂等；不折叠其他组） */
  const openGroup = (groupKey: string): void => {
    setOpenGroupKeys((prev) => (prev.has(groupKey) ? prev : new Set([...prev, groupKey])))
  }

  /** 关闭中央查看区：回到导入视图（查看器“关闭”/Esc 触发；CR-011 T-001 起评审面板
   *  常驻右栏，不再经此关闭）；左栏分组面板高亮同步清理
   *  （CR-008 T-002 / R-022 验收：关闭查看器 → 高亮清理） */
  const closeActiveAsset = (): void => {
    setActiveAssetId(null)
    setActiveSliceAssetId(null)
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
   * 后，清空工作台选中/中央查看器并持久化；患者分组面板由剩余素材即时重建
   * （dicomAssets 为派生数据，随状态自动重算；面板展开状态与素材行解耦，
   * CR-008 T-001 / R-021，无需随删除清理）。
   * 二进制级联（R-016）：按去重键同步删除 IndexedDB blob（失败仅告警，不阻塞删除）。
   */
  const handleDeleteAsset = (assetId: string): void => {
    const target = state.assets[assetId]
    const next = removeAsset(state, assetId)
    if (next === state) return
    if (activeAssetId === assetId) {
      setActiveAssetId(null)
      setActiveSliceAssetId(null)
    } else if (activeSliceAssetId === assetId) {
      // 被删除的是当前高亮切片（查看器内部已切到它但未作为 activeAsset）：清理高亮
      setActiveSliceAssetId(null)
    }
    setSelectedIds((current) => current.filter((id) => id !== assetId))
    commit(next, '素材已在本会话删除，但保存失败')
    if (target !== undefined) void deleteAssetBlob(target)
  }

  /** 导入备份：以备份数据整体替换当前状态（导入前已经过 io.ts 深度校验与冲突确认） */
  const handleImportState = (incoming: AppState): void => {
    commit(incoming, '导入已在本会话生效，但保存失败')
  }

  /**
   * DICOM 查看器当前切片变化（CR-008 T-002 / R-022）：查看器内滑动条等任意路径
   * 切换切片时更新左栏分组面板高亮数据源（初始选择与点击左栏切片路径已由
   * selectAsset 覆盖；查看器侧对同一素材 ID 去重，不会重复回调）。
   */
  const handleDicomSliceChange = (assetId: string): void => {
    setActiveSliceAssetId(assetId)
  }

  /**
   * DICOM 查看器解析出元数据后的批量回写（T-005）：填充 Asset.dicomMeta（含按 series
   * 分组统计的 sliceCount）并持久化，刷新后元数据表格仍可展示（≤20MB 预览经 IndexedDB
   * 自动恢复；>20MB 预览不可用，可重新导入或删除该素材）。
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

  /**
   * 比较模式：切换比较选中（CR-011 T-002 / R-002；CR-012 T-003/T-004 扩展 dicom/model）。
   * 仅可比较类型（image/dicom/model）且两个同类型（先选素材的 kind 锁定配对类型，
   * 混合选择拒绝）；最多两张；选中第二张时自动进入比较视图。行点击只做显式选择/取消，
   * 不再联动中央查看区（普通模式的查看语义由 selectAsset 承担）。
   */
  const handleToggleCompareSelect = (assetId: string): void => {
    const asset = state.assets[assetId]
    if (asset === undefined || !COMPARE_SELECTABLE_KINDS.includes(asset.kind)) return
    const firstSelected =
      selectedIds.length > 0 ? state.assets[selectedIds[0] as string] : undefined
    if (firstSelected !== undefined && firstSelected.kind !== asset.kind) return // 同类型约束
    if (selectedIds.includes(assetId)) {
      setSelectedIds(selectedIds.filter((id) => id !== assetId))
      return
    }
    if (selectedIds.length >= COMPARE_SELECTION_LIMIT) return // 已选满两张：忽略更多选择
    const next = [...selectedIds, assetId]
    setSelectedIds(next)
    if (next.length === COMPARE_SELECTION_LIMIT) setCompareOpen(true)
  }

  /** 进入比较模式：清空既有选择，列表过滤为可比较素材（image/dicom/model）+ 提示条 */
  const enterCompareMode = (): void => {
    setSelectedIds([])
    setCompareOpen(false)
    setCompareMode(true)
  }

  /** 退出比较模式：清空选择并恢复完整列表（比较视图“退出比较”/Esc 与顶栏“完成”均触发） */
  const exitCompareMode = (): void => {
    setSelectedIds([])
    setCompareOpen(false)
    setCompareMode(false)
  }

  /** 顶栏比较/完成按钮：进入或退出比较模式 */
  const toggleCompareMode = (): void => {
    if (compareMode) exitCompareMode()
    else enterCompareMode()
  }

  // 比较视图仅在比较模式内可达（选中满两张自动进入）
  const showCompare = compareMode && compareOpen && compareAssets.length === COMPARE_SELECTION_LIMIT

  /** 比较模式提示条（CR-012 T-003 / R-029 文案扩展）：限两个同类型素材；
   *  已选其一时明示配对类型（先选素材的 kind 锁定配对） */
  const compareHint =
    compareMode && compareAssets.length > 0
      ? `选择两个同类型素材进行比较（已选 ${selectedIds.length}/${COMPARE_SELECTION_LIMIT}）：请再选择一个${ASSET_KIND_LABELS[compareAssets[0].kind]}`
      : `选择两个同类型素材进行比较（已选 ${selectedIds.length}/${COMPARE_SELECTION_LIMIT}）`

  /** 顶栏工具组目标（CR-009 T-002 / R-024；CR-012 T-003 / R-029 扩展）：DICOM/图片
   *  显示，比较模式内仅 DICOM 双窗比较显示（R-029：四角/工具/W-L 沿用现有查看器，
   *  window 工具拖拽在所在窗独立调 W/L）；图片/模型比较沿用 R-024 契约隐藏工具组 */
  const toolGroupKind = showCompare
    ? compareAssets[0]?.kind === 'dicom'
      ? 'dicom'
      : null
    : activeAsset === undefined
      ? null
      : activeAsset.kind === 'dicom' || activeAsset.kind === 'image'
        ? activeAsset.kind
        : null

  /** 中央查看区（统一容器）：比较 > 查看器（DICOM/3D）> 图片预览 > 导入视图 */
  let centerView: ReactNode
  if (showCompare) {
    centerView = (
      <CompareView
        left={compareAssets[0]}
        right={compareAssets[1]}
        onExit={exitCompareMode}
        dicomAssets={dicomAssets}
        onMetasParsed={handleDicomMetasParsed}
        activeTool={viewerTool}
      />
    )
  } else if (activeAsset !== undefined && activeAsset.kind === 'dicom') {
    centerView = (
      <DicomViewer
        key={activeAsset.id}
        asset={activeAsset}
        dicomAssets={dicomAssets}
        onMetasParsed={handleDicomMetasParsed}
        onClose={closeActiveAsset}
        onSelectedSliceChange={handleDicomSliceChange}
        windowLevel={windowLevel}
        activeTool={viewerTool}
        onWindowLevelChange={setWindowLevel}
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
    // 图片查看器（CR-009 T-003 / R-024）：按顶栏激活工具解释拖拽（pan/zoom/rotate）
    centerView = <ImageStage asset={activeAsset} activeTool={viewerTool} />
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
        compareMode={compareMode}
        compareAvailable={hasComparable}
        onToggleCompare={toggleCompareMode}
        importActive={activeAssetId === null}
        onOpenImport={closeActiveAsset}
        exportOpen={exportOpen}
        onToggleExport={() => setExportOpen(!exportOpen)}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen(!leftOpen)}
        onToggleRight={() => setRightOpen(!rightOpen)}
        toolGroupKind={toolGroupKind}
        viewerTool={viewerTool}
        onViewerToolChange={setViewerTool}
      />
      {exportOpen ? (
        <div className="workbench__export-pop">
          <ExportImport state={state} onImport={handleImportState} />
        </div>
      ) : null}
      {settingsOpen ? (
        <SettingsDialog
          settings={apiSettings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
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
        {/* 左栏抽屉（CR-009 T-003 / R-026）：收起不卸载（width 0.2s ease 过渡动画），
            收起态以 is-closed 类 + aria-hidden + inert 标记（内容裁剪不溢出、
            不可聚焦）；展开态内容与既有契约一致 */}
        <aside
          className={leftOpen ? 'workbench__left' : 'workbench__left is-closed'}
          aria-label="素材列表"
          aria-hidden={!leftOpen}
          inert={!leftOpen}
        >
          <header className="workbench__left-head">
            <h2 className="workbench__library-title">素材库（{assets.length}）</h2>
          </header>
          {assets.length === 0 ? (
            <p className="library__empty">
              尚无素材：点击顶栏“导入”选择文件，或将文件拖到中央导入区，导入后素材保存在本地浏览器中
            </p>
          ) : (
            <div className="workbench__left-body">
              {compareMode ? (
                <p className="library__select-hint" role="status">
                  {compareHint}
                </p>
              ) : null}
              {/* 患者分组面板置于素材库列表上方（CR-013 T-001 / R-032：先分组后素材库；
                  面板标题自带，header"素材库"计数保留）。比较模式下隐藏（素材行选择
                  语义），无 DICOM 素材时整体不渲染，空库走上方空态提示 */}
              {!compareMode && dicomAssets.length > 0 ? (
                <PatientGroupPanel
                  dicomAssets={dicomAssets}
                  activeSliceAssetId={activeSliceAssetId}
                  openGroupKeys={openGroupKeys}
                  onToggleGroup={toggleGroupOpen}
                  onOpenGroup={openGroup}
                  onOpenSlice={selectAsset}
                />
              ) : null}
              {gridAssets.length > 0 ? (
                <AssetGrid
                  assets={gridAssets}
                  selectedIds={selectedIds}
                  compareMode={compareMode}
                  onToggleSelect={compareMode ? handleToggleCompareSelect : selectAsset}
                  onOpenDicom={selectAsset}
                  onOpenModel={selectAsset}
                  activeAssetId={activeAssetId}
                  onDeleteAsset={handleDeleteAsset}
                />
              ) : (
                <p className="library__empty">没有符合当前筛选条件的素材：可调整上方筛选条件</p>
              )}
            </div>
          )}
        </aside>

        <main className="workbench__viewport" aria-label="查看区">
          {centerView}
        </main>

        {/* 右栏抽屉（CR-009 T-003 / R-026）：同左栏，收起不卸载、宽度过渡动画 */}
        <aside
          className={rightOpen ? 'workbench__right' : 'workbench__right is-closed'}
          aria-label="信息面板"
          aria-hidden={!rightOpen}
          inert={!rightOpen}
        >
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
          {showMetaPanel && metaAsset !== undefined ? (
            <>
              <WindowLevelPanel windowLevel={windowLevel} onChange={setWindowLevel} />
              <MetadataPanel asset={metaAsset} />
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
              aiProvider={aiSelection.provider}
              aiFallbackProvider={aiSelection.fallbackProvider}
              onDeleteAsset={() => handleDeleteAsset(activeAsset.id)}
            />
          ) : null}
        </aside>
      </div>
    </div>
  )
}

export default App
