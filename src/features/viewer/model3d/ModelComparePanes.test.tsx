/**
 * ModelComparePanes 组件测试（CR-012 T-004 / R-030）。
 *
 * jsdom 无 WebGL，真实 three.js 渲染链路无法建立；而模型比较的核心断言点——
 * 双实例创建、相机同步（change → 复制相机变换到对侧）、单侧失败降级、卸载
 * dispose 清理——通过 vi.mock('three') / OrbitControls / useModelLoader 桩驱动
 * 场景 effect 走完整路径后断言（桩类见 __fixtures__/mockThree.ts）。
 * 纯加载态/降级文案路径由 CompareView.test.tsx（真实 three、无 WebGL 环境分支）覆盖。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '../../../domain/types.ts'
import {
  MockMeshStandardMaterial,
  MockOrbitControls,
  MockWebGLRenderer,
  resetMockThreeInstances,
} from './__fixtures__/mockThree.ts'
import ModelComparePanes from './ModelComparePanes.tsx'

/** useModelLoader 桩的可替换实现（vi.mock 工厂经此间接调用，测试内按需覆盖） */
const loader = vi.hoisted(() => ({
  impl: null as null | ((params: { objectUrl: string | undefined }) => unknown),
}))

vi.mock('./useModelLoader.ts', () => ({
  useModelLoader: (params: { objectUrl: string | undefined; fileSize: number }) => {
    // 返回 undefined = 未覆盖该窗格 → 走默认成功桩（每次调用返回全新 geometry 对象，
    // 避免两窗共享可变状态）
    const overridden = loader.impl !== null ? loader.impl(params) : undefined
    if (overridden !== undefined) return overridden
    return {
      status: 'success',
      progress: null,
      geometry: {
        computeBoundingSphere: () => {},
        boundingSphere: { radius: 1.5, center: { x: 1, y: 2, z: 3 } },
      },
      error: null,
      large: false,
      retry: () => {},
    }
  },
}))

vi.mock(
  'three',
  async () => await import('./__fixtures__/mockThree.ts').then((m) => m.three),
)
vi.mock('three/examples/jsm/controls/OrbitControls.js', async () => ({
  OrbitControls: (await import('./__fixtures__/mockThree.ts')).MockOrbitControls,
}))

function makeModelAsset(id: string, name: string, objectUrl?: string): Asset {
  const at = '2026-09-01T00:00:00.000Z'
  return {
    id,
    name,
    kind: 'model',
    status: 'pending',
    tags: [],
    note: '',
    source: '样本 STL',
    file: { fileName: name, fileSize: 284, fileType: 'model/stl' },
    createdAt: at,
    updatedAt: at,
    objectUrl,
  }
}

function renderPanes(left?: Asset, right?: Asset) {
  render(
    <ModelComparePanes
      left={left ?? makeModelAsset('m1', 'aorta.stl', 'blob:left')}
      right={right ?? makeModelAsset('m2', 'heart.stl', 'blob:right')}
    />,
  )
}

/** 双窗的 OrbitControls 桩（挂载顺序：左窗先于右窗） */
function controlsPair(): [MockOrbitControls, MockOrbitControls] {
  const pair = MockOrbitControls.instances
  if (pair.length !== 2) throw new Error(`应创建两个 OrbitControls 实例，实际 ${pair.length}`)
  return [pair[0] as MockOrbitControls, pair[1] as MockOrbitControls]
}

