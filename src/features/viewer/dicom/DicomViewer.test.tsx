import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, DicomMeta } from '../../../domain/types.ts'
import DicomViewer from './DicomViewer.tsx'
import { AUTO_WINDOW_LEVEL } from './windowLevel.ts'
import {
  buildDicomFile,
  buildDicomSeriesBuffers,
  gradientPixels8,
  JPEG_BASELINE_TRANSFER_SYNTAX_UID,
} from './__fixtures__/buildDicomFile.ts'

function makeDicomAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'd1',
    name: 'phantom-001.dcm',
    kind: 'dicom',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'phantom-001.dcm', fileSize: 512, fileType: 'application/dicom' },
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
    ...overrides,
  }
}

/** objectUrl → 文件字节（未注册的 URL 抛错，便于发现测试漏洞） */
function stubFetchFor(files: Record<string, Uint8Array>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    const bytes = files[url]
    if (bytes === undefined) throw new Error(`测试未注册该 objectUrl 的 fixture：${url}`)
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.slice().buffer,
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** jsdom 无 2D Canvas：拦截 getContext，记录 putImageData 调用以断言真实绘制路径 */
function stubCanvasContext(): { putImageData: ReturnType<typeof vi.fn> } {
  const putImageData = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    putImageData,
  } as unknown as CanvasRenderingContext2D)
  return { putImageData }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
})

/** 3 切片同 series（InstanceNumber 1..3），去标识化、可解码灰度像素 */
function buildThreeSliceSeries() {
  const buffers = buildDicomSeriesBuffers(3, {
    patientName: '',
    patientID: '',
    patientIdentityRemoved: 'YES',
    deidentificationMethod: 'Synthetic phantom; identity removed',
    pixelData: gradientPixels8(8, 8, 30, 200),
  })
  return {
    files: {
      'blob:1': new Uint8Array(buffers[0]),
      'blob:2': new Uint8Array(buffers[1]),
      'blob:3': new Uint8Array(buffers[2]),
    },
    // 故意乱序传入：切片选择器应按 InstanceNumber 排序（#1、#2、#3）
    assets: [
      makeDicomAsset({
        id: 'd3',
        name: 'phantom-003.dcm',
        file: { fileName: 'phantom-003.dcm', fileSize: 512, fileType: 'application/dicom' },
        objectUrl: 'blob:3',
      }),
      makeDicomAsset({ objectUrl: 'blob:1' }),
      makeDicomAsset({
        id: 'd2',
        name: 'phantom-002.dcm',
        file: { fileName: 'phantom-002.dcm', fileSize: 512, fileType: 'application/dicom' },
        objectUrl: 'blob:2',
      }),
    ],
  }
}

describe('DicomViewer: 元数据与 series 聚合', () => {
  it('parses files, shows the metadata table and the grouped slice count', async () => {
    const { assets, files } = buildThreeSliceSeries()
    const onMetasParsed = vi.fn()
    const onClose = vi.fn()
    stubFetchFor(files)
    stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={onMetasParsed} onClose={onClose} />,
    )

    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    expect(within(dialog).getByText('phantom-003.dcm')).toBeTruthy()

    // 解析完成后：元数据表格（可读中文标签）
    await waitFor(() => {
      expect(within(dialog).getByText('CT')).toBeTruthy()
    })
    expect(within(dialog).getByText('Explicit VR Little Endian（无压缩）')).toBeTruthy()
    expect(within(dialog).getByText('8 × 8')).toBeTruthy()
    expect(within(dialog).getByText('0.5 × 0.5 mm')).toBeTruthy()

    // 去标识化：标记 + 结构化依据 + 患者字段“已置空”
    expect(within(dialog).getAllByText('已置空')).toHaveLength(2)
    expect(within(dialog).getByText('是', { selector: '.dicom-viewer__deid-yes' })).toBeTruthy()
    expect(
      within(dialog).getByText('PatientIdentityRemoved（0012,0062）标记为 YES'),
    ).toBeTruthy()
    expect(
      within(dialog).getByText(/包含 DeidentificationMethod（0012,0063）字段/),
    ).toBeTruthy()
    expect(within(dialog).getByText(/患者字段（姓名 \/ ID）均为空/)).toBeTruthy()
    expect(
      within(dialog).getByText(/Synthetic phantom; identity removed/),
    ).toBeTruthy()

    // series 聚合：按 SeriesInstanceUID 分组统计切片数
    expect(within(dialog).getByText('3 张（本序列）')).toBeTruthy()

    // 切片选择器：按 InstanceNumber 升序排列选项
    const sliceSelect = within(dialog).getByLabelText('选择切片') as HTMLSelectElement
    const optionTexts = Array.from(sliceSelect.options).map((option) => option.text)
    expect(optionTexts).toEqual([
      '#1 phantom-001.dcm',
      '#2 phantom-002.dcm',
      '#3 phantom-003.dcm',
    ])
    expect(sliceSelect.value).toBe('d3')
    expect(within(dialog).getByText('切片 3 / 3（按 InstanceNumber 排序）')).toBeTruthy()
  })

  it('writes parsed metadata (with aggregated slice counts) back via onMetasParsed', async () => {
    const { assets, files } = buildThreeSliceSeries()
    const onMetasParsed = vi.fn()
    stubFetchFor(files)
    stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={onMetasParsed} onClose={vi.fn()} />,
    )
    await waitFor(() => {
      expect(onMetasParsed).toHaveBeenCalledTimes(1)
    })
    const metas = onMetasParsed.mock.calls[0][0] as Record<string, DicomMeta>
    expect(Object.keys(metas).sort()).toEqual(['d1', 'd2', 'd3'])
    for (const meta of Object.values(metas)) {
      expect(meta.sliceCount).toBe(3)
      expect(meta.deidentified).toBe(true)
      expect(meta.seriesInstanceUID).toBeDefined()
      expect(meta.modality).toBe('CT')
    }
  })
})

