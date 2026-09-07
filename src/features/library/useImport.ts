/**
 * 导入流程 Hook（CR-001 T-003 / R-001）。
 *
 * 职责：File 列表 → 元数据分类（classifyImportFiles 纯函数）→ 为新素材创建会话级
 * objectUrl（URL.createObjectURL）→ 回写应用状态并持久化（saveState，自动剥离会话字段）
 * → 维护导入反馈（成功 / 水合复活 / 重复 / 未知类型 / 保存异常）。
 *
 * 幽灵水合（CR-006 R-014）：classifyImportFiles 识别出的 hydrated 项在此重建 objectUrl
 * 并回写原资产记录（不新增记录、不改元数据），saveState 仍只持久化元数据。
 *
 * 异步策略：先置“导入中”再处理（setTimeout 让出一轮事件循环，使状态先渲染），
 * 大文件（≥10MB）以 importingLarge 标记供 UI 提示；本任务不读取文件内容，
 * 真正的重 IO 解析（DICOM / 3D）属于 T-005 / T-006。
 *
 * 已知限制：并发调用 importFiles 各自以闭包内的 state 快照计算，后完成者会覆盖
 * 先完成者的结果；ImportZone 在 importing 期间忽略新事件来规避该问题。
 */
import { useCallback, useState } from 'react'
import type { Asset, AppState } from '../../domain/types.ts'
import { saveState } from '../../store/repository.ts'
import { classifyImportFiles } from './importAssets.ts'
import type { ImportDuplicate, ImportHydration, ImportUnknown } from './importAssets.ts'

/** 大文件阈值：≥10MB 视为需要后台处理并向用户提示 */
export const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024

/** 导入反馈：一次 importFiles 调用的结构化结果（供 UI 直接展示） */
export interface ImportFeedback {
  /** 本次成功注册的素材 */
  created: Asset[]
  /** 本次水合复活的幽灵资产（重建 objectUrl，不新增记录） */
  hydrated: ImportHydration[]
  /** 重复跳过的文件 */
  duplicates: ImportDuplicate[]
  /** 类型不受支持的文件（含可读中文原因） */
  unknown: ImportUnknown[]
  /** 持久化等环节的异常消息；null 表示无异常 */
  error: string | null
}

export interface UseImportParams {
  /** 当前应用状态（用于去重与增量注册） */
  state: AppState
  /** 注册完成后的状态回写（App 层 setState） */
  onStateChange: (next: AppState) => void
}

export interface UseImportResult {
  /** 导入一组文件；空列表直接返回（取消选择场景，无副作用） */
  importFiles: (files: readonly File[], source?: string) => Promise<void>
  /** 是否正在导入 */
  importing: boolean
  /** 本批次包含 ≥10MB 大文件（供 UI 显示更明确的后台处理提示） */
  importingLarge: boolean
  /** 最近一次导入的反馈；null 表示尚未导入 */
  feedback: ImportFeedback | null
  /** 清除反馈 */
  clearFeedback: () => void
}

function fileKey(fileName: string, fileSize: number): string {
  return `${fileName}\u0000${fileSize}`
}

function createObjectUrlSafely(file: File): string | undefined {
  // 测试环境（jsdom）未实现 URL.createObjectURL 时跳过：素材记录与列表展示不依赖它
  if (typeof URL.createObjectURL !== 'function') return undefined
  return URL.createObjectURL(file)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return `未知错误（${String(error)}）`
}

/** 按 fileName + fileSize 建立原始 File 索引（同批次重复文件取首次出现） */
function buildFileIndex(files: readonly File[]): Map<string, File> {
  const fileByKey = new Map<string, File>()
  for (const file of files) {
    const key = fileKey(file.name, file.size)
    if (!fileByKey.has(key)) fileByKey.set(key, file)
  }
  return fileByKey
}

/**
 * 为新注册素材附加会话级 objectUrl：按 fileName + fileSize 匹配回原始 File。
 */
function attachObjectUrls(
  state: AppState,
  created: readonly Asset[],
  files: readonly File[],
): AppState {
  if (created.length === 0) return state
  const fileByKey = buildFileIndex(files)
  const assets: Record<string, Asset> = { ...state.assets }
  for (const asset of created) {
    const file = fileByKey.get(fileKey(asset.file.fileName, asset.file.fileSize))
    const objectUrl = file === undefined ? undefined : createObjectUrlSafely(file)
    assets[asset.id] = objectUrl === undefined ? asset : { ...asset, objectUrl }
  }
  return { assets, tags: state.tags, reviews: state.reviews }
}

/**
 * 幽灵水合（R-014）：为命中去重键且无 objectUrl 的存量资产重建会话 objectUrl 并回写。
 * 不新增记录、不改元数据（updatedAt 保持原值，持久化内容不变）；
 * 无法匹配原始 File 或环境不支持 createObjectURL 时保持原样（返回原引用）。
 */
function hydrateGhosts(
  state: AppState,
  hydrated: readonly ImportHydration[],
  files: readonly File[],
): AppState {
  if (hydrated.length === 0) return state
  const fileByKey = buildFileIndex(files)
  let changed = false
  const assets: Record<string, Asset> = { ...state.assets }
  for (const item of hydrated) {
    const asset = assets[item.assetId]
    if (asset === undefined) continue
    const file = fileByKey.get(fileKey(item.fileName, item.fileSize))
    if (file === undefined) continue
    const objectUrl = createObjectUrlSafely(file)
    if (objectUrl === undefined) continue
    assets[item.assetId] = { ...asset, objectUrl }
    changed = true
  }
  if (!changed) return state
  return { assets, tags: state.tags, reviews: state.reviews }
}

export function useImport({ state, onStateChange }: UseImportParams): UseImportResult {
  const [importing, setImporting] = useState(false)
  const [importingLarge, setImportingLarge] = useState(false)
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null)

  const importFiles = useCallback(
    async (files: readonly File[], source = '拖拽导入'): Promise<void> => {
      if (files.length === 0) return // 取消选择 / 空文件列表：无副作用
      setImporting(true)
      setImportingLarge(files.some((file) => file.size >= LARGE_FILE_THRESHOLD))
      try {
        // 先让“导入中”状态渲染，处理放到下一轮事件循环，避免阻塞 UI
        await new Promise((resolve) => {
          setTimeout(resolve, 0)
        })
        const candidates = files.map((file) => ({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }))
        const result = classifyImportFiles(state, candidates, { source })
        let nextState = attachObjectUrls(result.state, result.created, files)
        nextState = hydrateGhosts(nextState, result.hydrated, files)
        if (nextState !== state) onStateChange(nextState)
        let error: string | null = null
        if (result.created.length > 0 || result.hydrated.length > 0) {
          try {
            saveState(nextState) // saveState 自动剥离会话字段（objectUrl）
          } catch (saveError) {
            // RepositorySaveError 携带可直接展示的中文提示
            error = `素材已加入本次会话，但${errorMessage(saveError)}`
          }
        }
        setFeedback({
          created: result.created,
          hydrated: result.hydrated,
          duplicates: result.duplicates,
          unknown: result.unknown,
          error,
        })
      } catch (error) {
        setFeedback({
          created: [],
          hydrated: [],
          duplicates: [],
          unknown: [],
          error: `导入失败：${errorMessage(error)}`,
        })
      } finally {
        setImporting(false)
        setImportingLarge(false)
      }
    },
    [state, onStateChange],
  )

  const clearFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  return { importFiles, importing, importingLarge, feedback, clearFeedback }
}