describe('ModelComparePanes（CR-012 T-004 / R-030）', () => {
  beforeEach(() => {
    resetMockThreeInstances()
    loader.impl = null
    // WebGL 探测通过（桩 renderer 不触碰真实 GL）
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as CanvasRenderingContext2D,
    )
  })

  afterEach(() => {
    cleanup()
    loader.impl = null
    vi.restoreAllMocks()
  })

  it('双窗各创建一个渲染实例并显示窗名与画布', async () => {
    renderPanes()

    const panes = await waitFor(() => {
      const elements = Array.from(document.querySelectorAll('.compare-pane--model'))
      expect(elements).toHaveLength(2)
      return elements
    })
    expect(panes[0]?.querySelector('.compare-pane__name')?.textContent).toBe('aorta.stl')
    expect(panes[1]?.querySelector('.compare-pane__name')?.textContent).toBe('heart.stl')
    // 双实例：两个 renderer / controls / 材质（各自 Scene，方案 A 的两个渲染实例）
    expect(MockWebGLRenderer.instances).toHaveLength(2)
    expect(MockOrbitControls.instances).toHaveLength(2)
    expect(MockMeshStandardMaterial.instances).toHaveLength(2)
    // 加载成功 + WebGL 可用 → 画布可见，无加载覆盖层
    for (const canvas of document.querySelectorAll('.model-compare-pane__canvas')) {
      expect(canvas.classList.contains('is-hidden')).toBe(false)
    }
    expect(screen.queryByText(/正在加载 3D 模型/)).toBeNull()
  })

  it('左侧交互（change）→ 相机变换复制到右侧；右侧同理反向同步', () => {
    renderPanes()
    const [leftControls, rightControls] = controlsPair()

    // 用户在左侧旋转/平移/缩放：相机位置与控制器目标变化 → OrbitControls 派发 change
    leftControls.camera.position.set(4, -2, 9)
    leftControls.target.set(0.5, 1, 0)
    leftControls.emitChange()

    // 右侧相机变换 = 左侧相机变换（position + target 逐分量断言）
    expect(rightControls.camera.position.x).toBe(4)
    expect(rightControls.camera.position.y).toBe(-2)
    expect(rightControls.camera.position.z).toBe(9)
    expect(rightControls.target.x).toBe(0.5)
    expect(rightControls.target.y).toBe(1)
    expect(rightControls.target.z).toBe(0)
    // 回环防护：左侧状态不被联动传播破坏
    expect(leftControls.camera.position.x).toBe(4)

    // 反向：右侧驱动左侧
    rightControls.camera.position.set(-1, 0.25, 3)
    rightControls.target.set(2, 2, 2)
    rightControls.emitChange()

    expect(leftControls.camera.position.x).toBe(-1)
    expect(leftControls.camera.position.z).toBe(3)
    expect(leftControls.target.x).toBe(2)
    expect(leftControls.target.z).toBe(2)
  })

  it('单侧加载失败降级：错误窗格显示可读错误与重试，另一窗正常渲染', async () => {
    const retry = vi.fn()
    loader.impl = (params) =>
      params.objectUrl === 'blob:left'
        ? {
            status: 'error',
            progress: null,
            geometry: null,
            error: '无法解析该 STL 文件：文件内容为空',
            large: false,
            retry,
          }
        : undefined // 右窗走默认成功桩
    renderPanes()

    const errorText = await screen.findByText(/模型加载失败：无法解析该 STL 文件/)
    expect(errorText).toBeTruthy()
    // 失败窗格提供重试入口（点击触发该窗格自身的 retry）
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(retry).toHaveBeenCalledTimes(1)
    // 另一窗不受影响：第二实例正常创建、其画布可见（错误窗格画布隐藏、无渲染实例）
    expect(MockWebGLRenderer.instances).toHaveLength(1)
    const canvases = Array.from(
      document.querySelectorAll('.model-compare-pane__canvas'),
    ) as HTMLElement[]
    expect(canvases).toHaveLength(2)
    expect(canvases.filter((canvas) => canvas.classList.contains('is-hidden'))).toHaveLength(1)
  })

  it('加载中：各窗展示自身进度', () => {
    loader.impl = () => ({
      status: 'loading',
      progress: { loaded: 50, total: 100 },
      geometry: null,
      error: null,
      large: false,
      retry: () => {},
    })
    renderPanes()

    const progresses = screen.getAllByText('正在加载 3D 模型…（50%）')
    expect(progresses).toHaveLength(2)
    // 进度条宽度跟随各窗进度
    for (const bar of document.querySelectorAll<HTMLElement>('.model3d-viewer__progress-bar')) {
      expect(bar.style.width).toBe('50%')
    }
  })

  it('WebGL 不可用：双窗各自降级提示而非白屏，不崩溃', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    renderPanes()

    const messages = screen.getAllByText(/当前浏览器不支持 WebGL/)
    expect(messages).toHaveLength(2)
    expect(MockWebGLRenderer.instances).toHaveLength(0)
  })

  it('会话失效（刷新后无文件内容）：提示重新导入，不发起加载', () => {
    loader.impl = () => ({
      status: 'idle',
      progress: null,
      geometry: null,
      error: null,
      large: false,
      retry: () => {},
    })
    renderPanes(
      makeModelAsset('m1', 'aorta.stl', undefined),
      makeModelAsset('m2', 'heart.stl', undefined),
    )

    const messages = screen.getAllByText(/会话失效，可重新导入或删除该素材/)
    expect(messages).toHaveLength(2)
  })

  it('退出比较（卸载）：两实例 controls / 材质 / renderer 全部释放（含 WebGL 上下文）', () => {
    renderPanes()
    expect(MockWebGLRenderer.instances).toHaveLength(2)

    cleanup()

    for (const controls of MockOrbitControls.instances) {
      expect(controls.disposed).toBe(true)
    }
    for (const material of MockMeshStandardMaterial.instances) {
      expect(material.disposed).toBe(true)
    }
    for (const renderer of MockWebGLRenderer.instances) {
      expect(renderer.disposed).toBe(true)
      expect(renderer.contextLost).toBe(true) // forceContextLoss 尽快释放上下文
      expect(renderer.animationLoop).toBeNull()
    }
  })
})
