/**
 * 素材导入区（CR-001 T-003 / R-001）。
 *
 * 交互：拖拽（进入高亮、放下导入）+ 文件选择按钮；导入期间忽略新事件；
 * 反馈：成功计数 / 水合复活（已恢复预览）/ 重复提示 / 未知类型原因 / 超限未入库
 * （>20MB，R-016）/ 持久化异常，可手动关闭。
 */
import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ASSET_KIND_LABELS } from '../../domain/types.ts'
import { BLOB_MAX_BYTES } from '../../store/blobStore.ts'
import { SUPPORTED_TYPES_HINT } from './importAssets.ts'
import type { ImportFeedback } from './useImport.ts'

/** 文件选择器接受的扩展名（与 EXTENSION_KIND_MAP 保持一致） */
export const IMPORT_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.dcm,.stl,.obj,.glb,.gltf'

/** 字节数 → MB 展示（一位小数，20MB 阈值提示用） */
function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export interface ImportZoneProps {
  importing: boolean
  /** 本批次含 ≥10MB 大文件（显示更明确的后台处理提示） */
  importingLarge?: boolean
  feedback: ImportFeedback | null
  onImportFiles: (files: readonly File[], source: string) => void | Promise<void>
  onClearFeedback?: () => void
}

function ImportFeedbackPanel({
  feedback,
  onClear,
}: {
  feedback: ImportFeedback
  onClear?: () => void
}) {
  const { created, hydrated, duplicates, unknown, oversize, error } = feedback
  if (
    created.length === 0 &&
    hydrated.length === 0 &&
    duplicates.length === 0 &&
    unknown.length === 0 &&
    oversize.length === 0 &&
    error === null
  ) {
    return null
  }
  return (
    <div className="import-feedback" role="status">
      {created.length > 0 ? (
        <p className="import-feedback__item is-success">成功导入 {created.length} 个素材</p>
      ) : null}
      {hydrated.length > 0 ? (
        <div className="import-feedback__item is-hydrated">
          <p>已恢复预览 {hydrated.length} 个素材：</p>
          <ul>
            {hydrated.map((item) => (
              <li key={item.assetId}>
                {item.fileName}（{ASSET_KIND_LABELS[item.kind]}）
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {duplicates.length > 0 ? (
        <div className="import-feedback__item is-duplicate">
          <p>已存在，跳过 {duplicates.length} 个重复文件：</p>
          <ul>
            {duplicates.map((item) => (
              <li key={`${item.fileName}(${item.fileSize})`}>
                {item.fileName}（{ASSET_KIND_LABELS[item.kind]}）
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {unknown.length > 0 ? (
        <div className="import-feedback__item is-unknown">
          <p>无法导入 {unknown.length} 个文件：</p>
          <ul>
            {unknown.map((item) => (
              <li key={item.fileName}>{item.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {oversize.length > 0 ? (
        <div className="import-feedback__item is-oversize">
          <p>
            {`以下 ${oversize.length} 个文件超过 ${formatMb(BLOB_MAX_BYTES)}，未存入本地二进制库：`}
          </p>
          <ul>
            {oversize.map((item) => (
              <li key={`${item.fileName}(${item.fileSize})`}>
                {`${item.fileName}（${ASSET_KIND_LABELS[item.kind]}，${formatMb(item.fileSize)}）`}
              </li>
            ))}
          </ul>
          <p>刷新后预览不保留：可重新导入同名文件恢复预览，或删除该素材（评审记录仍保留）。</p>
        </div>
      ) : null}
      {error !== null ? <p className="import-feedback__item is-error">{error}</p> : null}
      {onClear !== undefined ? (
        <button type="button" className="import-feedback__dismiss" onClick={onClear}>
          知道了
        </button>
      ) : null}
    </div>
  )
}

export default function ImportZone({
  importing,
  importingLarge = false,
  feedback,
  onImportFiles,
  onClearFeedback,
}: ImportZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragEnterOrOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault() // 必须阻止默认行为，浏览器才允许 drop
    if (!importing) setDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    // 仅当指针真正离开整个拖拽区时取消高亮（移过子元素会触发子级 dragleave）
    const related = event.relatedTarget
    if (related instanceof Node && event.currentTarget.contains(related)) return
    setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(false)
    if (importing) return
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length === 0) return
    void onImportFiles(files, '拖拽导入')
  }

  const handleSelect = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.currentTarget.files ?? [])
    // 重置 value，保证再次选择同一文件也能触发 onChange（重复导入提示依赖这一点）
    event.currentTarget.value = ''
    if (importing || files.length === 0) return
    void onImportFiles(files, '文件选择导入')
  }

  return (
    <section className="import-zone" aria-label="素材导入区">
      <div
        className={dragging ? 'import-zone__drop is-active' : 'import-zone__drop'}
        onDragEnter={handleDragEnterOrOver}
        onDragOver={handleDragEnterOrOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="import-zone__hint">将图片 / DICOM / 3D 模型文件拖到此处</p>
        <p className="import-zone__sub">{SUPPORTED_TYPES_HINT}</p>
        <button
          type="button"
          className="import-zone__button"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          选择文件
        </button>
        <input
          ref={inputRef}
          className="import-zone__input"
          type="file"
          multiple
          accept={IMPORT_ACCEPT}
          onChange={handleSelect}
        />
        {importing ? (
          <p className="import-zone__status" role="status">
            {importingLarge ? '导入中：正在后台处理大文件…' : '导入中…'}
          </p>
        ) : null}
      </div>
      {feedback !== null ? (
        <ImportFeedbackPanel feedback={feedback} onClear={onClearFeedback} />
      ) : null}
    </section>
  )
}
