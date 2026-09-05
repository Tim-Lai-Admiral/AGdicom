/**
 * JSON 导入/导出（schema v1，CR-001 T-002 / R-005）。
 *
 * 导出文件是评审数据的权威备份：{ schemaVersion, exportedAt, state }。
 * schema 一经发布不得静默变更字段名/结构；不兼容变更必须递增 schemaVersion，
 * 旧版本应用导入新版本文件时应被拒绝并给出可读提示。
 */
import { isAssetKind, isAssetStatus } from '../domain/types.ts'
import type { AppState } from '../domain/types.ts'
import { toPersistableState } from './repository.ts'

export const EXPORT_SCHEMA_VERSION = 1

export interface ExportFile {
  schemaVersion: number
  /** 导出时间（ISO 8601），用于追溯 */
  exportedAt: string
  state: AppState
}

/** 导入校验失败：message 为可直接展示的中文提示，issues 为全部具体问题 */
export class ImportFormatError extends Error {
  readonly issues: readonly string[]
  constructor(message: string, issues: readonly string[] = []) {
    super(message)
    this.name = 'ImportFormatError'
    this.issues = issues
  }
}

/** 归一化时间戳：缺省取当前时间 */
function toTimestamp(now?: string | Date): string {
  if (now === undefined) return new Date().toISOString()
  return typeof now === 'string' ? now : now.toISOString()
}

/** 构建导出文件对象（含 schema 版本、导出时间与完整 AppState，自动剥离会话字段） */
export function buildExportFile(state: AppState, now?: string | Date): ExportFile {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: toTimestamp(now),
    state: toPersistableState(state),
  }
}

/** 序列化导出 JSON（2 空格缩进，便于人工核对与追溯） */
export function serializeExport(state: AppState, now?: string | Date): string {
  return JSON.stringify(buildExportFile(state, now), null, 2)
}

/**
 * 检测导入素材与现有素材的名称冲突（按展示名称 asset.name 匹配），
 * 返回排序去重后的冲突名称列表，供 UI 在恢复前提示用户（R-005）。
 */
export function findNameConflicts(current: AppState, incoming: AppState): string[] {
  const incomingNames = new Set(Object.values(incoming.assets).map((asset) => asset.name))
  const conflicts = new Set<string>()
  for (const asset of Object.values(current.assets)) {
    if (incomingNames.has(asset.name)) conflicts.add(asset.name)
  }
  return Array.from(conflicts).sort()
}

// ---------------------------------------------------------------------------
// 导入校验（深度结构校验，报告所有问题）
// ---------------------------------------------------------------------------

type Issues = string[]

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function reportString(value: unknown, path: string, issues: Issues, nonEmpty = false): boolean {
  if (typeof value !== 'string') {
    issues.push(`${path} 应为字符串`)
    return false
  }
  if (nonEmpty && value.trim() === '') {
    issues.push(`${path} 不应为空`)
    return false
  }
  return true
}

function reportNumber(
  value: unknown,
  path: string,
  issues: Issues,
  options: { min?: number } = {},
): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push(`${path} 应为有限数字`)
    return false
  }
  if (options.min !== undefined && value < options.min) {
    issues.push(`${path} 不应小于 ${options.min}`)
    return false
  }
  return true
}

function validateAssetFile(value: unknown, path: string, issues: Issues): void {
  if (!isPlainRecord(value)) {
    issues.push(`${path} 应为对象`)
    return
  }
  reportString(value.fileName, `${path}.fileName`, issues, true)
  reportNumber(value.fileSize, `${path}.fileSize`, issues, { min: 0 })
  reportString(value.fileType, `${path}.fileType`, issues)
}

function validateDicomMeta(value: unknown, path: string, issues: Issues): void {
  if (!isPlainRecord(value)) {
    issues.push(`${path} 应为对象`)
    return
  }
  if (value.modality !== undefined) reportString(value.modality, `${path}.modality`, issues)
  if (value.sopClass !== undefined) reportString(value.sopClass, `${path}.sopClass`, issues)
  if (value.transferSyntax !== undefined) {
    reportString(value.transferSyntax, `${path}.transferSyntax`, issues)
  }
  if (value.rows !== undefined) reportNumber(value.rows, `${path}.rows`, issues, { min: 0 })
  if (value.columns !== undefined) {
    reportNumber(value.columns, `${path}.columns`, issues, { min: 0 })
  }
  if (value.pixelSpacing !== undefined) {
    if (!Array.isArray(value.pixelSpacing)) {
      issues.push(`${path}.pixelSpacing 应为数组`)
    } else if (value.pixelSpacing.some((spacing) => typeof spacing !== 'number')) {
      issues.push(`${path}.pixelSpacing 的每个元素应为数字`)
    }
  }
  if (value.seriesInstanceUID !== undefined) {
    reportString(value.seriesInstanceUID, `${path}.seriesInstanceUID`, issues)
  }
  if (value.patientName !== undefined) {
    reportString(value.patientName, `${path}.patientName`, issues)
  }
  if (value.patientID !== undefined) reportString(value.patientID, `${path}.patientID`, issues)
  // sliceCount 与 deidentified 为必填核验字段
  reportNumber(value.sliceCount, `${path}.sliceCount`, issues, { min: 0 })
  if (typeof value.deidentified !== 'boolean') {
    issues.push(`${path}.deidentified 应为布尔值`)
  }
  if (value.deidentificationMethod !== undefined) {
    reportString(value.deidentificationMethod, `${path}.deidentificationMethod`, issues)
  }
}

