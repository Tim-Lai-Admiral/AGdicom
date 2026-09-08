import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../domain/types.ts'
import CompareView from './CompareView.tsx'
import {
  buildDicomSeriesBuffers,
  JPEG_BASELINE_TRANSFER_SYNTAX_UID,
  gradientPixels8,
} from '../viewer/dicom/__fixtures__/buildDicomFile.ts'
import { buildStlFile } from '../viewer/model3d/__fixtures__/buildStlFile.ts'

function makeImageAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: 'heart.png',
    kind: 'image',
    status: 'pending',
    tags: [],
    note: '',
    source: '拖拽导入',
    file: { fileName: 'heart.png', fileSize: 64, fileType: 'image/png' },
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    ...overrides,
  }
}

function renderCompare(left: Asset, right: Asset) {
  const onExit = vi.fn()
  render(<CompareView left={left} right={right} onExit={onExit} />)
  return { onExit }
}

describe('CompareView', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  it('renders a dialog with both image names and the exit button', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png' }),
      makeImageAsset({ id: 'a2', name: 'lung.png' }),
    )
    const dialog = screen.getByRole('dialog', { name: '图片比较' })
    expect(screen.getByText('heart.png')).toBeTruthy()
    expect(screen.getByText('lung.png')).toBeTruthy()
    expect(screen.getByRole('button', { name: '退出比较' })).toBeTruthy()
    expect(dialog.querySelectorAll('.compare-pane__viewport')).toHaveLength(2)
  })

  it('renders both images side by side in equal panes when objectUrl exists', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    expect(screen.getByRole('img', { name: /heart\.png/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /lung\.png/ })).toBeTruthy()
  })

  it('exits via the exit button and via the Escape key', () => {
    const { onExit } = renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '退出比较' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(2)
    // 非 Esc 按键不触发退出
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('shows a load-failure placeholder without breaking the other pane', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:broken' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const images = screen.getAllByRole('img')
    fireEvent.error(images[0] as HTMLImageElement)
    expect(screen.getByText('图片加载失败')).toBeTruthy()
    expect(screen.getByRole('img', { name: /lung\.png/ })).toBeTruthy()
  })
})

