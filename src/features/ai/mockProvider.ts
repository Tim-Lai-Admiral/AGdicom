/**
 * Mock AI 建议提供方（CR-002 T-008 / R-006）。
 *
 * 纯本地确定性规则（无网络调用、无 API Key），基于素材元数据生成命名/标签/摘要建议：
 * - DICOM：Modality + 序列 UID（前 8 位）+ 切片数命名；标签含 Modality/去标识化/多切片；
 * - 3D 模型：来源文件名规范化（去扩展名、空白/下划线转连字符、去非法字符）；
 * - 图片：类型 + 序号（优先取文件名中的数字，否则用资产 ID 的稳定哈希序号）。
 * 同一素材（相同输入）重复 suggest 结果完全一致（R-006 验收）。
 */
import type { Asset } from '../../domain/types.ts'
import { ASSET_KIND_LABELS } from '../../domain/types.ts'
import type { AIProvider, AiSuggestion } from './types.ts'

/** FNV-1a 字符串哈希（确定性，用于图片序号兜底，避免引入时间/随机数） */
function stableHash(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** 去掉最后一个点号起的扩展名（无扩展名或隐藏文件原样返回） */
function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

/** 取小写扩展名（无点号扩展名时为空串） */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

/** 取 MIME 子类型小写（如 image/png → png；非法/缺失为空串） */
function mimeSubtype(fileType: string): string {
  const slash = fileType.indexOf('/')
  return slash > 0 ? fileType.slice(slash + 1).toLowerCase() : ''
}

/** DICOM 命名：Modality-序列{UID 前 8 位}-{切片数}；元数据缺失时逐项降级 */
function suggestDicomName(asset: Asset): string {
  const meta = asset.dicomMeta
  const rawModality = meta?.modality?.trim() ?? ''
  const modality = rawModality !== '' ? rawModality.toUpperCase() : 'DICOM'
  const rawSeries = meta?.seriesInstanceUID?.trim() ?? ''
  const parts = [modality]
  if (rawSeries !== '') parts.push(`序列${rawSeries.slice(0, 8).replace(/\.+$/, '')}`)
  parts.push(meta === undefined ? '切片数未知' : `${meta.sliceCount}切片`)
  return parts.join('-')
}

/** 3D 模型命名：来源文件名规范化（去扩展名、空白/下划线转连字符、去非法字符） */
function suggestModelName(asset: Asset): string {
  const normalized = stripExtension(asset.file.fileName)
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized !== '' ? normalized : `模型-${asset.id.slice(0, 8)}`
}

/** 图片命名：类型 + 序号（优先文件名中的数字组，否则用资产 ID 稳定哈希的 3 位序号） */
function suggestImageName(asset: Asset): string {
  const digits = stripExtension(asset.file.fileName).match(/\d+/)
  if (digits !== null) return `图片-${digits[0]}`
  const serial = String((stableHash(asset.id) % 900) + 100)
  return `图片-${serial}`
}

/** 命名建议（按素材类型分派） */
function suggestName(asset: Asset): string | null {
  if (asset.kind === 'dicom') return suggestDicomName(asset)
  if (asset.kind === 'model') return suggestModelName(asset)
  if (asset.kind === 'image') return suggestImageName(asset)
  return null
}

/** 标签建议：基础为类型标签，再按元数据追加（Modality / 去标识化 / 多切片 / 格式 / MIME 子类型） */
function suggestTags(asset: Asset): string[] {
  const tags: string[] = [ASSET_KIND_LABELS[asset.kind]]
  if (asset.kind === 'dicom') {
    const modality = asset.dicomMeta?.modality?.trim() ?? ''
    if (modality !== '') tags.push(modality.toUpperCase())
    if (asset.dicomMeta?.deidentified === true) tags.push('已去标识化')
    if ((asset.dicomMeta?.sliceCount ?? 0) > 1) tags.push('多切片序列')
  }
  if (asset.kind === 'model') {
    const ext = extensionOf(asset.file.fileName)
    if (ext !== '') tags.push(ext.toUpperCase())
  }
  if (asset.kind === 'image') {
    const subtype = mimeSubtype(asset.file.fileType)
    if (subtype !== '') tags.push(subtype.toUpperCase())
  }
  return tags
}

/** 摘要建议：素材关键信息一句话概述 */
function suggestSummary(asset: Asset): string {
  if (asset.kind === 'dicom') {
    const meta = asset.dicomMeta
    const rawModality = meta?.modality?.trim() ?? ''
    const modality = rawModality !== '' ? rawModality.toUpperCase() : 'DICOM'
    const head = `${modality} 序列${meta?.deidentified === true ? '（已去标识化）' : ''}`
    return meta === undefined ? `${head}，切片数未知。` : `${head}，共 ${meta.sliceCount} 张切片。`
  }
  const size = `文件大小 ${asset.file.fileSize} 字节`
  if (asset.kind === 'model') {
    const ext = extensionOf(asset.file.fileName).toUpperCase()
    return `${ext !== '' ? `${ext} 格式 3D 模型` : '3D 模型素材'}，${size}。`
  }
  if (asset.kind === 'image') {
    const subtype = mimeSubtype(asset.file.fileType).toUpperCase()
    return `${subtype !== '' ? `${subtype} 图片` : '图片素材'}，${size}。`
  }
  return `素材 ${asset.file.fileName}，${size}。`
}

/** Mock 提供方：确定性规则实现（界面与 AI_USAGE.md 均明示 Mock 来源） */
export const mockProvider: AIProvider = {
  id: 'mock',
  label: 'Mock（本地确定性规则）',
  suggest(asset: Asset): AiSuggestion {
    return {
      name: suggestName(asset),
      tags: suggestTags(asset),
      summary: suggestSummary(asset),
    }
  },
}
