/**
 * DICOM 元数据解析封装（CR-001 T-005 / R-003）。
 *
 * 职责：ArrayBuffer → dicom-parser 数据集 → 领域契约 DicomMeta：
 * - 基础元数据：Modality / SOP Class / TransferSyntax / Rows / Columns / PixelSpacing
 *   （反斜杠分隔解析）/ SeriesInstanceUID / PatientName / PatientID / InstanceNumber；
 * - 去标识化检测：0012,0062 PatientIdentityRemoved、0012,0063 DeidentificationMethod、
 *   患者字段为空 → 结构化依据（deidentifiedEvidence）+ 布尔（deidentified）；
 * - 切片数：单文件即其 series 的 1 张切片（sliceCount=1），多文件聚合由 seriesUtils / UI 完成；
 * - 解析失败抛 DicomParseError（可读中文，供降级路径）；dicom-parser 中断时抛出的
 *   {exception, dataSet} 含已成功解析的元素，尽力抢救为 partial 结果（仅元数据展示）。
 */
import { parseDicom } from 'dicom-parser'
import type { DataSet } from 'dicom-parser'
import type { DicomDeidEvidence, DicomMeta } from '../../../domain/types.ts'

/** 解析结果：meta 为领域契约数据；dataset 供像素解码复用（避免二次解析） */
export interface ParsedDicom {
  meta: DicomMeta
  dataset: DataSet
  /** true = 文件被截断等异常下抢救出的部分元数据（字段尽力展示，预览不可用） */
  partial: boolean
}

/** DICOM 解析失败（message 可直接展示，cause 保留原始异常） */
export class DicomParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DicomParseError'
  }
}

/** dicom-parser 解析中断时抛出的包装对象（exception 为原始异常，dataSet 为已解析部分） */
interface DicomParserFailure {
  exception: unknown
  dataSet?: DataSet
}

function isDicomParserFailure(value: unknown): value is DicomParserFailure {
  return typeof value === 'object' && value !== null && 'exception' in value
}

/** dicom-parser 会抛裸字符串、Error 或 {exception, dataSet} 包装对象，统一归一为可读文本 */
function describeParseError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (isDicomParserFailure(error)) {
    const wrapped = error.exception
    return wrapped === undefined ? String(error) : describeParseError(wrapped)
  }
  return String(error)
}

/** 字符串值清理：去首尾空白；空值归一为 undefined（字段缺失/为空的统一表达） */
function nonEmptyString(raw: string | undefined): string | undefined {
  const value = raw?.trim()
  return value === undefined || value === '' ? undefined : value
}

/** 正数（Rows/Columns 等），0 或缺失归一为 undefined */
function positiveNumber(raw: number | undefined): number | undefined {
  return raw !== undefined && raw > 0 ? raw : undefined
}

/** PixelSpacing（DS，反斜杠分隔）→ 数字数组；取前两个有效值（行间距、列间距） */
function parsePixelSpacing(raw: string | undefined): number[] | undefined {
  if (raw === undefined) return undefined
  const values = raw
    .split('\\')
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value))
  if (values.length === 0) return undefined
  return values.length >= 2 ? [values[0], values[1]] : [values[0]]
}

/**
 * 从 dicom-parser 数据集提取 DicomMeta（sliceCount=1：单文件即单切片，
 * 多文件聚合统计由 seriesUtils 按 SeriesInstanceUID 完成）。
 */
export function extractDicomMeta(dataset: DataSet): DicomMeta {
  const patientName = nonEmptyString(dataset.string('x00100010'))
  const patientID = nonEmptyString(dataset.string('x00100020'))
  const identityRemoved = nonEmptyString(dataset.string('x00120062'))
  const deidentificationMethod = nonEmptyString(dataset.string('x00120063'))

  const evidence: DicomDeidEvidence[] = []
  if (identityRemoved === 'YES') evidence.push('patient-identity-removed')
  if (deidentificationMethod !== undefined) evidence.push('deidentification-method')
  if (patientName === undefined && patientID === undefined) {
    evidence.push('empty-patient-fields')
  }

  const instanceNumber = dataset.intString('x00200013')

  return {
    modality: nonEmptyString(dataset.string('x00080060')),
    sopClass: nonEmptyString(dataset.string('x00080016')) ?? nonEmptyString(dataset.string('x00020002')),
    transferSyntax: nonEmptyString(dataset.string('x00020010')),
    rows: positiveNumber(dataset.uint16('x00280010')),
    columns: positiveNumber(dataset.uint16('x00280011')),
    pixelSpacing: parsePixelSpacing(dataset.string('x00280030')),
    seriesInstanceUID: nonEmptyString(dataset.string('x0020000e')),
    patientName,
    patientID,
    instanceNumber:
      instanceNumber !== undefined && Number.isFinite(instanceNumber) ? instanceNumber : undefined,
    sliceCount: 1,
    deidentified: evidence.length > 0,
    deidentificationMethod,
    deidentifiedEvidence: evidence.length > 0 ? evidence : undefined,
  }
}

/**
 * 解析 DICOM 文件：
 * - 成功 → { meta, dataset, partial: false }；
 * - 文件被截断但 dicom-parser 已解析出部分元素 → { meta, dataset, partial: true }
 *   （元数据尽力展示，像素预览由解码层的长度校验降级）；
 * - 无法解析（非 DICOM / 结构破坏 / 缺少必需元组）→ 抛 DicomParseError。
 */
export function parseDicomFile(buffer: ArrayBuffer): ParsedDicom {
  try {
    const dataset = parseDicom(new Uint8Array(buffer))
    return { meta: extractDicomMeta(dataset), dataset, partial: false }
  } catch (error) {
    if (isDicomParserFailure(error) && error.dataSet !== undefined) {
      if (Object.keys(error.dataSet.elements).length > 0) {
        return { meta: extractDicomMeta(error.dataSet), dataset: error.dataSet, partial: true }
      }
    }
    throw new DicomParseError(`无法解析该 DICOM 文件：${describeParseError(error)}`, {
      cause: error,
    })
  }
}
