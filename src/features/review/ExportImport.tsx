/**
 * 评审数据导出 / 导入（CR-001 T-007 / R-005）。
 *
 * - 导出：当前 AppState → schema v1 JSON（store/io.serializeExport，自动剥离会话
 *   字段 objectUrl），以 review-export-YYYYMMDD-HHmmss.json（本地时间）触发下载；
 * - 导入：读取用户选择的 JSON → parseImportFile 深度校验（非 JSON / 版本不符 /
 *   结构非法时拒绝，展示中文原因，不改动现有数据）→ 与现有素材做名称冲突检测
 *   （findNameConflicts），有冲突时先提示并要求确认；确认后由上层整体替换状态
 *   并持久化（导入为“备份还原”语义：以备份内容替换当前全部数据）。
 */
import { useRef, useState } from 'react'
import type { AppState } from '../../domain/types.ts'
import {
  findNameConflicts,
  ImportFormatError,
  parseImportFile,
  serializeExport,
} from '../../store/io.ts'

/** 生成导出文件名：review-export-YYYYMMDD-HHmmss.json（本地时间） */
export function makeExportFileName(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `review-export-${date}-${time}.json`
}

export interface ExportImportProps {
  /** 当前应用状态（导出来源；导入冲突检测的比较基准） */
  state: AppState
  /** 用户确认导入后以备份数据整体替换应用状态（持久化由上层完成） */
  onImport: (state: AppState) => void
}

/** 待确认的导入：已校验的数据 + 与现有素材的名称冲突列表 */
interface PendingImport {
  state: AppState
  conflicts: readonly string[]
}

function readErrorReason(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : String(error)
}

export default function ExportImport({ state, onImport }: ExportImportProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleExport = (): void => {
    setError(null)
    setMessage(null)
    try {
      const content = serializeExport(state)
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = makeExportFileName(new Date())
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setMessage(
        `已导出评审数据（${Object.keys(state.assets).length} 个素材）：${anchor.download}`,
      )
    } catch (exportError) {
      setError(
        `导出失败：无法生成或下载文件（${readErrorReason(exportError)}）。可尝试更换浏览器或检查下载权限。`,
      )
    }
  }

  const resetFileInput = (): void => {
    if (inputRef.current !== null) inputRef.current.value = ''
  }

  const applyImport = (incoming: AppState): void => {
    onImport(incoming)
    setPending(null)
    setError(null)
    setMessage(`已导入并还原 ${Object.keys(incoming.assets).length} 个素材与全部评审记录`)
    resetFileInput()
  }

  const handleFileSelected = (file: File | undefined): void => {
    setError(null)
    setMessage(null)
    if (file === undefined) return
    void (async () => {
      let text: string
      try {
        text = await file.text()
      } catch (readError) {
        setError(`导入失败：无法读取文件内容（${readErrorReason(readError)}）`)
        return
      }
      let incoming: AppState
      try {
        incoming = parseImportFile(text)
      } catch (parseError) {
        setError(
          parseError instanceof ImportFormatError
            ? parseError.message
            : `导入失败：${readErrorReason(parseError)}`,
        )
        resetFileInput()
        return
      }
      const conflicts = findNameConflicts(state, incoming)
      if (conflicts.length > 0) {
        setPending({ state: incoming, conflicts })
        return
      }
      applyImport(incoming)
    })()
  }

  return (
    <section className="export-import" aria-label="导出与导入">
      <h2 className="export-import__title">导出 / 导入</h2>
      <p className="export-import__hint">
        导出 JSON 备份全部素材与评审记录（含时间戳与 schema 版本，可追溯）；导入将从备份还原数据。
      </p>
      <div className="export-import__actions">
        <button type="button" className="export-import__export" onClick={handleExport}>
          导出 JSON
        </button>
        <button
          type="button"
          className="export-import__import"
          onClick={() => inputRef.current?.click()}
        >
          导入 JSON
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="export-import__input"
          aria-label="选择备份 JSON 文件"
          onChange={(event) => handleFileSelected(event.target.files?.[0])}
        />
      </div>
      {message !== null ? (
        <p className="export-import__message" role="status">
          {message}
        </p>
      ) : null}
      {error !== null ? (
        <p className="export-import__error" role="alert">
          {error}
        </p>
      ) : null}
      {pending !== null ? (
        <div className="export-import__confirm">
          <p className="export-import__confirm-title" role="alert">
            {`以下 ${pending.conflicts.length} 个名称与现有素材冲突：${pending.conflicts.join('、')}`}
          </p>
          <p className="export-import__confirm-hint">
            仍然导入将用备份内容替换当前全部数据；取消则不做任何变更。
          </p>
          <div className="export-import__confirm-actions">
            <button
              type="button"
              className="export-import__confirm-yes"
              onClick={() => applyImport(pending.state)}
            >
              仍然导入
            </button>
            <button
              type="button"
              className="export-import__confirm-no"
              onClick={() => {
                setPending(null)
                resetFileInput()
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
