/**
 * 领域类型契约（CR-001 T-002）。
 *
 * 全项目领域类型集中定义于此，其他模块不得自行定义领域类型。
 * 该文件是后续任务（T-003 素材导入 / T-005 DICOM 元数据 / T-007 评审面板）的公共契约：
 * 字段名一经发布即不得静默变更，破坏性变更须走 schema/key 版本升级。
 */

/** 素材类型：图片 / DICOM / 3D 模型（R-001） */
export type AssetKind = 'image' | 'dicom' | 'model'

/** 素材类型的中文展示名 */
export const ASSET_KIND_LABELS: Readonly<Record<AssetKind, string>> = {
  image: '图片',
  dicom: 'DICOM',
  model: '3D 模型',
}

/** 评审状态：待评审 / 通过 / 驳回（R-002 / R-005） */
export type AssetStatus = 'pending' | 'passed' | 'rejected'

/** 评审状态的中文展示名 */
export const ASSET_STATUS_LABELS: Readonly<Record<AssetStatus, string>> = {
  pending: '待评审',
  passed: '通过',
  rejected: '驳回',
}

/** 未知值是否为合法 AssetKind（供导入校验等使用） */
export function isAssetKind(value: unknown): value is AssetKind {
  return value === 'image' || value === 'dicom' || value === 'model'
}

/** 未知值是否为合法 AssetStatus（供导入校验等使用） */
export function isAssetStatus(value: unknown): value is AssetStatus {
  return value === 'pending' || value === 'passed' || value === 'rejected'
}

/** 素材的来源文件信息 */
export interface AssetFile {
  /** 原始文件名（含扩展名） */
  fileName: string
  /** 文件大小（字节） */
  fileSize: number
  /** MIME 类型（无法识别时为空字符串） */
  fileType: string
}

/**
 * DICOM 元数据（R-003）。
 * 形状先于此处定义，数据由 T-005 用 dicom-parser 解析填充；
 * 除 sliceCount / deidentified 外均可缺省（文件损坏或字段缺失时降级为仅展示已有信息）。
 *
 * T-005 增量扩展（均为可选字段，旧数据/旧版本导出文件不受影响）：
 * - instanceNumber：多文件 series 的切片排序依据（0020,0013）；
 * - deidentifiedEvidence：去标识化依据的结构化说明（布尔 + 依据）。
 */
export interface DicomMeta {
  /** Modality，如 CT / MR */
  modality?: string
  /** SOP Class UID */
  sopClass?: string
  /** Transfer Syntax UID（用于判断是否可做像素预览） */
  transferSyntax?: string
  /** 图像行数 */
  rows?: number
  /** 图像列数 */
  columns?: number
  /** 像素间距 [行间距, 列间距]（mm） */
  pixelSpacing?: number[]
  /** 序列实例 UID（切片数按它分组统计） */
  seriesInstanceUID?: string
  /** 患者姓名：去标识化后缺失或为空（UI 显示“已置空”） */
  patientName?: string
  /** 患者 ID：去标识化后缺失或为空 */
  patientID?: string
  /** 本文件的切片序号（InstanceNumber (0020,0013)；多文件 series 排序用，缺失为 undefined） */
  instanceNumber?: number
  /** 所属 series 的切片数（按 SeriesInstanceUID 分组统计，单文件时为 1） */
  sliceCount: number
  /** 去标识化标记（PatientIdentityRemoved / DeidentificationMethod / 患者字段为空） */
  deidentified: boolean
  /** 去标识化方法（DeidentificationMethod 字段原文） */
  deidentificationMethod?: string
  /** 去标识化依据（结构化说明；deidentified 为 true 时非空） */
  deidentifiedEvidence?: DicomDeidEvidence[]
}

/** 去标识化依据类型（DicomMeta.deidentifiedEvidence 的条目，由 DICOM 解析层检测） */
export type DicomDeidEvidence =
  /** (0012,0062) PatientIdentityRemoved 标记为 YES */
  | 'patient-identity-removed'
  /** (0012,0063) DeidentificationMethod 字段非空 */
  | 'deidentification-method'
  /** PatientName 与 PatientID 均缺失或为空 */
  | 'empty-patient-fields'

/** 单条评审记录：结论状态 + 评审意见 + 时间戳（R-005） */
export interface ReviewRecord {
  /** 本次评审结论 */
  status: AssetStatus
  /** 评审意见（可为空字符串） */
  comment: string
  /** 操作时间戳（ISO 8601） */
  createdAt: string
}

/** 追加式评审历史：每次评审都留痕，旧记录不改写 */
export type ReviewHistory = ReviewRecord[]

/** 标签（注册表条目）：名称 + 当前使用计数 */
export interface Tag {
  /** 标签名（去除首尾空白后的原文，区分大小写） */
  name: string
  /** 当前使用该标签的素材数（可为 0：注册表保留条目便于复用） */
  count: number
}

/** 素材（图片 / DICOM / 3D 模型的统一抽象） */
export interface Asset {
  /** 唯一 ID（crypto.randomUUID()，由导入任务 T-003 生成） */
  id: string
  /** 展示名称（可重命名，或被 AI 建议覆盖） */
  name: string
  kind: AssetKind
  status: AssetStatus
  /** 标签名列表 */
  tags: string[]
  /** 备注 */
  note: string
  /** 来源信息（导入方式 / 来源目录等自由文本） */
  source: string
  /** 来源文件信息 */
  file: AssetFile
  /** DICOM 元数据（仅 dicom 素材，解析成功后由 T-005 填充） */
  dicomMeta?: DicomMeta
  /** 创建时间（ISO 8601） */
  createdAt: string
  /** 最后更新时间（ISO 8601） */
  updatedAt: string
  /** 浏览器对象 URL（blob:）：会话字段，不持久化、不导出 */
  objectUrl?: string
}

/** 应用状态：持久化（localStorage）与导出（JSON）的完整数据 */
export interface AppState {
  /** 素材，以资产 ID 为键 */
  assets: Record<string, Asset>
  /** 标签注册表，以标签名为键 */
  tags: Record<string, Tag>
  /** 评审历史，以资产 ID 为键 */
  reviews: Record<string, ReviewHistory>
}