describe('CompareView: 窗格独立变换（CR-009 T-003 / R-024）', () => {
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
  })

  function paneEls(): HTMLElement[] {
    const panes = Array.from(document.querySelectorAll('.compare-pane')) as HTMLElement[]
    if (panes.length !== 2) throw new Error('应渲染两个比较窗格')
    return panes
  }

  it('transforms each pane independently via its own controls', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const panes = paneEls()
    // 两侧窗格各有独立的视口控件（放大/缩小/旋转/重置）
    for (const pane of panes) {
      for (const label of ['放大', '缩小', '旋转 90 度', '重置视图']) {
        expect(within(pane).getByRole('button', { name: label })).toBeTruthy()
      }
    }
    // 左侧放大：仅左侧舞台变换，右侧保持恒等
    fireEvent.click(within(panes[0]).getByRole('button', { name: '放大' }))
    const leftStage = panes[0].querySelector('.image-viewport__stage') as HTMLElement
    const rightStage = panes[1].querySelector('.image-viewport__stage') as HTMLElement
    expect(leftStage.style.transform).toContain('scale(1.25)')
    expect(rightStage.style.transform).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
    // 左侧读数 125%，右侧读数仍为 100%
    expect(panes[0].querySelector('.image-viewport__zoom')?.textContent).toBe('125%')
    expect(panes[1].querySelector('.image-viewport__zoom')?.textContent).toBe('100%')
  })

  it('pans one pane by dragging without affecting the other', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const panes = paneEls()
    const leftViewport = panes[0].querySelector('.compare-pane__viewport') as HTMLElement
    fireEvent.pointerDown(leftViewport, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(leftViewport, { clientX: 12, clientY: -8 })
    fireEvent.pointerUp(leftViewport, {})
    expect(
      (panes[0].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toBe('translate(12px, -8px) rotate(0deg) scale(1)')
    expect(
      (panes[1].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
  })

  it('offers a per-pane reset without touching the other pane', () => {
    renderCompare(
      makeImageAsset({ id: 'a1', name: 'heart.png', objectUrl: 'blob:mock-1' }),
      makeImageAsset({ id: 'a2', name: 'lung.png', objectUrl: 'blob:mock-2' }),
    )
    const panes = paneEls()
    fireEvent.click(within(panes[0]).getByRole('button', { name: '旋转 90 度' }))
    fireEvent.click(within(panes[1]).getByRole('button', { name: '放大' }))
    expect(
      (panes[0].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toContain('rotate(90deg)')
    expect(
      (panes[1].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toContain('scale(1.25)')
    // 重置左侧：仅左侧回恒等，右侧保留放大
    fireEvent.click(within(panes[0]).getByRole('button', { name: '重置视图' }))
    expect(
      (panes[0].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toBe('translate(0px, 0px) rotate(0deg) scale(1)')
    expect(
      (panes[1].querySelector('.image-viewport__stage') as HTMLElement).style.transform,
    ).toContain('scale(1.25)')
  })
})

describe('CompareView: DICOM 双系列比较（CR-012 T-003 / R-029）', () => {
  /** objectUrl → 文件字节（未注册的 URL 抛错，便于发现测试漏洞） */
  function stubFetchFor(files: Record<string, Uint8Array>): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const bytes = files[url]
        if (bytes === undefined) throw new Error(`测试未注册该 objectUrl 的 fixture：${url}`)
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => bytes.slice().buffer,
        }
      }),
    )
  }

  /** jsdom 无 2D Canvas：拦截 getContext，记录 putImageData 调用以断言解码路径 */
  function stubCanvasContext(): { putImageData: ReturnType<typeof vi.fn> } {
    const putImageData = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      putImageData,
    } as unknown as CanvasRenderingContext2D)
    return { putImageData }
  }

  function makeDicomAsset(overrides: Partial<Asset> = {}): Asset {
    return {
      id: 'd1',
      name: 'slice-001.dcm',
      kind: 'dicom',
      status: 'pending',
      tags: [],
      note: '',
      source: '拖拽导入',
      file: { fileName: 'slice-001.dcm', fileSize: 512, fileType: 'application/dicom' },
      createdAt: '2026-09-04T08:00:00.000Z',
      updatedAt: '2026-09-04T08:00:00.000Z',
      ...overrides,
    }
  }

  /**
   * 两个系列（同患者 CHEN^WEI / P2，uid-A × lenA 切片、uid-B × lenB 切片）的
   * 素材与字节表：objectUrl 命名 blob:aN / blob:bN，InstanceNumber 1..N。
   */
  function buildTwoSeries(lenA = 3, lenB = 3): {
    assets: Asset[]
    left: Asset
    right: Asset
    files: Record<string, Uint8Array>
  } {
    const assets: Asset[] = []
    const files: Record<string, Uint8Array> = {}
    for (const [uid, len] of [
      ['uid-A', lenA],
      ['uid-B', lenB],
    ] as const) {
      const buffers = buildDicomSeriesBuffers(len, {
        seriesInstanceUID: uid,
        patientName: 'CHEN^WEI',
        patientID: 'P2',
        pixelData: gradientPixels8(8, 8, 30, 200),
      })
      for (let i = 1; i <= len; i += 1) {
        const prefix = uid === 'uid-A' ? 'a' : 'b'
        const id = `${prefix}${i}`
        files[`blob:${id}`] = new Uint8Array(buffers[i - 1])
        assets.push(
          makeDicomAsset({
            id,
            name: `${id}.dcm`,
            file: { fileName: `${id}.dcm`, fileSize: 512, fileType: 'application/dicom' },
            objectUrl: `blob:${id}`,
          }),
        )
      }
    }
    return { assets, left: assets[0] as Asset, right: assets[lenA] as Asset, files }
  }

  function renderDicomCompare(
    left: Asset,
    right: Asset,
    assets: Asset[],
    files: Record<string, Uint8Array>,
  ) {
    const onExit = vi.fn()
    const onMetasParsed = vi.fn()
    stubFetchFor(files)
    stubCanvasContext()
    render(
      <CompareView
        left={left}
        right={right}
        onExit={onExit}
        dicomAssets={assets}
        onMetasParsed={onMetasParsed}
      />,
    )
    return { onExit, onMetasParsed }
  }

  function dicomPanes(dialog: HTMLElement): HTMLElement[] {
    const panes = Array.from(dialog.querySelectorAll('.compare-pane--dicom')) as HTMLElement[]
    if (panes.length !== 2) throw new Error('应渲染两个 DICOM 比较窗格')
    return panes
  }

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the DICOM compare dialog with one pane per series and exits via button/Esc', async () => {
    const { assets, left, right, files } = buildTwoSeries()
    stubFetchFor(files)
    stubCanvasContext()
    const onExit = vi.fn()
    render(
      <CompareView left={left} right={right} onExit={onExit} dicomAssets={assets} />,
    )
    const dialog = screen.getByRole('dialog', { name: 'DICOM 比较' })
    expect(within(dialog).getByText('退出比较')).toBeTruthy()
    // 双窗各带窗名与解析完成后的 Inst #1 / 3（初始共享序位 0）
    const panes = dicomPanes(dialog)
    await within(panes[0]).findByText('Inst #1 / 3')
    await within(panes[1]).findByText('Inst #1 / 3')
    // 窗名按窗格顺序呈现（a1.dcm 文本同时出现在四角覆盖层文件名占位，
    // 故按 .compare-pane__name 结构断言而非全局 getByText）
    const paneNames = Array.from(
      dialog.querySelectorAll('.compare-pane__name'),
      (el) => el.textContent,
    )
    expect(paneNames).toEqual(['a1.dcm', 'b1.dcm'])
    fireEvent.click(within(dialog).getByRole('button', { name: '退出比较' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('syncs slices bidirectionally: wheel on the left drives the right, slider on the right drives the left', async () => {
    const { assets, left, right, files } = buildTwoSeries()
    renderDicomCompare(left, right, assets, files)
    const dialog = screen.getByRole('dialog', { name: 'DICOM 比较' })
    const panes = dicomPanes(dialog)
    await within(panes[0]).findByText('Inst #1 / 3')

    // 左窗滚轮向下：共享索引 +1 → 右窗同步到 #2（滑条跟随）
    const wraps = Array.from(
      dialog.querySelectorAll('.dicom-viewer__canvas-wrap'),
    ) as HTMLElement[]
    expect(wraps).toHaveLength(2)
    fireEvent.wheel(wraps[0], { deltaY: 100 })
    await within(panes[0]).findByText('Inst #2 / 3')
    expect(within(panes[1]).getByText('Inst #2 / 3')).toBeTruthy()
    expect(
      (within(panes[1]).getByLabelText('选择切片（右侧）') as HTMLInputElement).value,
    ).toBe('2')

    // 右窗滑条拖到 #3：左窗同步（滑条 → 滚轮通路反向）
    fireEvent.change(within(panes[1]).getByLabelText('选择切片（右侧）'), {
      target: { value: '3' },
    })
    await within(panes[1]).findByText('Inst #3 / 3')
    expect(within(panes[0]).getByText('Inst #3 / 3')).toBeTruthy()
    expect(
      (within(panes[0]).getByLabelText('选择切片（左侧）') as HTMLInputElement).value,
    ).toBe('3')

    // 左窗滑条拖回 #1：右窗同步回 #1
    fireEvent.change(within(panes[0]).getByLabelText('选择切片（左侧）'), {
      target: { value: '1' },
    })
    await within(panes[0]).findByText('Inst #1 / 3')
    expect(within(panes[1]).getByText('Inst #1 / 3')).toBeTruthy()
  })

  it('aligns slices by index and clamps to the shorter series length', async () => {
    // uid-A 3 切片、uid-B 2 切片：共享索引超过 B 的长度时 B 钳制在末片
    const { assets, left, right, files } = buildTwoSeries(3, 2)
    renderDicomCompare(left, right, assets, files)
    const dialog = screen.getByRole('dialog', { name: 'DICOM 比较' })
    const panes = dicomPanes(dialog)
    await within(panes[0]).findByText('Inst #1 / 3')
    await within(panes[1]).findByText('Inst #1 / 2')

    const wraps = Array.from(
      dialog.querySelectorAll('.dicom-viewer__canvas-wrap'),
    ) as HTMLElement[]
    // 左窗滚两次：共享索引 0→2，左窗到 #3；右窗钳制在末片 #2 / 2
    fireEvent.wheel(wraps[0], { deltaY: 100 })
    await within(panes[0]).findByText('Inst #2 / 3')
    expect(within(panes[1]).getByText('Inst #2 / 2')).toBeTruthy()
    fireEvent.wheel(wraps[0], { deltaY: 100 })
    await within(panes[0]).findByText('Inst #3 / 3')
    expect(within(panes[1]).getByText('Inst #2 / 2')).toBeTruthy()
    expect(
      (within(panes[1]).getByLabelText('选择切片（右侧）') as HTMLInputElement).value,
    ).toBe('2')

    // 在右窗（已钳制在末片）继续下滚：无变化（不越界、不驱动左窗）
    fireEvent.wheel(wraps[1], { deltaY: 100 })
    expect(within(panes[0]).getByText('Inst #3 / 3')).toBeTruthy()
    expect(within(panes[1]).getByText('Inst #2 / 2')).toBeTruthy()
  })

  it('shares pan/zoom transforms across panes (drag and Ctrl+wheel)', async () => {
    const { assets, left, right, files } = buildTwoSeries()
    renderDicomCompare(left, right, assets, files)
    const dialog = screen.getByRole('dialog', { name: 'DICOM 比较' })
    const panes = dicomPanes(dialog)
    await within(panes[0]).findByText('Inst #1 / 3')

    const stages = () =>
      (Array.from(dialog.querySelectorAll('.dicom-viewer__stage')) as HTMLElement[]).map(
        (el) => el.style.transform,
      )

    // 左窗 pan 拖拽 (+30, +5)：两窗舞台同步平移
    const leftCanvas = within(panes[0]).getByLabelText('所选切片的灰度预览（左侧）')
    fireEvent.pointerDown(leftCanvas, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(leftCanvas, { clientX: 40, clientY: 15 })
    fireEvent.pointerUp(leftCanvas, { clientX: 40, clientY: 15 })
    expect(stages()[0]).toBe('translate(30px, 5px) rotate(0deg) scale(1)')
    expect(stages()[1]).toBe('translate(30px, 5px) rotate(0deg) scale(1)')

    // 右窗 Ctrl+滚轮放大：两窗同步 110%（切片不变）
    const wraps = Array.from(
      dialog.querySelectorAll('.dicom-viewer__canvas-wrap'),
    ) as HTMLElement[]
    fireEvent.wheel(wraps[1], { deltaY: -100, ctrlKey: true })
    await within(panes[1]).findByText('Zoom: 110%')
    expect(within(panes[0]).getByText('Zoom: 110%')).toBeTruthy()
    expect(stages()[0]).toBe('translate(30px, 5px) rotate(0deg) scale(1.1)')
    expect(stages()[1]).toBe('translate(30px, 5px) rotate(0deg) scale(1.1)')
    expect(within(panes[0]).getByText('Inst #1 / 3')).toBeTruthy()
  })

  it('keeps window level independent per pane (window tool drag affects only that pane)', async () => {
    const { assets, left, right, files } = buildTwoSeries()
    stubFetchFor(files)
    stubCanvasContext()
    render(
      <CompareView
        left={left}
        right={right}
        onExit={vi.fn()}
        dicomAssets={assets}
        activeTool="window"
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'DICOM 比较' })
    const panes = dicomPanes(dialog)
    await within(panes[0]).findByText('Inst #1 / 3')

    // 初始两窗独立展示 auto 口径（C: +40 W: 400（自动））
    expect(within(panes[0]).getByText('C: +40 W: 400（自动）')).toBeTruthy()
    expect(within(panes[1]).getByText('C: +40 W: 400（自动）')).toBeTruthy()

    // 左窗 window 拖拽（横 +50 → 窗宽 450，竖 -40 → 窗位 80）：仅左窗变手动，右窗不变
    const leftCanvas = within(panes[0]).getByLabelText('所选切片的灰度预览（左侧）')
    fireEvent.pointerDown(leftCanvas, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(leftCanvas, { clientX: 150, clientY: 60 })
    fireEvent.pointerUp(leftCanvas, { clientX: 150, clientY: 60 })
    await within(panes[0]).findByText('C: +80 W: 450')
    expect(within(panes[1]).getByText('C: +40 W: 400（自动）')).toBeTruthy()
  })

  it('degrades the compressed pane to metadata-only without breaking the other pane', async () => {
    // 左窗压缩传输语法（仅元数据降级），右窗可解码：单窗降级不互相影响、不崩溃
    const buffersA = buildDicomSeriesBuffers(1, {
      seriesInstanceUID: 'uid-A',
      transferSyntax: JPEG_BASELINE_TRANSFER_SYNTAX_UID,
      patientName: 'CHEN^WEI',
      patientID: 'P2',
    })
    const buffersB = buildDicomSeriesBuffers(1, {
      seriesInstanceUID: 'uid-B',
      patientName: 'CHEN^WEI',
      patientID: 'P2',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    const left = makeDicomAsset({
      id: 'a1',
      name: 'a1.dcm',
      file: { fileName: 'a1.dcm', fileSize: 512, fileType: 'application/dicom' },
      objectUrl: 'blob:a1',
    })
    const right = makeDicomAsset({
      id: 'b1',
      name: 'b1.dcm',
      file: { fileName: 'b1.dcm', fileSize: 512, fileType: 'application/dicom' },
      objectUrl: 'blob:b1',
    })
    stubFetchFor({
      'blob:a1': new Uint8Array(buffersA[0]),
      'blob:b1': new Uint8Array(buffersB[0]),
    })
    const { putImageData } = stubCanvasContext()
    render(<CompareView left={left} right={right} onExit={vi.fn()} dicomAssets={[left, right]} />)
    const dialog = screen.getByRole('dialog', { name: 'DICOM 比较' })
    const panes = dicomPanes(dialog)
    // 左窗：压缩 → 仅元数据降级文案（alert），元数据仍展示
    await waitFor(() => {
      expect(within(panes[0]).getByRole('alert').textContent).toContain('仅元数据')
    })
    // 右窗：正常解码绘制（putImageData 被调用），切片滑条可用
    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled()
    })
    expect(within(panes[1]).getByLabelText('选择切片（右侧）')).toBeTruthy()
  })

  it('survives a corrupt file in one pane (parse error shown, other pane intact)', async () => {
    const buffersB = buildDicomSeriesBuffers(1, {
      seriesInstanceUID: 'uid-B',
      patientName: 'CHEN^WEI',
      patientID: 'P2',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    const left = makeDicomAsset({
      id: 'a1',
      name: 'a1.dcm',
      file: { fileName: 'a1.dcm', fileSize: 512, fileType: 'application/dicom' },
      objectUrl: 'blob:a1',
    })
    const right = makeDicomAsset({
      id: 'b1',
      name: 'b1.dcm',
      file: { fileName: 'b1.dcm', fileSize: 512, fileType: 'application/dicom' },
      objectUrl: 'blob:b1',
    })
    stubFetchFor({ 'blob:a1': new Uint8Array(64).fill(0x41), 'blob:b1': new Uint8Array(buffersB[0]) })
    stubCanvasContext()
    render(<CompareView left={left} right={right} onExit={vi.fn()} dicomAssets={[left, right]} />)
    const dialog = screen.getByRole('dialog', { name: 'DICOM 比较' })
    const panes = dicomPanes(dialog)
    await waitFor(() => {
      expect(within(panes[0]).getAllByText(/无法解析该 DICOM 文件/).length).toBeGreaterThan(0)
    })
    // 右窗不损坏：滑条与 Inst 读数正常
    await within(panes[1]).findByText('Inst #1 / 1')
    expect(within(panes[1]).getByLabelText('选择切片（右侧）')).toBeTruthy()
  })
})

describe('CompareView: STL 双模型比较（CR-012 T-004 / R-030）', () => {
  function makeModelAsset(id: string, name: string): Asset {
    return {
      id,
      name,
      kind: 'model',
      status: 'pending',
      tags: [],
      note: '',
      source: '样本 STL',
      file: { fileName: name, fileSize: 284, fileType: 'model/stl' },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      objectUrl: `blob:${id}`,
    }
  }

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('dispatches a model pair to the 模型比较 dialog with two model panes (real three, no WebGL)', async () => {
    // jsdom 无 WebGL：加载桩走真实 STLLoader 解析 → 双窗到达 WebGL 降级分支
    // （同步接线 / dispose 清理由 ModelComparePanes.test.tsx 以 three.js 桩覆盖）
    const stlBytes = new Uint8Array(buildStlFile())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => String(stlBytes.byteLength) },
        body: null,
        arrayBuffer: async () => stlBytes.slice().buffer,
      })),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const onExit = vi.fn()
    render(
      <CompareView
        left={makeModelAsset('m1', 'aorta.stl')}
        right={makeModelAsset('m2', 'heart.stl')}
        onExit={onExit}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: '模型比较' })
    expect(within(dialog).getByText(/双模型并排显示/)).toBeTruthy()
    // 双窗渲染（ModelComparePanes 经 React.lazy 按需加载，需等待挂载）：
    // 窗名按窗格顺序呈现（先选在左）
    const paneNames = await waitFor(() => {
      const names = Array.from(
        dialog.querySelectorAll('.compare-pane__name'),
        (el) => el.textContent,
      )
      expect(names).toEqual(['aorta.stl', 'heart.stl'])
      return names
    })
    expect(paneNames).toEqual(['aorta.stl', 'heart.stl'])
    // 两窗各自降级（WebGL 不可用），互不影响且不崩溃
    await waitFor(() => {
      expect(within(dialog).getAllByText(/当前浏览器不支持 WebGL/)).toHaveLength(2)
    })
    // 退出比较：按钮 + Esc 双路径
    fireEvent.click(within(dialog).getByRole('button', { name: '退出比较' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(2)
  })
})
