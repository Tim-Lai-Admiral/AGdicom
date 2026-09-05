/**
 * DICOM 元数据分组面板（CR-003 T-002 / UI-001，工作台右栏）。
 *
 * DICOM 素材选中时右栏默认显示本面板：按“患者信息 / 序列信息 / 图像信息 /
 * 去标识化”分组折叠展示 asset.dicomMeta（来自解析回写的持久化记录）。
 * 展示内容仅为工程元数据，不包含任何诊断/治疗暗示；可读化标签与中央
 * DICOM 查看器共用 metaLabels（口径一致）。
 *
 * 数据说明：dicomMeta 由查看器解析后经 App 回写持久化；未解析（刚导入、
 * 或刷新后未打开查看器）时无元数据，显示占位提示，不崩溃。
 */
import { useState } from 'react'
import type { Asset, DicomMeta } from '../../domain/types.ts'
import { DEID_EVIDENCE_LABELS, sopClassLabel, transferSyntaxLabel } from '../viewer/dicom/metaLabels.ts'

/** 单个分组定义：标题 + 行（label/value）列表 */
interface MetaSection {
  id: string
  title: string
  rows: readonly { label: string; value: string; mono?: boolean }[]
}

const DEIDENTIFIED_SUMMARY = '是' as const
const NOT_DEIDENTIFIED_SUMMARY = '否（未检测到去标识化标记）' as const

function buildSections(meta: DicomMeta): MetaSection[] {
  const patientRows: MetaSection['rows'] = [
    { label: '患者姓名', value: meta.patientName ?? '已置空' },
    { label: '患者 ID', value: meta.patientID ?? '已置空' },
  ]
  const seriesRows: MetaSection['rows'] = [
    { label: '模态（Modality）', value: meta.modality ?? '未提供' },
    { label: 'SOP Class', value: sopClassLabel(meta.sopClass), mono: true },
    { label: '传输语法', value: transferSyntaxLabel(meta.transferSyntax), mono: true },
    { label: 'SeriesInstanceUID', value: meta.seriesInstanceUID ?? '未提供', mono: true },
    { label: '切片数（按序列分组）', value: `${meta.sliceCount} 张` },
  ]
  const imageRows: MetaSection['rows'] = [
    {
      label: '行 × 列',
      value:
        meta.rows !== undefined && meta.columns !== undefined
          ? `${meta.rows} × ${meta.columns}`
          : '未提供',
    },
    {
      label: '像素间距',
      value: meta.pixelSpacing !== undefined ? `${meta.pixelSpacing.join(' × ')} mm` : '未提供',
    },
    {
      label: '切片序号',
      value: meta.instanceNumber !== undefined ? `#${meta.instanceNumber}` : '未提供',
    },
  ]
  const deidRows: MetaSection['rows'] = [
    {
      label: '去标识化',
      value: meta.deidentified ? DEIDENTIFIED_SUMMARY : NOT_DEIDENTIFIED_SUMMARY,
    },
    ...(meta.deidentificationMethod !== undefined
      ? [{ label: '去标识化方法', value: meta.deidentificationMethod }]
      : []),
  ]
  return [
    { id: 'patient', title: '患者信息', rows: patientRows },
    { id: 'series', title: '序列信息', rows: seriesRows },
    { id: 'image', title: '图像信息', rows: imageRows },
    { id: 'deid', title: '去标识化', rows: deidRows },
  ]
}

export interface MetadataPanelProps {
  /** 当前选中的 DICOM 素材（读取其 dicomMeta；undefined 表示尚未解析） */
  asset: Asset
}

export default function MetadataPanel({ asset }: MetadataPanelProps) {
  const meta = asset.dicomMeta
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    patient: true,
    series: true,
    image: false,
    deid: true,
  })

  const toggle = (id: string): void => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <section className="meta-panel" aria-label="DICOM 元数据分组">
      <h2 className="meta-panel__title">DICOM 元数据</h2>
      {meta === undefined ? (
        <p className="meta-panel__empty">
          暂无可展示的元数据：在中央查看器打开该 DICOM 文件解析后，此处按分组展示。
        </p>
      ) : (
        <div className="meta-panel__body">
          {buildSections(meta).map((section) => (
            <div key={section.id} className="meta-panel__section">
              <button
                type="button"
                className="section-header meta-panel__section-header"
                aria-expanded={expanded[section.id] === true}
                onClick={() => toggle(section.id)}
              >
                <span>{section.title}</span>
                <span className="meta-panel__chevron" aria-hidden="true">
                  {expanded[section.id] === true ? '▾' : '▸'}
                </span>
              </button>
              {expanded[section.id] === true ? (
                <div className="meta-panel__rows">
                  {section.rows.map((row) => (
                    <div key={row.label} className="meta-row">
                      <span className="meta-label">{row.label}</span>
                      <span
                        className={row.mono === true ? 'meta-value' : 'meta-value is-plain'}
                        title={row.value}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                  {section.id === 'deid' && meta.deidentified &&
                  meta.deidentifiedEvidence !== undefined ? (
                    <ul className="meta-panel__evidence">
                      {meta.deidentifiedEvidence.map((item) => (
                        <li key={item}>{DEID_EVIDENCE_LABELS[item]}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
