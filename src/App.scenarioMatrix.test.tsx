/**
 * 批量导入场景矩阵集成测试（CR-007 T-003 / R-020）。
 *
 * 以「导入组合 → 左栏层级」为核心断言点的 App 级集成矩阵（真实导入管线 drop →
 * useImport → 查看/解析 → 元数据回写 → 患者分组/系列/切片展示）：
 * ① 同系列 10 文件 → 1 组 1 系列 10 切片 + 缩略图占位↔像素切换；
 * ② 跨系列 10 文件（不同 UID）→ 1 组 10 系列，二开只解析所属系列（R-018，mock fetch 调用集合）；
 * ③ 同患者无 UID 10 文件 → 1 组 1 未知系列 10 切片（R-019）；
 * ④ 混合患者 → 组间隔离、组内已知系列+未知系列共存、持久化分组按 R-012 排序、跨患者解析隔离；
 * ⑤ 空批次 / 失败文件 → 不崩溃、降级提示、分组只含可解析切片。
 *
 * 断言口径（CR-008 T-001 场景矩阵适配）：
 * - 左栏患者分组独立面板（R-021）一次渲染全部患者组头（`.dicom-panel__group-head`，
 *   N 序列 · N 张），series 行仅渲染在展开组内（当前素材所属组自动展开）；
 * - 未知系列聚合：series 行文案「未知系列（N 个文件）」；
 * - 解析范围：mock fetch 调用集合（objectUrl → 文件名还原后比较）；
 * - 缩略图占位↔像素：sliceThumb 模块 mock（jsdom 无 canvas；同时隔离缩略图请求，
 *   使 fetch 调用集合恰为 DicomViewer 解析范围；生成器自身行为由 sliceThumb.test.ts 覆盖）。
 *
 * 患者组间排序（R-012 组间码点升序）：面板渲染全部患者组头后可直接断言 UI 排序，
 * 并经持久化元数据 + groupDicomByPatient（产品同一实现）在真实导入数据上双重断言（④）。
 *
 * 面板交互与高亮联动（CR-008 T-003）：点击分组切片 → 面板不搬家（R-021：渲染位置 /
 * 组头 / 系列 / 展开状态不变，仅中央与高亮切换）；滑动条切换 → 高亮跟随（R-022 同场景
 * 断言；滑动条/点击/关闭完整三路径由 App.workbench.test.tsx 集成用例覆盖，不重复）。
 *
 * 视口收尾断言（CR-009 T-004）：中央无元数据表格 + 右栏 MetadataPanel 唯一元数据源
 * （R-023，grep 口径）；滚轮 ↔ 底部滑条双向同步（R-025，App 集成一条，边界钳制与
 * 反向连续性同测）；顶栏工具组切换冒烟（R-024，aria-pressed ↔ 查看器 data-tool 跟随，
 * 测量小控件随工具显隐；工具行为细节由 DicomViewer/TopToolbar 组件测试覆盖，不重复）。
 *
 * 比较显式模式场景（CR-011 T-003 / R-002）：混合素材下的 App 级集成断言——顶栏「比较」
 * 进入比较模式后列表筛选出可比较图片（非 image 行与 DICOM 患者分组面板隐藏、提示条出现）、
 * 显式选择满两张自动并排比较（先选在左）、退出恢复完整列表与普通模式行点击查看语义
 * （模式状态机细节由 App.test.tsx / TopToolbar.test.tsx 覆盖，不重复）。
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { loadState } from './store/repository.ts'
import type { Asset, DicomMeta } from './domain/types.ts'
import { groupDicomByPatient } from './features/viewer/dicom/seriesUtils.ts'
import {
  FIXTURE_SERIES_INSTANCE_UID,
  buildDicomFile,
  buildDicomSeriesBuffers,
  gradientPixels8,
} from './features/viewer/dicom/__fixtures__/buildDicomFile.ts'
import { generateSliceThumb, getCachedSliceThumb } from './features/viewer/dicom/sliceThumb.ts'

// sliceThumb 模块 mock（T-002 组件测试同款隔离）：
// 1) jsdom 无 canvas，真实生成必然走降级；2) 隔离缩略图的字节请求，
// 使 mock fetch 调用集合 = 查看器解析范围（R-018 断言口径）；
// 3) 占位↔像素切换由本文件可控 mock 驱动。
vi.mock('./features/viewer/dicom/sliceThumb.ts', () => ({
  getCachedSliceThumb: vi.fn(() => undefined),
  generateSliceThumb: vi.fn(async () => null),
}))
const generateMock = vi.mocked(generateSliceThumb)
const cacheMock = vi.mocked(getCachedSliceThumb)

/** objectUrl → 原始 File 名映射（createObjectURL 桩记录；fetch 桩按名供给字节） */
let nameByUrl = new Map<string, string>()
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')

/** 替换 URL.createObjectURL：按 File 名生成稳定 blob URL 并记录映射（与导入顺序无关） */
function stubObjectUrlCreation(): void {
  nameByUrl = new Map()
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: (file: Blob): string => {
      const name = file instanceof File ? file.name : `unknown-${nameByUrl.size}`
      const url = `blob:matrix:${encodeURIComponent(name)}`
      nameByUrl.set(url, name)
      return url
    },
  })
}

