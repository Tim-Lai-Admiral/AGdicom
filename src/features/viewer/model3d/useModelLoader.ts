/**
 * STL 模型加载 Hook（CR-001 T-006 / R-004）。
 *
 * 职责：素材会话 objectUrl（blob:）→ fetch 分块读取（进度回调）→ STLLoader.parse 解析
 * 为 BufferGeometry → loading/success/error 状态机；大文件（≥10MB，与 T-003 导入管线
 * 同一阈值）提供 large 标记供 UI 提示；retry() 重发同一来源的加载（修复后重试验收）。
 *
 * 内存释放：本 hook 持有 geometry 的释放责任——成功替换上一份几何体、卸载、以及
 * 取消后已解析的几何体都会 dispose；渲染层（Model3DViewer）只使用不重复持有。
 *
 * 素材注册（fetch 样本 → File → useImport/classifyImportFiles）由 App 层完成，
 * 本 hook 只负责“打开素材后的加载”。
 *
 * 已知限制：fetch 响应无 Content-Length 时进度无法计算百分比，UI 以已读字节近似展示
 * （blob: URL 在主流浏览器实测带长度）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BufferGeometry } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { LARGE_FILE_THRESHOLD } from '../../library/useImport.ts'

/** 加载状态机：idle（无可用来源）/ loading / success / error */
export type ModelLoadStatus = 'idle' | 'loading' | 'success' | 'error'

/** STL 解析失败（损坏 / 空内容 / 无有效三角面），message 可直接展示 */
export class StlParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StlParseError'
  }
}

/** 加载进度（字节）；total 为 0 表示长度未知 */
export interface ModelLoadProgress {
  loaded: number
  total: number
}

export interface UseModelLoaderParams {
  /** 素材会话 objectUrl（blob:）；undefined 表示刷新后无文件内容可读（UI 提示重新导入） */
  objectUrl: string | undefined
  /** 源文件大小（字节），用于大文件提示 */
  fileSize: number
}

export interface ModelLoadResult {
  status: ModelLoadStatus
  /** 字节级进度；status 为 loading 时非 null */
  progress: ModelLoadProgress | null
  /** 解析成功后的几何体（success 时非 null；由本 hook 负责释放） */
  geometry: BufferGeometry | null
  /** 可读中文错误信息（error 时非 null） */
  error: string | null
  /** 源文件 ≥10MB（LARGE_FILE_THRESHOLD），UI 可显示“文件较大”提示 */
  large: boolean
  /** 重新发起同一来源的加载（错误态的重试入口） */
  retry: () => void
}

/** 进度回调：loaded 已读字节；total 总字节（未知时与 loaded 相同） */
export type LoadProgressCallback = (progress: ModelLoadProgress) => void

/**
 * 分块读取 URL 内容并回报进度。
 * 与 DICOM 查看器的 loadDicomAssetBytes 同构，但支持 ReadableStream 分块进度：
 * 大 STL（如 14MB）加载期间可向用户展示读取进度。
 */
export async function loadModelBytes(
  url: string,
  onProgress?: LoadProgressCallback,
): Promise<ArrayBuffer> {
  if (typeof fetch !== 'function') {
    throw new Error('当前环境不支持读取文件内容（fetch 不可用）')
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error(`读取文件内容失败（HTTP ${response.status}）`)
  const body = response.body
  if (body === null) {
    const buffer = await response.arrayBuffer()
    onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength })
    return buffer
  }
  const total = Number(response.headers.get('Content-Length') ?? '') || 0
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    chunks.push(value)
    loaded += value.byteLength
    // total 未知时以 loaded 兜底，调用方可据 total===loaded 降级为“已读取 N 字节”展示
    onProgress?.({ loaded, total: total > 0 ? total : loaded })
  }
  const merged = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

/**
 * 将 STL 字节解析为 BufferGeometry。
 * - 空 / 截断 / 声明面数异常等让 STLLoader.parse 抛错的情况 → StlParseError；
 * - “合法但无三角面”的输入（如无 facet 的 ASCII 文件）同样报错；
 * - 顶点含 NaN/Infinity（损坏文件可能产生）时拒绝渲染（避免包围盒与深度异常）。
 */
export function parseStlGeometry(data: ArrayBuffer): BufferGeometry {
  if (data.byteLength === 0) {
    throw new StlParseError('无法解析该 STL 文件：文件内容为空')
  }
  let geometry: BufferGeometry
  try {
    geometry = new STLLoader().parse(data)
  } catch (error) {
    const reason = error instanceof Error && error.message !== '' ? error.message : String(error)
    throw new StlParseError(`无法解析该 STL 文件（${reason}）`)
  }
  const position = geometry.getAttribute('position')
  if (position === undefined || position.count === 0) {
    throw new StlParseError('无法解析该 STL 文件：未找到有效的三角面数据')
  }
  const values = position.array
  for (let i = 0; i < values.length; i += 1) {
    if (!Number.isFinite(values[i])) {
      throw new StlParseError('无法解析该 STL 文件：顶点坐标包含无效数值')
    }
  }
  return geometry
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return `加载失败（${String(error)}）`
}

export function useModelLoader({ objectUrl, fileSize }: UseModelLoaderParams): ModelLoadResult {
  const [status, setStatus] = useState<ModelLoadStatus>('idle')
  const [progress, setProgress] = useState<ModelLoadProgress | null>(null)
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  /** hook 持有的当前几何体：替换 / 卸载时 dispose（state 不可作为释放依据） */
  const geometryRef = useRef<BufferGeometry | null>(null)

  useEffect(() => {
    if (objectUrl === undefined) {
      setStatus('idle')
      setProgress(null)
      setGeometry(null)
      setError(null)
      return
    }
    let cancelled = false
    setStatus('loading')
    setProgress({ loaded: 0, total: 0 })
    setError(null)
    void (async () => {
      try {
        const buffer = await loadModelBytes(objectUrl, (p) => {
          if (!cancelled) setProgress(p)
        })
        if (cancelled) return
        const parsed = parseStlGeometry(buffer)
        if (cancelled) {
          parsed.dispose()
          return
        }
        geometryRef.current?.dispose() // 释放上一份几何体（重试成功 / 换源场景）
        geometryRef.current = parsed
        setGeometry(parsed)
        setStatus('success')
        setProgress({ loaded: buffer.byteLength, total: buffer.byteLength })
      } catch (loadError) {
        if (cancelled) return
        setError(toErrorMessage(loadError))
        setStatus('error')
        setProgress(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [objectUrl, retryToken])

  // 卸载时释放 hook 持有的几何体（关闭查看器 / 切换素材）
  useEffect(
    () => () => {
      geometryRef.current?.dispose()
      geometryRef.current = null
    },
    [],
  )

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  return {
    status,
    progress,
    geometry,
    error,
    large: fileSize >= LARGE_FILE_THRESHOLD,
    retry,
  }
}