function validateAsset(assetId: string, value: unknown, issues: Issues): void {
  const path = `assets[${assetId}]`
  if (!isPlainRecord(value)) {
    issues.push(`${path} 应为对象`)
    return
  }
  reportString(value.id, `${path}.id`, issues, true)
  reportString(value.name, `${path}.name`, issues, true)
  if (!isAssetKind(value.kind)) issues.push(`${path}.kind 应为 image/dicom/model`)
  if (!isAssetStatus(value.status)) issues.push(`${path}.status 应为 pending/passed/rejected`)
  if (!Array.isArray(value.tags)) {
    issues.push(`${path}.tags 应为数组`)
  } else if (value.tags.some((tag) => typeof tag !== 'string')) {
    issues.push(`${path}.tags 的每个元素应为字符串`)
  }
  reportString(value.note, `${path}.note`, issues)
  reportString(value.source, `${path}.source`, issues)
  reportString(value.createdAt, `${path}.createdAt`, issues, true)
  reportString(value.updatedAt, `${path}.updatedAt`, issues, true)
  validateAssetFile(value.file, `${path}.file`, issues)
  if (value.dicomMeta !== undefined) validateDicomMeta(value.dicomMeta, `${path}.dicomMeta`, issues)
  if (value.objectUrl !== undefined) reportString(value.objectUrl, `${path}.objectUrl`, issues)
}

function validateTag(tagName: string, value: unknown, issues: Issues): void {
  const path = `tags[${tagName}]`
  if (!isPlainRecord(value)) {
    issues.push(`${path} 应为对象`)
    return
  }
  reportString(value.name, `${path}.name`, issues, true)
  reportNumber(value.count, `${path}.count`, issues, { min: 0 })
}

function validateReviewHistory(assetId: string, value: unknown, issues: Issues): void {
  const path = `reviews[${assetId}]`
  if (!Array.isArray(value)) {
    issues.push(`${path} 应为数组`)
    return
  }
  value.forEach((record, index) => {
    const recordPath = `${path}[${index}]`
    if (!isPlainRecord(record)) {
      issues.push(`${recordPath} 应为对象`)
      return
    }
    if (!isAssetStatus(record.status)) {
      issues.push(`${recordPath}.status 应为 pending/passed/rejected`)
    }
    reportString(record.comment, `${recordPath}.comment`, issues)
    reportString(record.createdAt, `${recordPath}.createdAt`, issues, true)
  })
}

/** 深度校验 state 结构，全部通过时收窄为 AppState（问题累积到 issues） */
function validateState(value: unknown, issues: Issues): value is AppState {
  if (!isPlainRecord(value)) {
    issues.push('state 应为对象')
    return false
  }
  if (!isPlainRecord(value.assets)) {
    issues.push('state.assets 应为对象（以资产 ID 为键）')
  } else {
    for (const [assetId, asset] of Object.entries(value.assets)) {
      validateAsset(assetId, asset, issues)
    }
  }
  if (!isPlainRecord(value.tags)) {
    issues.push('state.tags 应为对象（以标签名为键）')
  } else {
    for (const [tagName, tag] of Object.entries(value.tags)) {
      validateTag(tagName, tag, issues)
    }
  }
  if (!isPlainRecord(value.reviews)) {
    issues.push('state.reviews 应为对象（以资产 ID 为键）')
  } else {
    for (const [assetId, history] of Object.entries(value.reviews)) {
      validateReviewHistory(assetId, history, issues)
    }
  }
  return issues.length === 0
}

/**
 * 解析并校验导入的 JSON 文本，合法时返回还原的 AppState（剥离会话字段）。
 * 非法时抛出 ImportFormatError：message 为可读中文提示（含原因/版本/首批问题），
 * issues 字段携带全部具体问题，供 UI 展示详情。
 */
export function parseImportFile(text: string): AppState {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new ImportFormatError(`导入失败：文件不是有效的 JSON（${reason}）`)
  }
  if (!isPlainRecord(parsed)) {
    throw new ImportFormatError('导入失败：文件顶层应为 JSON 对象')
  }
  if (parsed.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    const actual =
      parsed.schemaVersion === undefined ? '缺失' : String(parsed.schemaVersion)
    throw new ImportFormatError(
      `导入失败：schema 版本不符（文件为 ${actual}，当前应用支持版本 ${EXPORT_SCHEMA_VERSION}）`,
    )
  }
  if (typeof parsed.exportedAt !== 'string' || parsed.exportedAt.trim() === '') {
    throw new ImportFormatError('导入失败：缺少有效的导出时间字段 exportedAt')
  }
  const issues: Issues = []
  if (!validateState(parsed.state, issues)) {
    const preview = issues.slice(0, 3).join('；')
    const suffix = issues.length > 3 ? ` 等共 ${issues.length} 处问题` : ''
    throw new ImportFormatError(`导入失败：数据结构校验未通过（${preview}${suffix}）`, issues)
  }
  return toPersistableState(parsed.state)
}