/** objectUrl → 文件字节（未注册的 URL 直接抛错，便于发现测试漏洞） */
function stubFetchFor(bytesByName: Record<string, Uint8Array<ArrayBuffer>>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    const name = nameByUrl.get(url)
    const bytes = name !== undefined ? bytesByName[name] : undefined
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

/** 解析范围断言（R-018/R-020）：fetch 调用集合 → 文件名集合（排序后比较，不耦合解析顺序） */
function expectFetched(fetchMock: ReturnType<typeof vi.fn>, names: string[]): void {
  const fetched = fetchMock.mock.calls
    .map((call) => nameByUrl.get(call[0] as string))
    .filter((name): name is string => name !== undefined)
    .sort()
  expect(fetched).toEqual([...names].sort())
}

function dcmFile(name: string, bytes: Uint8Array<ArrayBuffer>): File {
  return new File([bytes], name, { type: 'application/dicom' })
}

function dropFiles(container: HTMLElement, files: File[]): void {
  const dropzone = container.querySelector('.import-zone__drop') as HTMLDivElement
  fireEvent.drop(dropzone, { dataTransfer: { files } })
}

/** jsdom 无 2D Canvas：查看器预览走「环境不支持」降级分支（不崩溃，与既有 App 测试一致） */
function stubCanvasUnavailable(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
}

/** 左栏患者组头（按患者姓名定位；面板渲染全部组头，DOM 顺序 = R-012 组间排序） */
function groupHeadByName(name: string): HTMLElement {
  const head = Array.from(
    document.querySelectorAll('.dicom-panel__group-head'),
  ).find((el) => el.querySelector('.dicom-panel__group-name')?.textContent === name)
  if (head === undefined) throw new Error(`左栏患者组头未渲染：${name}`)
  return head as HTMLElement
}

/** 左栏全部组头姓名集合（DOM 顺序 = 面板渲染顺序 = R-012 组间排序） */
function groupHeadNames(): string[] {
  return Array.from(
    document.querySelectorAll('.dicom-panel__group-name'),
    (el) => el.textContent,
  )
}

/** 左栏 series 行 UID 文案集合（DOM 顺序 = 组间排序 + 组内系列排序；同时规避查看器元数据表格同文案歧义） */
function seriesUidTexts(): string[] {
  return Array.from(
    document.querySelectorAll('.dicom-panel__series-uid'),
    (el) => el.textContent,
  )
}

/**
 * 等待切片缩略图按钮出现（当前素材所在 series 由 effect 自动展开，滞后于患者组头渲染一拍）。
 */
async function waitForSliceThumbs(count: number): Promise<HTMLElement[]> {
  let thumbs: HTMLElement[] = []
  await waitFor(() => {
    thumbs = screen.getAllByRole('button', { name: /^查看切片/ })
    expect(thumbs).toHaveLength(count)
  })
  return thumbs
}

/** 等待首次解析完成：指定患者组头出现（元数据已回写）后断言层级与计数 */
async function waitForPatientHead(name: string, id: string, count: string): Promise<HTMLElement> {
  await waitFor(() => {
    const head = groupHeadByName(name)
    expect(within(head).getByText(id)).toBeTruthy()
    expect(within(head).getByText(count)).toBeTruthy()
  })
  return groupHeadByName(name)
}

/** 全部 DICOM 行缩略图目标（含行/切片两个入口）的生成请求挂起，返回统一放行器 */
function holdThumbGeneration(): () => void {
  // 行缩略图（AssetGrid）与切片缩略图（PatientGroupPanel）会对同一素材 id 各调用一次
  // 生成：必须逐次登记 resolver（数组），放行时全部 resolve，两个入口才能同时拿到像素。
  const resolvers: Array<(value: string | null) => void> = []
  generateMock.mockImplementation(
    () =>
      new Promise<string | null>((resolve) => {
        resolvers.push(resolve)
      }),
  )
  return () => {
    for (const resolve of resolvers) resolve('data:image/png;base64,frame')
  }
}

describe('App: 批量导入场景矩阵（CR-007 T-003 / R-020）', () => {
  beforeEach(() => {
    localStorage.clear()
    stubObjectUrlCreation()
    generateMock.mockResolvedValue(null) // 默认降级：占位保持
    cacheMock.mockReturnValue(undefined)
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.restoreAllMocks()
    vi.resetAllMocks() // 恢复模块 mock 工厂默认实现，避免用例间的桩互相泄漏
    vi.unstubAllGlobals()
    if (originalCreateObjectURL === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    }
    localStorage.clear()
  })

  it('① 同系列 10 文件 → 1 组 1 系列 10 切片；解析范围=全批（首次打开均未归类）；缩略图占位↔像素', async () => {
    // 同 SeriesInstanceUID（fixture 默认 UID）、InstanceNumber 1..10 的 10 个文件
    const buffers = buildDicomSeriesBuffers(10, {
      patientName: 'CHEN^WEI',
      patientID: 'P2',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    const bytesByName: Record<string, Uint8Array<ArrayBuffer>> = {}
    const files = buffers.map((buffer, index) => {
      const name = `a${String(index + 1).padStart(2, '0')}.dcm`
      bytesByName[name] = new Uint8Array(buffer)
      return dcmFile(name, bytesByName[name])
    })
    const fetchMock = stubFetchFor(bytesByName)
    stubCanvasUnavailable()
    const releaseThumbs = holdThumbGeneration()

    const { container } = render(<App />)
    dropFiles(container, files)
    await waitFor(() => {
      expect(screen.getByText('成功导入 10 个素材')).toBeTruthy()
    })

    // 打开第 1 个文件：全部文件尚无元数据（未归类）→ 全批解析（既有「打开即解析」行为，
    // 归属在解析出元数据后按患者分组语义归类，见 R-018 / DicomViewer 解析范围注释）
    fireEvent.click(screen.getByRole('button', { name: '查看“a01.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitForPatientHead('CHEN^WEI', 'P2', '1 序列 · 10 张')
    // CR-009 T-001：四角 Inst 读数反映分组切片数（打开的是 a01 = #1 / 10）
    expect(within(dialog).getByText('Inst #1 / 10')).toBeTruthy()
    expectFetched(fetchMock, [
      'a01.dcm', 'a02.dcm', 'a03.dcm', 'a04.dcm', 'a05.dcm',
      'a06.dcm', 'a07.dcm', 'a08.dcm', 'a09.dcm', 'a10.dcm',
    ])

    // 左栏层级：1 患者组 → 1 系列（UID 行）→ 10 切片，按 InstanceNumber 升序 #1..#10
    // （分组头经 onOpenGroup 自动展开，series 行随展开组渲染，滞后一拍 → waitFor）
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Series/ })).toHaveLength(1)
      expect(seriesUidTexts()).toEqual([FIXTURE_SERIES_INSTANCE_UID])
    })
    const thumbs = await waitForSliceThumbs(10)
    expect(thumbs.map((thumb) => thumb.getAttribute('aria-label'))).toEqual(
      Array.from({ length: 10 }, (_, index) => `查看切片 #${index + 1}`),
    )

    // 缩略图占位（生成挂起）：切片缩略图 = 占位 SVG，行缩略图 = 类型图标，无像素 img
    expect(document.querySelectorAll('.dicom-panel__thumb svg')).toHaveLength(10)
    expect(document.querySelectorAll('.dicom-panel__thumb-img')).toHaveLength(0)
    expect(document.querySelectorAll('.asset-row__glyph')).toHaveLength(10)
    expect(document.querySelectorAll('.asset-row__img')).toHaveLength(0)
    expect(generateMock).toHaveBeenCalled()

    // 放行生成 → 切换为真实像素（dataURL img），占位 SVG 消失（R-017 占位↔像素）
    await act(async () => {
      releaseThumbs()
    })
    await waitFor(() => {
      expect(document.querySelectorAll('.dicom-panel__thumb-img')).toHaveLength(10)
    })
    expect(document.querySelectorAll('.asset-row__img')).toHaveLength(10)
    expect(document.querySelector('.dicom-panel__thumb svg')).toBeNull()
    const pixel = document.querySelector('.dicom-panel__thumb-img') as HTMLImageElement
    expect(pixel.getAttribute('src')).toBe('data:image/png;base64,frame')

    // 聚合切片数回写并持久化（T-001 断言口径：本系列全批 10 张）
    const stored = Object.values(loadState().state.assets)
    expect(stored).toHaveLength(10)
    for (const asset of stored) {
      expect(asset.dicomMeta?.seriesInstanceUID).toBe(FIXTURE_SERIES_INSTANCE_UID)
      expect(asset.dicomMeta?.sliceCount).toBe(10)
    }
  })

  it('② 跨系列 10 文件（10 个不同 UID）→ 1 组 10 系列；再打开另一系列只解析该系列（R-018）', async () => {
    const bytesByName: Record<string, Uint8Array<ArrayBuffer>> = {}
    const files = Array.from({ length: 10 }, (_, index) => {
      const n = index + 1
      const name = `c${String(n).padStart(2, '0')}.dcm`
      const bytes = new Uint8Array(
        buildDicomFile({
          seriesInstanceUID: `uid-${n}`,
          instanceNumber: String(n),
          patientName: 'CHEN^WEI',
          patientID: 'P2',
          pixelData: gradientPixels8(8, 8, 30, 200),
        }),
      )
      bytesByName[name] = bytes
      return dcmFile(name, bytes)
    })
    const fetchMock = stubFetchFor(bytesByName)
    stubCanvasUnavailable()

    const { container } = render(<App />)
    dropFiles(container, files)
    await waitFor(() => {
      expect(screen.getByText('成功导入 10 个素材')).toBeTruthy()
    })

    // 首次打开 c01（uid-1）：全批未归类 → 全批解析，元数据归类后回写
    fireEvent.click(screen.getByRole('button', { name: '查看“c01.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    await waitForPatientHead('CHEN^WEI', 'P2', '10 序列 · 10 张')
    expectFetched(fetchMock, [
      'c01.dcm', 'c02.dcm', 'c03.dcm', 'c04.dcm', 'c05.dcm',
      'c06.dcm', 'c07.dcm', 'c08.dcm', 'c09.dcm', 'c10.dcm',
    ])

    // 左栏：10 个 series 行按 UID 码点升序（uid-1 < uid-10 < uid-2 …），各 1 张
    // （分组头经 onOpenGroup 自动展开，series 行随展开组渲染，滞后一拍 → waitFor）
    await waitFor(() => {
      expect(seriesUidTexts()).toEqual([
        'uid-1', 'uid-10', 'uid-2', 'uid-3', 'uid-4', 'uid-5', 'uid-6', 'uid-7', 'uid-8', 'uid-9',
      ])
    })
    // 激活系列（uid-1）自动展开显示自己的 #1；手动展开 uid-2 行显示它自己的 #2（各自切片正确）
    await waitForSliceThumbs(1)
    expect(screen.getByRole('button', { name: '查看切片 #1' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Series.*uid-2/ }))
    expect(screen.getByRole('button', { name: '查看切片 #2' })).toBeTruthy()

    // 关闭后打开另一系列（uid-2）的文件：其余文件已归类到其他系列 → 不再解析（R-018，
    // 不再「开一个解析全库」）；fetch 调用集合恰为所属系列文件
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fetchMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '查看“c02.dcm”的 DICOM 详情' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expectFetched(fetchMock, ['c02.dcm'])

    // 持久化：每个素材各自 seriesInstanceUID / instanceNumber / sliceCount=1
    const byName = new Map(
      Object.values(loadState().state.assets).map((asset) => [asset.file.fileName, asset]),
    )
    for (let n = 1; n <= 10; n += 1) {
      const asset = byName.get(`c${String(n).padStart(2, '0')}.dcm`)
      expect(asset?.dicomMeta?.seriesInstanceUID).toBe(`uid-${n}`)
      expect(asset?.dicomMeta?.instanceNumber).toBe(n)
      expect(asset?.dicomMeta?.sliceCount).toBe(1)
    }
  })

  it('③ 同患者无 UID 10 文件 → 1 组 1 未知系列 10 切片（R-019），不再 10 系列', async () => {
    const bytesByName: Record<string, Uint8Array<ArrayBuffer>> = {}
    const files = Array.from({ length: 10 }, (_, index) => {
      const n = index + 1
      const name = `u${String(n).padStart(2, '0')}.dcm`
      const bytes = new Uint8Array(
        buildDicomFile({
          seriesInstanceUID: null, // SeriesInstanceUID 缺失
          instanceNumber: String(n),
          patientName: 'CHEN^WEI',
          patientID: 'P2',
          pixelData: gradientPixels8(8, 8, 30, 200),
        }),
      )
      bytesByName[name] = bytes
      return dcmFile(name, bytes)
    })
    const fetchMock = stubFetchFor(bytesByName)
    stubCanvasUnavailable()

    const { container } = render(<App />)
    dropFiles(container, files)
    await waitFor(() => {
      expect(screen.getByText('成功导入 10 个素材')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看“u05.dcm”的 DICOM 详情' }))
    await waitForPatientHead('CHEN^WEI', 'P2', '1 序列 · 10 张')
    expectFetched(fetchMock, [
      'u01.dcm', 'u02.dcm', 'u03.dcm', 'u04.dcm', 'u05.dcm',
      'u06.dcm', 'u07.dcm', 'u08.dcm', 'u09.dcm', 'u10.dcm',
    ])

    // 左栏：单一「未知系列（10 个文件）」聚合行（不再 10 系列）→ 10 切片按 InstanceNumber 升序
    // （分组头经 onOpenGroup 自动展开，series 行随展开组渲染，均滞后一拍 → waitFor）
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Series/ })).toHaveLength(1)
      expect(seriesUidTexts()).toEqual(['未知系列（10 个文件）'])
    })
    const thumbs = await waitForSliceThumbs(10)
    expect(thumbs.map((thumb) => thumb.getAttribute('aria-label'))).toEqual(
      Array.from({ length: 10 }, (_, index) => `查看切片 #${index + 1}`),
    )

    // 持久化：10 个素材 sliceCount 均为 10（未知系列聚合口径）、无 seriesInstanceUID
    const stored = Object.values(loadState().state.assets)
    expect(stored).toHaveLength(10)
    for (const asset of stored) {
      expect(asset.dicomMeta?.seriesInstanceUID).toBeUndefined()
      expect(asset.dicomMeta?.sliceCount).toBe(10)
    }
  })

  it('④ 混合患者 → 组间隔离、组内已知+未知系列共存；持久化分组按 R-012 排序；跨患者解析隔离', async () => {
    const bytesByName: Record<string, Uint8Array<ArrayBuffer>> = {}
    const push = (name: string, options: Parameters<typeof buildDicomFile>[0]): File => {
      const bytes = new Uint8Array(buildDicomFile(options))
      bytesByName[name] = bytes
      return dcmFile(name, bytes)
    }
    // 患者乙：BROWN^ANN/PB，1 个已知系列 2 切片
    const b1 = push('b1.dcm', { seriesInstanceUID: 'uid-B', instanceNumber: '1', patientName: 'BROWN^ANN', patientID: 'PB', pixelData: gradientPixels8(8, 8) })
    const b2 = push('b2.dcm', { seriesInstanceUID: 'uid-B', instanceNumber: '2', patientName: 'BROWN^ANN', patientID: 'PB', pixelData: gradientPixels8(8, 8) })
    // 患者甲：ADAMS^J/PA，已知系列 2 切片 + 无 UID 2 文件（混合 UID 存在）
    const a1 = push('a1.dcm', { seriesInstanceUID: 'uid-A', instanceNumber: '1', patientName: 'ADAMS^J', patientID: 'PA', pixelData: gradientPixels8(8, 8) })
    const a2 = push('a2.dcm', { seriesInstanceUID: 'uid-A', instanceNumber: '2', patientName: 'ADAMS^J', patientID: 'PA', pixelData: gradientPixels8(8, 8) })
    const au1 = push('au1.dcm', { seriesInstanceUID: null, instanceNumber: '1', patientName: 'ADAMS^J', patientID: 'PA', pixelData: gradientPixels8(8, 8) })
    const au2 = push('au2.dcm', { seriesInstanceUID: null, instanceNumber: '2', patientName: 'ADAMS^J', patientID: 'PA', pixelData: gradientPixels8(8, 8) })
    // 去标识化文件（姓名/ID 均空）→ 「未知患者」组
    const anon = push('anon.dcm', { seriesInstanceUID: 'uid-X', instanceNumber: '1', patientName: '', patientID: '', pixelData: gradientPixels8(8, 8) })
    const fetchMock = stubFetchFor(bytesByName)
    stubCanvasUnavailable()

    const { container } = render(<App />)
    dropFiles(container, [b1, b2, a1, a2, au1, au2, anon])
    await waitFor(() => {
      expect(screen.getByText('成功导入 7 个素材')).toBeTruthy()
    })

    // 打开患者甲 a1：本组只含甲的 4 个文件（跨患者不污染计数），已知系列在前、未知系列最后
    fireEvent.click(screen.getByRole('button', { name: '查看“a1.dcm”的 DICOM 详情' }))
    await waitForPatientHead('ADAMS^J', 'PA', '2 序列 · 4 张')
    // 当前素材所属组自动展开（R-021 联动），series 行随展开组渲染（滞后一拍 → waitFor）
    await waitFor(() => {
      expect(seriesUidTexts()).toEqual(['uid-A', '未知系列（2 个文件）'])
    })
    // 面板一次渲染全部患者组头（R-021）：DOM 顺序 = R-012 组间码点升序，未知患者组末尾
    expect(groupHeadNames()).toEqual(['ADAMS^J', 'BROWN^ANN', '未知患者'])
    // 已知系列（激活）自动展开 #1/#2；展开未知系列后合计 4 张切片
    await waitForSliceThumbs(2)
    fireEvent.click(screen.getByRole('button', { name: /Series.*未知系列/ }))
    expect(screen.getAllByRole('button', { name: /^查看切片/ })).toHaveLength(4)

    // 组间排序（R-012）经持久化元数据 + 产品同一分组实现在真实导入数据上断言（与 UI 顺序互证）：
    // ADAMS^J < BROWN^ANN（码点升序），未知患者组末尾
    const dicomEntries = Object.values(loadState().state.assets)
      .filter((asset): asset is Asset & { dicomMeta: DicomMeta } => asset.dicomMeta !== undefined)
      .map((asset) => ({ assetId: asset.id, meta: asset.dicomMeta, fileName: asset.file.fileName }))
    const groups = groupDicomByPatient(dicomEntries)
    expect(groups.map((group) => (group.unknown ? '未知患者' : group.patientName))).toEqual([
      'ADAMS^J',
      'BROWN^ANN',
      '未知患者',
    ])
    expect(groups[0]?.seriesCount).toBe(2)
    expect(groups[0]?.sliceCount).toBe(4)
    expect(groups[1]?.seriesCount).toBe(1)
    expect(groups[1]?.sliceCount).toBe(2)
    expect(groups[2]?.unknown).toBe(true)

    // 关闭后打开患者乙 b1：甲/未知患者文件已归类 → 解析范围仅乙系列（跨患者解析隔离，R-018）
    fireEvent.click(within(screen.getByRole('dialog', { name: 'DICOM 详情' })).getByRole('button', { name: '关闭' }))
    fetchMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '查看“b1.dcm”的 DICOM 详情' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expectFetched(fetchMock, ['b1.dcm', 'b2.dcm'])
    await waitForPatientHead('BROWN^ANN', 'PB', '1 序列 · 2 张')
  })
})

describe('App: 场景矩阵——空批次与失败文件（CR-007 T-003 / R-020 ⑤）', () => {
  beforeEach(() => {
    localStorage.clear()
    stubObjectUrlCreation()
    generateMock.mockResolvedValue(null)
    cacheMock.mockReturnValue(undefined)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.resetAllMocks()
    vi.unstubAllGlobals()
    if (originalCreateObjectURL === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    }
    localStorage.clear()
  })

  it('空批次（空 drop）：无副作用不崩溃，素材库保持为空', () => {
    stubCanvasUnavailable()
    const { container } = render(<App />)
    dropFiles(container, [])
    // 无导入反馈、无状态变化，应用正常渲染
    expect(screen.getByText('素材库（0）')).toBeTruthy()
    expect(screen.queryByText(/成功导入/)).toBeNull()
    expect(screen.getByText('将图片 / DICOM / 3D 模型文件拖到此处')).toBeTruthy()
  })

  it('失败文件与有效文件混合：失败降级提示不崩溃，分组与持久化只含可解析切片', async () => {
    const bytesByName: Record<string, Uint8Array<ArrayBuffer>> = {}
    const files: File[] = []
    // 3 个有效同系列文件（同患者）
    for (const buffer of buildDicomSeriesBuffers(3, {
      patientName: 'CHEN^WEI',
      patientID: 'P2',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })) {
      const name = `v${files.length + 1}.dcm`
      bytesByName[name] = new Uint8Array(buffer)
      files.push(dcmFile(name, bytesByName[name]))
    }
    // 2 个损坏文件（非 DICOM 字节）：解析失败走降级
    bytesByName['bad1.dcm'] = new Uint8Array(128)
    bytesByName['bad2.dcm'] = new Uint8Array(128)
    files.push(dcmFile('bad1.dcm', bytesByName['bad1.dcm']))
    files.push(dcmFile('bad2.dcm', bytesByName['bad2.dcm']))
    const fetchMock = stubFetchFor(bytesByName)
    stubCanvasUnavailable()

    const { container } = render(<App />)
    dropFiles(container, files)
    await waitFor(() => {
      expect(screen.getByText('成功导入 5 个素材')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看“v1.dcm”的 DICOM 详情' }))
    const dialog = screen.getByRole('dialog', { name: 'DICOM 详情' })
    // 分组只含可解析切片：1 组 1 系列 3 张；损坏文件降级汇总提示
    await waitForPatientHead('CHEN^WEI', 'P2', '1 序列 · 3 张')
    await waitFor(() => {
      expect(within(dialog).getByText('2 个文件无法解析，已按可用内容降级展示')).toBeTruthy()
    })
    expectFetched(fetchMock, ['v1.dcm', 'v2.dcm', 'v3.dcm', 'bad1.dcm', 'bad2.dcm'])
    await waitForSliceThumbs(3)

    // 缩略图降级：有效切片生成失败（mock → null）保持占位 SVG；损坏行（无元数据）保持类型图标
    expect(document.querySelectorAll('.dicom-panel__thumb svg')).toHaveLength(3)
    expect(document.querySelectorAll('.dicom-panel__thumb-img')).toHaveLength(0)
    expect(document.querySelectorAll('.asset-row__glyph')).toHaveLength(5)
    expect(document.querySelectorAll('.asset-row__img')).toHaveLength(0)

    // 持久化：仅 3 个有效素材回写元数据；关闭查看器不崩溃、素材库完整
    const stored = Object.values(loadState().state.assets)
    expect(stored.filter((asset) => asset.dicomMeta !== undefined)).toHaveLength(3)
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('素材库（5）')).toBeTruthy()
  })
})

describe('App: 场景矩阵——面板交互与高亮联动（CR-008 T-003 / R-021·R-022）', () => {
  beforeEach(() => {
    localStorage.clear()
    stubObjectUrlCreation()
    generateMock.mockResolvedValue(null) // 默认降级：占位保持（高亮断言不依赖缩略图像素）
    cacheMock.mockReturnValue(undefined)
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.restoreAllMocks()
    vi.resetAllMocks()
    vi.unstubAllGlobals()
    if (originalCreateObjectURL === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    }
    localStorage.clear()
  })

  it('点击分组切片 → 面板不搬家（R-021）；滑动条切换 → 高亮跟随（R-022）', async () => {
    const buffers = buildDicomSeriesBuffers(4, {
      patientName: 'CHEN^WEI',
      patientID: 'P2',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    const bytesByName: Record<string, Uint8Array<ArrayBuffer>> = {}
    const files = buffers.map((buffer, index) => {
      const name = `m${String(index + 1).padStart(2, '0')}.dcm`
      bytesByName[name] = new Uint8Array(buffer)
      return dcmFile(name, bytesByName[name])
    })
    stubFetchFor(bytesByName)
    stubCanvasUnavailable()

    const { container } = render(<App />)
    dropFiles(container, files)
    await waitFor(() => {
      expect(screen.getByText('成功导入 4 个素材')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看“m01.dcm”的 DICOM 详情' }))
    await waitForSliceThumbs(4)
    expect(screen.getByRole('button', { name: '查看切片 #1' }).className).toContain('is-active')

    // 面板渲染位置基准：.dicom-panel 在左栏直接子节点中的下标
    const leftColumn = screen.getByRole('complementary', { name: '素材列表' })
    const panelPosition = (): number =>
      Array.from(leftColumn.children).indexOf(leftColumn.querySelector('.dicom-panel') as Element)
    const positionBefore = panelPosition()

    // 点击分组面板切片 #2：中央切换到该切片、高亮跟随，面板渲染位置/组头/系列/展开状态不变（R-021）
    fireEvent.click(screen.getByRole('button', { name: '查看切片 #2' }))
    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog', { name: 'DICOM 详情' })).getByText(
          '切片 2 / 4（按 InstanceNumber 排序）',
        ),
      ).toBeTruthy()
    })
    expect(panelPosition()).toBe(positionBefore)
    expect(groupHeadNames()).toEqual(['CHEN^WEI'])
    expect(groupHeadByName('CHEN^WEI').getAttribute('aria-expanded')).toBe('true')
    expect(seriesUidTexts()).toEqual([FIXTURE_SERIES_INSTANCE_UID])
    expect(
      document.querySelector('.dicom-panel__series-toggle')?.getAttribute('aria-expanded'),
    ).toBe('true')
    const thumbsAfterClick = await waitForSliceThumbs(4)
    expect(thumbsAfterClick.map((thumb) => thumb.getAttribute('aria-label'))).toEqual([
      '查看切片 #1', '查看切片 #2', '查看切片 #3', '查看切片 #4',
    ])
    expect(screen.getByRole('button', { name: '查看切片 #2' }).className).toContain('is-active')
    expect(screen.getByRole('button', { name: '查看切片 #2' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: '查看切片 #1' }).className).not.toContain('is-active')

    // 滑动条切到 #4：左栏高亮实时跟随（R-022，矩阵同场景断言）
    fireEvent.change(
      within(screen.getByRole('dialog', { name: 'DICOM 详情' })).getByLabelText('选择切片'),
      { target: { value: '4' } },
    )
    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog', { name: 'DICOM 详情' })).getByText(
          '切片 4 / 4（按 InstanceNumber 排序）',
        ),
      ).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: '查看切片 #4' }).className).toContain('is-active')
    expect(screen.getByRole('button', { name: '查看切片 #2' }).className).not.toContain('is-active')
  })
})

