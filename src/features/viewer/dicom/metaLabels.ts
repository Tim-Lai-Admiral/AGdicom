/**
 * DICOM 元数据可读标签（CR-003 T-002 自 DicomViewer 抽出共享）。
 *
 * 工作台右栏元数据分组面板与中央 DICOM 查看器共用同一套可读化规则，
 * 避免“中央表格”与“右栏分组”展示口径不一致。仅展示层映射，不改解析契约。
 */
import type { DicomDeidEvidence } from '../../../domain/types.ts'
import {
  EXPLICIT_VR_LITTLE_ENDIAN_UID,
  IMPLICIT_VR_LITTLE_ENDIAN_UID,
} from './decodePixel.ts'

/** 常见 SOP Class 的可读名称（未知 UID 原样展示） */
const SOP_CLASS_LABELS: Readonly<Record<string, string>> = {
  '1.2.840.10008.5.1.4.1.1.2': 'CT Image Storage',
  '1.2.840.10008.5.1.4.1.1.2.1': 'Enhanced CT Image Storage',
  '1.2.840.10008.5.1.4.1.1.4': 'MR Image Storage',
  '1.2.840.10008.5.1.4.1.1.7': 'Secondary Capture Image Storage',
}

/** 常见传输语法的可读名称（用于判断预览可用性并向用户说明） */
const TRANSFER_SYNTAX_LABELS: Readonly<Record<string, string>> = {
  [IMPLICIT_VR_LITTLE_ENDIAN_UID]: 'Implicit VR Little Endian（无压缩）',
  [EXPLICIT_VR_LITTLE_ENDIAN_UID]: 'Explicit VR Little Endian（无压缩）',
  '1.2.840.10008.1.2.2': 'Explicit VR Big Endian（无压缩，暂不支持预览）',
  '1.2.840.10008.1.2.5': 'RLE Lossless（压缩，仅元数据）',
  // JPEG 2000 与 JPEG 同属 1.2.840.10008.1.2.4 家族，UID 需精确区分（T-005 Minor）
  '1.2.840.10008.1.2.4.90': 'JPEG 2000 无损压缩（仅元数据）',
  '1.2.840.10008.1.2.4.91': 'JPEG 2000 压缩（仅元数据）',
}

/** 去标识化依据的可读说明 */
export const DEID_EVIDENCE_LABELS: Readonly<Record<DicomDeidEvidence, string>> = {
  'patient-identity-removed': 'PatientIdentityRemoved（0012,0062）标记为 YES',
  'deidentification-method': '包含 DeidentificationMethod（0012,0063）字段',
  'empty-patient-fields': '患者字段（姓名 / ID）均为空',
}

export function sopClassLabel(uid: string | undefined): string {
  if (uid === undefined) return '未提供'
  const known = SOP_CLASS_LABELS[uid]
  return known !== undefined ? `${known}（${uid}）` : uid
}

export function transferSyntaxLabel(uid: string | undefined): string {
  if (uid === undefined) return '未提供'
  const known = TRANSFER_SYNTAX_LABELS[uid]
  if (known !== undefined) return known
  // 已知映射之外的 JPEG / JPEG 2000 家族 UID（按家族前缀精确区分）
  if (uid.startsWith('1.2.840.10008.1.2.4.9')) return 'JPEG 2000 压缩（仅元数据）'
  if (uid.startsWith('1.2.840.10008.1.2.4')) return 'JPEG 压缩（仅元数据）'
  return `未识别（${uid}）`
}