describe('DicomViewer: 切片切换与预览', () => {
  it('switches slices by InstanceNumber and draws the decoded frame to the canvas', async () => {
    const { assets, files } = buildThreeSliceSeries()
    stubFetchFor(files)
    const { putImageData } = stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('切片 3 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
    // 打开的切片（#3）已被解码并绘制
    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled()
    })

    // 切换到 #1：表格切片序号与预览绘制同步更新
    fireEvent.change(screen.getByLabelText('选择切片'), { target: { value: 'd1' } })
    await waitFor(() => {
      expect(screen.getByText('切片 1 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
    expect(screen.getByText('#1')).toBeTruthy()
    const calls = putImageData.mock.calls as unknown as Array<[ImageData]>
    const lastImage = calls[calls.length - 1][0]
    expect(lastImage.width).toBe(8)
    expect(lastImage.height).toBe(8)
    // min-max 归一化：最小值 → 0（黑），最大值 → 255（白），非全黑全白
    expect(lastImage.data[0]).toBe(0)
    expect(lastImage.data[63 * 4]).toBe(255)
  })

  it('supports stepping through slices with prev/next buttons', async () => {
    const { assets, files } = buildThreeSliceSeries()
    stubFetchFor(files)
    stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('切片 3 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
    const prev = screen.getByRole('button', { name: '上一张切片' }) as HTMLButtonElement
    const next = screen.getByRole('button', { name: '下一张切片' }) as HTMLButtonElement
    expect(next.disabled).toBe(true) // 已在最后一张

    fireEvent.click(prev)
    await waitFor(() => {
      expect(screen.getByText('切片 2 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '上一张切片' }))
    await waitFor(() => {
      expect(screen.getByText('切片 1 / 3（按 InstanceNumber 排序）')).toBeTruthy()
    })
    expect((screen.getByRole('button', { name: '上一张切片' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('DicomViewer: 降级路径（不崩溃）', () => {
  it('shows metadata-only fallback for a compressed transfer syntax', async () => {
    const compressed = buildDicomFile({
      transferSyntax: JPEG_BASELINE_TRANSFER_SYNTAX_UID,
      patientName: '',
      patientID: '',
      patientIdentityRemoved: 'YES',
    })
    const assets = [
      makeDicomAsset({ id: 'j1', name: 'jpeg.dcm', file: { fileName: 'jpeg.dcm', fileSize: 512, fileType: '' }, objectUrl: 'blob:j1' }),
    ]
    stubFetchFor({ 'blob:j1': new Uint8Array(compressed) })
    const { putImageData } = stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    // 元数据仍完整展示（压缩只影响像素预览）
    await waitFor(() => {
      expect(screen.getByText('JPEG 压缩（仅元数据）')).toBeTruthy()
    })
    expect(screen.getByText('CT')).toBeTruthy()
    // 预览区显示降级文案，不崩溃
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('仅元数据')
    })
    expect(putImageData).not.toHaveBeenCalled()
  })

  it('labels JPEG 2000 transfer syntaxes precisely instead of generic JPEG text', async () => {
    // T-005 Minor ②：1.2.840.10008.1.2.4 家族需区分 JPEG 与 JPEG 2000（.90 无损 / .91）
    const jpeg2000 = buildDicomFile({
      transferSyntax: '1.2.840.10008.1.2.4.90',
      patientName: '',
      patientID: '',
      patientIdentityRemoved: 'YES',
    })
    const assets = [
      makeDicomAsset({
        id: 'j2',
        name: 'j2k.dcm',
        file: { fileName: 'j2k.dcm', fileSize: 512, fileType: '' },
        objectUrl: 'blob:j2',
      }),
    ]
    stubFetchFor({ 'blob:j2': new Uint8Array(jpeg2000) })
    stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('JPEG 2000 无损压缩（仅元数据）')).toBeTruthy()
    })
  })

  it('shows a readable error for a corrupt file without crashing', async () => {
    const good = buildDicomFile({ instanceNumber: '1' })
    const assets = [
      makeDicomAsset({ objectUrl: 'blob:bad' }),
      makeDicomAsset({
        id: 'd2',
        name: 'phantom-002.dcm',
        file: { fileName: 'phantom-002.dcm', fileSize: 512, fileType: '' },
        objectUrl: 'blob:good',
      }),
    ]
    stubFetchFor({ 'blob:bad': new Uint8Array(64).fill(0x41), 'blob:good': new Uint8Array(good) })
    stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getAllByText(/无法解析该 DICOM 文件/).length).toBeGreaterThan(0)
    })
    // 汇总提示 + 关闭按钮仍可用（未崩溃）
    expect(screen.getByText('1 个文件无法解析，已按可用内容降级展示')).toBeTruthy()
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy()
  })

  it('falls back to persisted metadata after refresh (no objectUrl) with preview unavailable', () => {
    const persistedMeta: DicomMeta = {
      modality: 'CT',
      sopClass: '1.2.840.10008.5.1.4.1.1.2',
      transferSyntax: '1.2.840.10008.1.2.1',
      rows: 8,
      columns: 8,
      pixelSpacing: [0.5, 0.5],
      seriesInstanceUID: '1.2.826.0.1.3680043.8.498.1000.2',
      patientName: undefined,
      patientID: undefined,
      instanceNumber: 1,
      sliceCount: 1,
      deidentified: true,
      deidentificationMethod: 'Synthetic phantom; identity removed',
      deidentifiedEvidence: ['patient-identity-removed', 'empty-patient-fields'],
    }
    const assets = [makeDicomAsset({ dicomMeta: persistedMeta })] // 无 objectUrl（刷新后）
    const fetchMock = vi.fn()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    // 持久化元数据仍展示
    expect(screen.getByText('CT')).toBeTruthy()
    expect(screen.getAllByText('已置空')).toHaveLength(2)
    expect(screen.getByText('1 张（本序列）')).toBeTruthy()
    // 预览不可用：明确提示需重新导入（与 TD-001 objectUrl 会话字段限制一致）
    expect(screen.getByRole('alert').textContent).toBe(
      '切片预览不可用：刷新后需重新导入该 DICOM 文件',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an explicit unavailable state when neither bytes nor metadata exist', () => {
    const assets = [makeDicomAsset()] // 无 objectUrl、无持久化元数据
    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByText('元数据与切片预览不可用：刷新后需重新导入该 DICOM 文件')).toBeTruthy()
  })
})

describe('DicomViewer: W/L 与测量（CR-003 T-003）', () => {
  it('re-decodes with explicit WC/WW when windowLevel is manual', async () => {
    const assets = [makeDicomAsset({ objectUrl: 'blob:wl' })]
    stubFetchFor({
      'blob:wl': new Uint8Array(
        buildDicomFile({ pixelData: gradientPixels8(4, 4, 0, 255), rows: 4, columns: 4 }),
      ),
    })
    const { putImageData } = stubCanvasContext()

    render(
      <DicomViewer
        asset={assets[0]}
        dicomAssets={assets}
        onMetasParsed={vi.fn()}
        onClose={vi.fn()}
        windowLevel={{ auto: false, wc: 136, ww: 1 }}
      />,
    )
    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled()
    })
    const calls = putImageData.mock.calls as unknown as Array<[ImageData]>
    const image = calls[calls.length - 1][0]
    // ww=1 阈值窗（下界 135.5）：x=119 → 0；x=136 → 255（4×4 渐变步进 17）
    expect(image.data[7 * 4]).toBe(0)
    expect(image.data[8 * 4]).toBe(255)
  })

  it('keeps the auto min-max behavior by default (windowLevel omitted)', async () => {
    const assets = [makeDicomAsset({ objectUrl: 'blob:wl' })]
    stubFetchFor({
      'blob:wl': new Uint8Array(
        buildDicomFile({ pixelData: gradientPixels8(4, 4, 0, 255), rows: 4, columns: 4 }),
      ),
    })
    const { putImageData } = stubCanvasContext()

    render(
      <DicomViewer
        asset={assets[0]}
        dicomAssets={assets}
        onMetasParsed={vi.fn()}
        onClose={vi.fn()}
        windowLevel={AUTO_WINDOW_LEVEL}
      />,
    )
    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled()
    })
    const calls = putImageData.mock.calls as unknown as Array<[ImageData]>
    const image = calls[calls.length - 1][0]
    expect(image.data[0]).toBe(0)
    expect(image.data[15 * 4]).toBe(255)
  })

  /** 等待预览渲染完成并返回画布元素（测量交互前置条件） */
  async function waitForRenderedCanvas() {
    const canvas = (await waitFor(() => {
      const element = screen.getByLabelText('所选切片的灰度预览') as HTMLCanvasElement
      expect(element.className).not.toContain('is-hidden')
      return element
    })) as HTMLCanvasElement
    return canvas
  }

  function stubCanvasRect(width = 100, height = 100): void {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  }

  it('draws a measurement with a deterministic mm label when PixelSpacing exists', async () => {
    const { assets, files } = buildThreeSliceSeries() // fixture 默认 PixelSpacing 0.5\0.5
    stubFetchFor(files)
    stubCanvasContext()
    stubCanvasRect()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    const canvas = await waitForRenderedCanvas()

    // 启用测量工具 → 拖拽 (0,0)→(3,4) 图像像素 → 2.5 mm（确定性）
    fireEvent.click(screen.getByRole('button', { name: '测量（模拟）' }))
    expect(screen.getByText('模拟测量，非临床：距离标注仅供界面演示')).toBeTruthy()
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(canvas, { clientX: 37.5, clientY: 50 })
    fireEvent.pointerUp(canvas, { clientX: 37.5, clientY: 50 })

    await waitFor(() => {
      expect(screen.getByText('2.5 mm')).toBeTruthy()
    })
  })

  it('labels the mock path explicitly when PixelSpacing is unavailable', async () => {
    const buffers = buildDicomSeriesBuffers(1, {
      pixelSpacing: null,
      patientName: '',
      patientID: '',
      patientIdentityRemoved: 'YES',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    const assets = [makeDicomAsset({ objectUrl: 'blob:mock' })]
    stubFetchFor({ 'blob:mock': new Uint8Array(buffers[0]) })
    stubCanvasContext()
    stubCanvasRect()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    const canvas = await waitForRenderedCanvas()

    fireEvent.click(screen.getByRole('button', { name: '测量（模拟）' }))
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(canvas, { clientX: 37.5, clientY: 50 })
    fireEvent.pointerUp(canvas, { clientX: 37.5, clientY: 50 })

    // Mock 口径：图像像素距离 5，明示“模拟”
    await waitFor(() => {
      expect(screen.getByText('≈ 5.0 px（模拟）')).toBeTruthy()
    })
  })

  it('supports multiple measurements and the clear button', async () => {
    const { assets, files } = buildThreeSliceSeries()
    stubFetchFor(files)
    stubCanvasContext()
    stubCanvasRect()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    const canvas = await waitForRenderedCanvas()
    fireEvent.click(screen.getByRole('button', { name: '测量（模拟）' }))

    // 第一条：(0,0)→(3,4) → 2.5 mm
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(canvas, { clientX: 37.5, clientY: 50 })
    fireEvent.pointerUp(canvas, { clientX: 37.5, clientY: 50 })
    await waitFor(() => {
      expect(screen.getByText('2.5 mm')).toBeTruthy()
    })

    // 第二条：(8,8)→(4,0)：dx=4, dy=8 → √(4²+8²)×0.5 = √80×0.5 ≈ 4.5 mm
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 0 })
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 0 })
    await waitFor(() => {
      expect(screen.getByText('4.5 mm')).toBeTruthy()
    })
    expect(screen.getByText('2.5 mm')).toBeTruthy() // 第一条仍在（可多条）

    // 清空按钮：全部移除后按钮禁用
    const clear = screen.getByRole('button', { name: '清空测量' }) as HTMLButtonElement
    expect(clear.disabled).toBe(false)
    fireEvent.click(clear)
    await waitFor(() => {
      expect(screen.queryByText('2.5 mm')).toBeNull()
    })
    expect(screen.queryByText('4.5 mm')).toBeNull()
    expect((screen.getByRole('button', { name: '清空测量' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('clears measurements when switching slices', async () => {
    const { assets, files } = buildThreeSliceSeries()
    stubFetchFor(files)
    stubCanvasContext()
    stubCanvasRect()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    const canvas = await waitForRenderedCanvas()
    fireEvent.click(screen.getByRole('button', { name: '测量（模拟）' }))
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(canvas, { clientX: 37.5, clientY: 50 })
    fireEvent.pointerUp(canvas, { clientX: 37.5, clientY: 50 })
    await waitFor(() => {
      expect(screen.getByText('2.5 mm')).toBeTruthy()
    })

    // 切换切片：测量清空（不泄漏到其他切片视图）
    fireEvent.change(screen.getByLabelText('选择切片'), { target: { value: 'd1' } })
    await waitFor(() => {
      expect(screen.queryByText('2.5 mm')).toBeNull()
    })
  })

  it('keeps the measure tool disabled while preview is unavailable (degraded path)', async () => {
    const compressed = buildDicomFile({
      transferSyntax: JPEG_BASELINE_TRANSFER_SYNTAX_UID,
      patientName: '',
      patientID: '',
      patientIdentityRemoved: 'YES',
    })
    const assets = [makeDicomAsset({ id: 'j9', objectUrl: 'blob:j9' })]
    stubFetchFor({ 'blob:j9': new Uint8Array(compressed) })
    const { putImageData } = stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('仅元数据')
    })
    const measureButton = screen.getByRole('button', {
      name: '测量（模拟）',
    }) as HTMLButtonElement
    expect(measureButton.disabled).toBe(true)
    expect(putImageData).not.toHaveBeenCalled()
  })
})

describe('DicomViewer: 弹层交互', () => {
  it('closes via the close button and the Escape key', () => {
    const assets = [makeDicomAsset()]
    const onClose = vi.fn()
    render(<DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('traps Tab focus within the dialog (focus cycle)', async () => {
    // T-005 Minor ③：焦点圈定——Shift+Tab 从首元素循环到末元素，Tab 从末元素循环回首元素
    const { assets, files } = buildThreeSliceSeries()
    stubFetchFor(files)
    stubCanvasContext()

    render(
      <DicomViewer asset={assets[0]} dicomAssets={assets} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    const dialog = await screen.findByRole('dialog', { name: 'DICOM 详情' })
    const closeButton = within(dialog).getByRole('button', { name: '关闭' }) as HTMLButtonElement
    // 打开切片 #3：下一张禁用，可聚焦元素顺序 = [关闭, 上一张, 选择切片]
    // 切片导航在异步解析完成后才渲染，需等待
    const select = (await within(dialog).findByLabelText('选择切片')) as HTMLSelectElement

    // 打开时焦点自动落在关闭按钮（弹层内第一个可聚焦元素）
    expect(document.activeElement).toBe(closeButton)

    // Shift+Tab：从第一个可聚焦元素反向循环到最后一个
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(select)

    // Tab：从最后一个可聚焦元素正向循环回第一个
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)
  })

  it('restores focus to the previously focused trigger after the dialog unmounts', () => {
    // T-005 Minor ③：关闭（卸载）后焦点还原到打开查看器前的触发元素
    const trigger = document.createElement('button')
    trigger.textContent = '打开 DICOM 详情'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = render(
      <DicomViewer asset={makeDicomAsset()} dicomAssets={[makeDicomAsset()]} onMetasParsed={vi.fn()} onClose={vi.fn()} />,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭' }))

    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
