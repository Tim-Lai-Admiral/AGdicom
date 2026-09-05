import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset, DicomMeta } from '../../../domain/types.ts'
import DicomViewer from './DicomViewer.tsx'
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
})
