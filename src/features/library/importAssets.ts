/**
 * 素材导入分类纯函数（CR-001 T-003 / R-001）。
 *
 * 约定：
 * - 仅按扩展名分类，不读取文件内容做类型嗅探（DICOM 内容解析属于 T-005）；
 * - 纯函数：不修改入参、无 IO；ID 与时间戳通过 options 注入（缺省用 crypto.randomUUID /
 *   当前时间），保证测试确定性；
 * - 去重键 = fileName + fileSize + kind：与库中存量或本批次先注册项完全一致视为重复；
 * - 扩展名匹配不区分大小写；无法识别的扩展名进入 unknown 列表并附中文提示。
 */
import type { AppState, Asset, AssetKind } from '../../domain/types.ts'

/** 支持的扩展名（小写）→ 素材类型 */
export const EXTENSION_KIND_MAP: Readonly<Record<string, AssetKind>> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  dcm: 'dicom',
  stl: 'model',
  obj: 'model',
  glb: 'model',
  gltf: 'model',
}

/** 供 UI 展示的支持类型说明（未知类型提示中复用） */
export const SUPPORTED_TYPES_HINT =
  '支持导入：图片（png/jpg/jpeg/gif/webp/bmp）、DICOM（dcm）、3D 模型（stl/obj/glb/gltf）'

/** 导入候选：文件的最小元数据（来自浏览器 File API；本模块不依赖 DOM 类型） */
export interface ImportCandidate {
  fileName: string
  fileSize: number
  /** MIME 类型，浏览器无法识别时为空字符串 */
  fileType: string
}

/** 重复项：与已有素材 fileName + fileSize + kind 完全一致，未注册 */
export interface ImportDuplicate {
  fileName: string
  fileSize: number
  kind: AssetKind
}

/** 不支持项：扩展名无法识别，未注册 */
export interface ImportUnknown {
  fileName: string
  /** 小写扩展名；文件名无可用扩展名时为空字符串 */
  extension: string
  /** 可直接展示的中文原因 */
  message: string
}

/** 结构化导入结果：成功 / 重复 / 失败（未知类型）三类列表 + 注册后的下一状态 */
export interface ImportClassifyResult {
  /** 含新注册素材的下一状态；无新增时与入参为同一引用（不修改入参） */
  state: AppState
  /** 本次新建并注册的素材（按提交顺序） */
  created: Asset[]
  /** 重复项，未注册 */
  duplicates: ImportDuplicate[]
  /** 扩展名不支持项，未注册 */
  unknown: ImportUnknown[]
}

export interface ClassifyOptions {
  /** 注册时间戳，缺省取当前时间 */
  now?: string | Date
  /** 素材 ID 工厂，缺省使用 crypto.randomUUID() */
  createId?: () => string
  /** 来源描述（如“拖拽导入”/“文件选择导入”） */
  source?: string
}

/** 提取小写扩展名：取最后一个“.”之后；“.gitignore”等隐藏文件、无后缀、结尾为点均返回空字符串 */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

/** 按文件名判定素材类型；无法识别返回 null */
export function kindForFileName(fileName: string): AssetKind | null {
  return EXTENSION_KIND_MAP[extensionOf(fileName)] ?? null
}

/** 去重键：kind + fileSize + fileName（对用户可见的“同一文件”判定） */
function dedupKey(fileName: string, fileSize: number, kind: AssetKind): string {
  return `${kind}\u0000${fileSize}\u0000${fileName}`
}

function toTimestamp(now?: string | Date): string {
  if (now === undefined) return new Date().toISOString()
  return typeof now === 'string' ? now : now.toISOString()
}

function defaultCreateId(): string {
  return crypto.randomUUID()
}

/**
 * 对一批候选文件分类并增量注册：
 * - 支持的扩展名 → 创建 Asset（pending 状态）并并入下一状态；
 * - 重复（同库中存量或本批次先注册项）→ 记入 duplicates，不重复注册；
 * - 未知扩展名 → 记入 unknown（含中文提示），不注册。
 */
export function classifyImportFiles(
  state: AppState,
  files: readonly ImportCandidate[],
  options: ClassifyOptions = {},
): ImportClassifyResult {
  const at = toTimestamp(options.now)
  const createId = options.createId ?? defaultCreateId
  const source = options.source ?? '拖拽导入'
  const created: Asset[] = []
  const duplicates: ImportDuplicate[] = []
  const unknown: ImportUnknown[] = []
  /** 已注册素材的去重键（含库中存量与本批次新增，保证同批次内重复也被识别） */
  const seen = new Set<string>()
  for (const asset of Object.values(state.assets)) {
    seen.add(dedupKey(asset.file.fileName, asset.file.fileSize, asset.kind))
  }
  let assets = state.assets
  for (const file of files) {
    const kind = kindForFileName(file.fileName)
    if (kind === null) {
      unknown.push({
        fileName: file.fileName,
        extension: extensionOf(file.fileName),
        message: `“${file.fileName}”不是支持的素材类型。${SUPPORTED_TYPES_HINT}`,
      })
      continue
    }
    const key = dedupKey(file.fileName, file.fileSize, kind)
    if (seen.has(key)) {
      duplicates.push({ fileName: file.fileName, fileSize: file.fileSize, kind })
      continue
    }
    seen.add(key)
    const asset: Asset = {
      id: createId(),
      name: file.fileName,
      kind,
      status: 'pending',
      tags: [],
      note: '',
      source,
      file: {
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileType: file.fileType,
      },
      createdAt: at,
      updatedAt: at,
    }
    created.push(asset)
    assets = { ...assets, [asset.id]: asset }
  }
  if (created.length === 0) {
    return { state, created, duplicates, unknown }
  }
  return {
    state: { assets, tags: state.tags, reviews: state.reviews },
    created,
    duplicates,
    unknown,
  }
}