describe('App: 场景矩阵——视口收尾（CR-009 T-004 / R-023·R-024·R-025）', () => {
  beforeEach(() => {
    localStorage.clear()
    stubObjectUrlCreation()
    generateMock.mockResolvedValue(null) // 默认降级：占位保持
    cacheMock.mockReturnValue(undefined)
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.restoreAllMocks()
    vi.resetAllMocks()
    vi.unstubAllGlobals()
    if (originalCreateObjectURL === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    }
    localStorage.clear()
  })

  /** 向视口容器派发滚轮事件（监听器挂在 .dicom-viewer__canvas-wrap 上，R-025） */
  function wheelViewport(deltaY: number): void {
    const wrap = document.querySelector('.dicom-viewer__canvas-wrap')
    if (wrap === null) throw new Error('视口容器未渲染')
    fireEvent.wheel(wrap, { deltaY })
  }

  /** 导入并打开一个 N 切片同系列（InstanceNumber 1..N，文件名 t01..tNN）→ 中央 dialog */
  async function openSeries(n: number): Promise<HTMLElement> {
    const buffers = buildDicomSeriesBuffers(n, {
      patientName: 'CHEN^WEI',
      patientID: 'P2',
      pixelData: gradientPixels8(8, 8, 30, 200),
    })
    const bytesByName: Record<string, Uint8Array<ArrayBuffer>> = {}
    const files = buffers.map((buffer, index) => {
      const name = `t${String(index + 1).padStart(2, '0')}.dcm`
      bytesByName[name] = new Uint8Array(buffer)
      return dcmFile(name, bytesByName[name])
    })
    stubFetchFor(bytesByName)
    stubCanvasUnavailable()
    const { container } = render(<App />)
    dropFiles(container, files)
    await waitFor(() => {
      expect(screen.getByText(`成功导入 ${n} 个素材`)).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '查看“t01.dcm”的 DICOM 详情' }))
    await waitForPatientHead('CHEN^WEI', 'P2', `1 序列 · ${n} 张`)
    return screen.getByRole('dialog', { name: 'DICOM 详情' })
  }

  it('中央无元数据表格，右栏 MetadataPanel 为唯一元数据源（R-023 grep 断言）', async () => {
    const dialog = await openSeries(2)

    // 解析完成标志：四角 Inst 读数 + 右栏元数据行渲染（元数据已回写 App 状态）
    await waitFor(() => {
      expect(within(dialog).getByText('Inst #1 / 2')).toBeTruthy()
    })
    const right = screen.getByRole('complementary', { name: '信息面板' })
    await waitFor(() => {
      expect(within(right).getAllByText('SeriesInstanceUID')).toHaveLength(1)
    })

    // 中央查看器：无 <table>、无元数据面板/标题/行标签（grep 口径，中央表格已下线）
    expect(dialog.querySelector('table')).toBeNull()
    expect(dialog.querySelectorAll('.meta-panel')).toHaveLength(0)
    expect(within(dialog).queryByText('DICOM 元数据')).toBeNull()
    expect(within(dialog).queryByText('SeriesInstanceUID')).toBeNull()
    expect(within(dialog).queryByText('切片数（按序列分组）')).toBeNull()

    // 右栏：MetadataPanel 全文档唯一，元数据行标签仅出现在右栏（唯一元数据源）
    const panels = document.querySelectorAll('.meta-panel')
    expect(panels).toHaveLength(1)
    expect(right.contains(panels[0] as Node)).toBe(true)
    expect(within(right).getByText('DICOM 元数据')).toBeTruthy()
    expect(within(right).getByRole('button', { name: /^患者信息/ })).toBeTruthy()
    expect(within(right).getByRole('button', { name: /^序列信息/ })).toBeTruthy()
    const uidLabels = screen.getAllByText('SeriesInstanceUID')
    expect(uidLabels).toHaveLength(1)
    expect(right.contains(uidLabels[0] as Node)).toBe(true)
  })

  it('滚轮 ↔ 底部滑条双向同步（R-025）：滚轮切片滑条跟随、滑条切片四角 Inst 跟随、边界钳制', async () => {
    const dialog = await openSeries(4)
    const slider = (): HTMLInputElement => within(dialog).getByLabelText('选择切片') as HTMLInputElement
    await waitFor(() => {
      expect(within(dialog).getByText('Inst #1 / 4')).toBeTruthy()
    })

    // 首片向上滚：边界钳制不溢出
    wheelViewport(-100)
    expect(within(dialog).getByText('Inst #1 / 4')).toBeTruthy()
    expect(slider().value).toBe('1')

    // 滚轮向下：#1 → #2 → #3，滑条值与切片读数实时同步
    wheelViewport(100)
    await waitFor(() => {
      expect(within(dialog).getByText('Inst #2 / 4')).toBeTruthy()
    })
    expect(slider().value).toBe('2')
    expect(within(dialog).getByText('切片 2 / 4（按 InstanceNumber 排序）')).toBeTruthy()
    wheelViewport(100)
    await waitFor(() => {
      expect(within(dialog).getByText('Inst #3 / 4')).toBeTruthy()
    })
    expect(slider().value).toBe('3')

    // 末片再向下滚：钳制不溢出
    wheelViewport(100)
    wheelViewport(100)
    expect(within(dialog).getByText('Inst #4 / 4')).toBeTruthy()
    expect(slider().value).toBe('4')

    // 反向：滑条拖到 #1 → 四角 Inst 同步；再滚轮向下从 #1 连续切换到 #2（双向闭环）
    fireEvent.change(slider(), { target: { value: '1' } })
    await waitFor(() => {
      expect(within(dialog).getByText('Inst #1 / 4')).toBeTruthy()
    })
    wheelViewport(100)
    await waitFor(() => {
      expect(within(dialog).getByText('Inst #2 / 4')).toBeTruthy()
    })
    expect(slider().value).toBe('2')
  })

  it('顶栏工具组切换冒烟（R-024）：aria-pressed 与查看器 data-tool 跟随，测量小控件随工具显隐', async () => {
    const dialog = await openSeries(2)
    await waitFor(() => {
      expect(within(dialog).getByText('Inst #1 / 2')).toBeTruthy()
    })

    // 工具组：5 个工具按钮可见，默认平移激活；查看器按激活工具标注 data-tool
    expect(screen.getByRole('group', { name: '视口工具' })).toBeTruthy()
    for (const label of ['平移', '缩放', '窗宽窗位', '旋转', '测量（模拟）']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    const wrap = dialog.querySelector('.dicom-viewer__canvas-wrap')
    expect(wrap).not.toBeNull()
    expect(wrap?.getAttribute('data-tool')).toBe('pan')
    expect(screen.getByRole('button', { name: '平移' }).getAttribute('aria-pressed')).toBe('true')

    // 切到旋转：aria-pressed 跟随（App 持有状态 → 查看器 data-tool 透传）
    fireEvent.click(screen.getByRole('button', { name: '旋转' }))
    expect(screen.getByRole('button', { name: '旋转' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '平移' }).getAttribute('aria-pressed')).toBe('false')
    expect(wrap?.getAttribute('data-tool')).toBe('rotate')

    // 切到测量：Mock 提示与清空入口出现（清空禁用：尚无测量）
    fireEvent.click(screen.getByRole('button', { name: '测量（模拟）' }))
    expect(wrap?.getAttribute('data-tool')).toBe('measure')
    expect(within(dialog).getByText('模拟测量，非临床：距离标注仅供界面演示')).toBeTruthy()
    expect(
      (within(dialog).getByRole('button', { name: '清空测量' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    // 切回平移：测量小控件隐藏（无测量残留）
    fireEvent.click(screen.getByRole('button', { name: '平移' }))
    expect(wrap?.getAttribute('data-tool')).toBe('pan')
    expect(within(dialog).queryByText('模拟测量，非临床：距离标注仅供界面演示')).toBeNull()
  })
})

/** 非 DICOM 普通文件（图片 / STL 按扩展名识别，字节内容不参与本场景断言） */
function plainFile(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('App: 场景矩阵——比较显式模式（CR-011 T-003 / R-002）', () => {
  beforeEach(() => {
    localStorage.clear()
    stubObjectUrlCreation()
    generateMock.mockResolvedValue(null) // 默认降级：占位保持（比较场景断言不依赖缩略图像素）
    cacheMock.mockReturnValue(undefined)
  })
  afterEach(() => {
    cleanup() // vitest 未启用 globals，RTL 自动清理不生效，需手动卸载
    vi.restoreAllMocks()
    vi.resetAllMocks() // 恢复模块 mock 工厂默认实现，避免用例间的桩互相泄漏
    vi.unstubAllGlobals()
    if (originalCreateObjectURL === undefined) {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    }
    localStorage.clear()
  })

  it('进入比较模式筛选出可比较图片（非 image 行与 DICOM 分组面板隐藏）；显式选择满两张自动比较；退出恢复', async () => {
    // 混合素材：2 张图片（可比较）+ 1 个 DICOM + 1 个 STL（不可比较）
    const { container } = render(<App />)
    dropFiles(container, [
      plainFile('heart.png', 64, 'image/png'),
      plainFile('lung.png', 64, 'image/png'),
      dcmFile(
        'p01.dcm',
        new Uint8Array(
          buildDicomFile({ patientName: '', patientID: '', patientIdentityRemoved: 'YES' }),
        ),
      ),
      plainFile('aorta.stl', 256, ''),
    ])
    await waitFor(() => {
      expect(screen.getByText('成功导入 4 个素材')).toBeTruthy()
    })

    // 普通模式基准：非 image 行与 DICOM 患者分组面板可见
    expect(screen.getByRole('button', { name: '查看“p01.dcm”的 DICOM 详情' })).toBeTruthy()
    expect(screen.getByText('aorta.stl')).toBeTruthy()
    expect(document.querySelectorAll('.dicom-panel')).toHaveLength(1)

    // 顶栏「比较」进入显式比较模式：提示条出现；列表筛选仅剩 image——DICOM 行、
    // STL 行隐藏，DICOM 患者分组面板一并隐藏（进入模式筛选 image 断言，R-002）
    fireEvent.click(screen.getByRole('button', { name: '比较' }))
    expect(screen.getByText('选择两张图片进行比较（已选 0/2）')).toBeTruthy()
    expect(screen.getByRole('button', { name: '选择“heart.png”加入比较' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '选择“lung.png”加入比较' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '查看“p01.dcm”的 DICOM 详情' })).toBeNull()
    expect(screen.queryByText('aorta.stl')).toBeNull()
    expect(document.querySelectorAll('.dicom-panel')).toHaveLength(0)

    // 显式选择第一张：仅计数（1/2），不进入比较视图
    fireEvent.click(screen.getByRole('button', { name: '选择“heart.png”加入比较' }))
    expect(screen.getByText('选择两张图片进行比较（已选 1/2）')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: '图片比较' })).toBeNull()

    // 选择第二张：满 2 自动进入比较视图；双图并排且先选在左（R-002）
    fireEvent.click(screen.getByRole('button', { name: '选择“lung.png”加入比较' }))
    const dialog = screen.getByRole('dialog', { name: '图片比较' })
    const paneNames = Array.from(dialog.querySelectorAll('.compare-pane__name'), (el) => el.textContent)
    expect(paneNames).toEqual(['heart.png', 'lung.png'])

    // 退出比较视图 = 退出比较模式：清空选择并恢复完整列表（非 image 行与分组面板回来）
    fireEvent.click(within(dialog).getByRole('button', { name: '退出比较' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/选择两张图片进行比较/)).toBeNull()
    expect(screen.getByRole('button', { name: '查看“p01.dcm”的 DICOM 详情' })).toBeTruthy()
    expect(screen.getByText('aorta.stl')).toBeTruthy()
    expect(document.querySelectorAll('.dicom-panel')).toHaveLength(1)

    // 退出恢复：选择已清空（无按压残留）、顶栏回到「比较」；普通模式行点击恢复查看语义
    expect(screen.queryByRole('button', { name: /取消选择/ })).toBeNull()
    expect(screen.queryByRole('button', { name: '完成' })).toBeNull()
    expect(screen.getByRole('button', { name: '比较' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '查看图片“heart.png”' }))
    expect(screen.getByText('heart.png', { selector: '.image-stage__name' })).toBeTruthy()
  })
})
