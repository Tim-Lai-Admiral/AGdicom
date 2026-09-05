/**
 * useModelLoader 状态机单测（CR-001 T-006）。
 *
 * 覆盖：loadModelBytes 分块进度 / 无 body 降级；parseStlGeometry 成功与三类损坏输入
 * （空文件 / 无效 ASCII / 声明面数越界）；hook 的 idle / loading / success / error /
 * 重试 / 大文件标记 / 卸载 dispose。
 * WebGL 渲染不在 jsdom 可测范围（见 Model3DViewer.test.tsx 的降级路径与手动验证）。
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEmptyStl, buildInvalidAsciiStl, buildStlFile } from './__fixtures__/buildStlFile.ts'
import { loadModelBytes, parseStlGeometry, StlParseError, useModelLoader } from './useModelLoader.ts'

/** 可分块读取的 fetch 响应桩（body 为真实 ReadableStream，带 Content-Length） */
function streamResponse(chunks: readonly Uint8Array[], total: number): unknown {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(total) : null) },
    body: stream,
    arrayBuffer: async () => {
      throw new Error('arrayBuffer should not be called when body is a stream')
    },
  }
}

/** 一次性返回完整内容的 fetch 响应桩（body 为 null，走 arrayBuffer 降级分支） */
function simpleResponse(bytes: Uint8Array): unknown {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    body: null,
    arrayBuffer: async () => bytes.slice().buffer,
  }
}

describe('loadModelBytes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reads a chunked stream, reports byte progress and concatenates the chunks', async () => {
    const fixture = new Uint8Array(buildStlFile())
    const calls: Array<{ loaded: number; total: number }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([fixture.slice(0, 100), fixture.slice(100)], fixture.byteLength),
      ),
    )
    const buffer = await loadModelBytes('blob:stl', (p) => calls.push({ ...p }))
    expect(new Uint8Array(buffer)).toEqual(fixture)
    expect(calls).toEqual([
      { loaded: 100, total: fixture.byteLength },
      { loaded: fixture.byteLength, total: fixture.byteLength },
    ])
  })

  it('falls back to arrayBuffer and reports full progress when the body is null', async () => {
    const fixture = new Uint8Array(buildStlFile())
    const calls: Array<{ loaded: number; total: number }> = []
    vi.stubGlobal('fetch', vi.fn(async () => simpleResponse(fixture)))
    const buffer = await loadModelBytes('blob:stl', (p) => calls.push({ ...p }))
    expect(buffer.byteLength).toBe(fixture.byteLength)
    expect(calls).toEqual([{ loaded: fixture.byteLength, total: fixture.byteLength }])
  })

  it('throws a readable error for a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, headers: { get: () => null }, body: null })),
    )
    await expect(loadModelBytes('missing:url')).rejects.toThrow('读取文件内容失败（HTTP 404）')
  })
})

describe('parseStlGeometry', () => {
  it('parses the tetrahedron fixture into a geometry with 4 triangles', () => {
    const geometry = parseStlGeometry(buildStlFile())
    try {
      const position = geometry.getAttribute('position')
      expect(position).not.toBeUndefined()
      expect(position?.count).toBe(12) // 4 面 × 3 顶点
      expect(geometry.getAttribute('normal')).not.toBeUndefined()
      geometry.computeBoundingSphere()
      expect(geometry.boundingSphere?.radius).toBeGreaterThan(0)
      expect(Number.isFinite(geometry.boundingSphere?.radius ?? NaN)).toBe(true)
    } finally {
      geometry.dispose()
    }
  })

  it('rejects an empty file with a parse error', () => {
    expect(() => parseStlGeometry(buildEmptyStl())).toThrow(StlParseError)
  })

  it('rejects an ascii file without facets (no valid triangles)', () => {
    try {
      parseStlGeometry(buildInvalidAsciiStl())
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(StlParseError)
      expect((error as Error).message).toContain('未找到有效的三角面数据')
    }
  })

  it('rejects a binary file whose declared face count exceeds the payload', () => {
    expect(() => parseStlGeometry(buildStlFile({ inflateFaceCount: true }))).toThrow(
      /无法解析该 STL 文件/,
    )
  })
})

describe('useModelLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('stays idle and never fetches when there is no objectUrl (refreshed session)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useModelLoader({ objectUrl: undefined, fileSize: 284 }))
    expect(result.current.status).toBe('idle')
    expect(result.current.geometry).toBeNull()
    expect(result.current.error).toBeNull()
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads and parses a valid STL into the success state with final progress', async () => {
    const fixture = new Uint8Array(buildStlFile())
    vi.stubGlobal('fetch', vi.fn(async () => simpleResponse(fixture)))
    const { result } = renderHook(() =>
      useModelLoader({ objectUrl: 'blob:model-1', fileSize: fixture.byteLength }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('success')
    })
    expect(result.current.geometry?.getAttribute('position')?.count).toBe(12)
    expect(result.current.error).toBeNull()
    expect(result.current.progress).toEqual({ loaded: fixture.byteLength, total: fixture.byteLength })
    expect(result.current.large).toBe(false)
  })

  it('surfaces a readable error for a corrupt STL and keeps geometry null', async () => {
    const corrupt = new Uint8Array(buildStlFile({ inflateFaceCount: true }))
    vi.stubGlobal('fetch', vi.fn(async () => simpleResponse(corrupt)))
    const { result } = renderHook(() =>
      useModelLoader({ objectUrl: 'blob:model-bad', fileSize: corrupt.byteLength }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.error).toContain('无法解析该 STL 文件')
    expect(result.current.geometry).toBeNull()
  })

  it('retries the same source and reaches success after the file is fixed', async () => {
    const fixture = new Uint8Array(buildStlFile())
    const fetchMock = vi.fn<() => Promise<unknown>>(async () => {
      throw new Error('network gone')
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() =>
      useModelLoader({ objectUrl: 'blob:model-retry', fileSize: fixture.byteLength }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.error).toContain('network gone')
    fetchMock.mockImplementation(async () => simpleResponse(fixture))
    act(() => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('success')
    })
    expect(result.current.geometry?.getAttribute('position')?.count).toBe(12)
  })

  it('flags large files at the 10MB import threshold', async () => {
    const fixture = new Uint8Array(buildStlFile())
    vi.stubGlobal('fetch', vi.fn(async () => simpleResponse(fixture)))
    const largeBytes = 10 * 1024 * 1024
    const { result } = renderHook(() =>
      useModelLoader({ objectUrl: 'blob:model-large', fileSize: largeBytes }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('success')
    })
    expect(result.current.large).toBe(true)
  })

  it('disposes the parsed geometry on unmount', async () => {
    const fixture = new Uint8Array(buildStlFile())
    vi.stubGlobal('fetch', vi.fn(async () => simpleResponse(fixture)))
    const { result, unmount } = renderHook(() =>
      useModelLoader({ objectUrl: 'blob:model-dispose', fileSize: fixture.byteLength }),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('success')
    })
    const geometry = result.current.geometry
    if (geometry === null) throw new Error('geometry should be set in the success state')
    const disposeSpy = vi.spyOn(geometry, 'dispose')
    unmount()
    expect(disposeSpy).toHaveBeenCalledTimes(1)
  })
})
