/**
 * STL 双模型比较窗格（CR-012 T-004 / R-030）。
 *
 * CompareView kind=model 的渲染体：两个独立的 three.js 渲染实例（各自 Scene /
 * Renderer / 相机 / OrbitControls，各自 fit 包围盒），由 CompareView 以 React.lazy
 * 按需加载（TD-002：three.js 不进首屏主包）。
 *
 * 同步方案 A（modelViewSync.ts）：任一侧 OrbitControls 派发 change（左键旋转 /
 * 滚轮缩放 / 右键平移，均默认映射）→ 把该侧相机 position + controls target 完整
 * 复制到另一侧；朝向由 lookAt(target) 推导，两侧一致。初始 fit 各自独立（两模型
 * 尺寸不同也开箱可见），首次用户交互起两侧视图保持一致。
 *
 * 数据流与降级（与单窗 Model3DViewer 同构）：每窗独立 useModelLoader（objectUrl →
 * 字节分块进度 → STLLoader 解析），各自展示加载进度 / 错误 + 重试 / 会话失效 /
 * WebGL 不可用降级——单侧失败不影响另一侧，任何路径不崩溃。
 *
 * 清理：退出比较（组件卸载）时逐窗释放 controls / 材质 / renderer（含
 * forceContextLoss 尽快释放 WebGL 上下文），参与者注销由 modelViewSync 的
 * register 返回函数承担。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Asset } from '../../../domain/types.ts'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { detectWebGLSupport } from './Model3DViewer.tsx'
import { useModelLoader } from './useModelLoader.ts'
import type { ModelPaneId } from './modelViewSync.ts'
import { createModelViewSync } from './modelViewSync.ts'

export interface ModelComparePanesProps {
  /** 左侧模型素材（先选中的；与 right 同类型，由 App 的选择约束保证） */
  left: Asset
  /** 右侧模型素材（后选中的） */
  right: Asset
}

/** 单侧模型窗格：画布 + 各自加载进度/错误/降级覆盖层 + 窗名 */
function ModelComparePane({
  asset,
  paneId,
  sync,
}: {
  asset: Asset
  paneId: ModelPaneId
  sync: ReturnType<typeof createModelViewSync>
}) {
  const { status, progress, geometry, error, retry } = useModelLoader({
    objectUrl: asset.objectUrl,
    fileSize: asset.file.fileSize,
  })
  const webglSupported = useMemo(() => detectWebGLSupport(), [])
  /** 场景初始化失败（WebGL 探测通过但 renderer 创建失败）的可读信息 */
  const [sceneError, setSceneError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ---- three.js 场景生命周期：初始化一次；几何体更换 / 卸载时完整释放 ----
  useEffect(() => {
    if (geometry === null || !webglSupported) return
    const canvas = canvasRef.current
    if (canvas === null) return
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true })
    } catch {
      setSceneError('初始化 WebGL 渲染器失败，无法显示 3D 模型')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const scene = new Scene()
    scene.background = new Color(0x10141a)
    scene.add(new AmbientLight(0xffffff, 0.5))
    const keyLight = new DirectionalLight(0xffffff, 2.0)
    keyLight.position.set(1, 1.4, 0.9)
    scene.add(keyLight)
    const fillLight = new DirectionalLight(0xffffff, 0.7)
    fillLight.position.set(-0.8, -0.5, -1)
    scene.add(fillLight)

    // 材质：双面 + 平直着色（与单窗 3D 查看器一致的 STL 面片观感）
    const material = new MeshStandardMaterial({
      color: 0xb6c6d8,
      metalness: 0.05,
      roughness: 0.6,
      side: DoubleSide,
      flatShading: true,
    })
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)

    // 相机默认 fit 本窗模型包围盒（两侧各自 fit；交互后由同步器对齐视图）
    geometry.computeBoundingSphere()
    const sphere = geometry.boundingSphere
    const radius = Math.max(sphere?.radius ?? 1, 1e-4)
    const center = sphere?.center ?? new Vector3()
    const fovY = (50 * Math.PI) / 180
    const distance = (radius / Math.sin(fovY / 2)) * 1.1
    const viewDirection = new Vector3(1, 0.55, 0.85).normalize()
    const camera = new PerspectiveCamera(
      50,
      1,
      Math.max(radius * 0.01, 1e-4),
      distance + radius * 100,
    )
    camera.position.copy(center).addScaledVector(viewDirection, distance)
    camera.updateProjectionMatrix()

    // OrbitControls 默认映射（左键旋转 / 滚轮缩放 / 右键平移），与单窗一致不改映射
    const controls = new OrbitControls(camera, canvas)
    controls.target.copy(center)
    controls.minDistance = radius * 0.05
    controls.maxDistance = radius * 50
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.update()

    // ---- 同步方案 A 接线：change → 复制本侧视图到对侧；本侧作为参与者接收对侧状态 ----
    const unregister = sync.register(paneId, {
      getViewState: () => ({
        position: [camera.position.x, camera.position.y, camera.position.z] as const,
        target: [controls.target.x, controls.target.y, controls.target.z] as const,
      }),
      applyViewState: (state) => {
        camera.position.set(state.position[0], state.position[1], state.position[2])
        controls.target.set(state.target[0], state.target[1], state.target[2])
        // 刷新控制器内部球坐标并 lookAt 对准目标点（渲染循环随后的 update 沿用新位姿）
        controls.update()
      },
    })
    const onControlsChange = (): void => {
      sync.propagate(paneId)
    }
    controls.addEventListener('change', onControlsChange)

    const setSize = (): void => {
      const width = canvas.clientWidth || 1
      const height = canvas.clientHeight || 1
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    setSize()
    window.addEventListener('resize', setSize)
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(setSize) : null
    if (resizeObserver !== null) resizeObserver.observe(canvas)

    renderer.setAnimationLoop(() => {
      controls.update()
      renderer.render(scene, camera)
    })

    return () => {
      renderer.setAnimationLoop(null)
      controls.removeEventListener('change', onControlsChange)
      unregister()
      controls.dispose()
      if (resizeObserver !== null) resizeObserver.disconnect()
      window.removeEventListener('resize', setSize)
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss() // 尽快释放 WebGL 上下文（多次开关比较不泄漏）
    }
  }, [geometry, webglSupported, paneId, sync])

  // 几何体更换（重试成功）时清除上一轮场景错误
  useEffect(() => {
    setSceneError(null)
  }, [geometry])

  const percent =
    progress !== null && progress.total > 0
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : null
  const canvasVisible = status === 'success' && webglSupported && sceneError === null

  return (
    <figure className="compare-pane compare-pane--model">
      <div className="compare-pane__viewport compare-pane__viewport--model">
        <canvas
          ref={canvasRef}
          className={
            canvasVisible ? 'model-compare-pane__canvas' : 'model-compare-pane__canvas is-hidden'
          }
          aria-label={`素材“${asset.name}”的 3D 渲染视图`}
        />

        {status === 'loading' ? (
          <div className="model3d-viewer__overlay" role="status">
            <p className="model3d-viewer__loading-text">
              {percent !== null ? `正在加载 3D 模型…（${percent}%）` : '正在加载 3D 模型…'}
            </p>
            <div className="model3d-viewer__progress">
              <div
                className="model3d-viewer__progress-bar"
                style={{ width: `${percent ?? 8}%` }}
              />
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="model3d-viewer__overlay model3d-viewer__overlay--error" role="alert">
            <p>模型加载失败：{error}</p>
            <button type="button" className="model3d-viewer__retry" onClick={retry}>
              重试
            </button>
          </div>
        ) : null}

        {asset.objectUrl === undefined && status === 'idle' ? (
          <div className="model3d-viewer__overlay" role="alert">
            <p>该素材没有可用的文件内容：会话失效，可重新导入或删除该素材</p>
          </div>
        ) : null}

        {status === 'success' && !webglSupported ? (
          <div className="model3d-viewer__overlay" role="alert">
            <p>当前浏览器不支持 WebGL，无法显示 3D 模型；请更换支持 WebGL 的现代浏览器。</p>
          </div>
        ) : null}

        {sceneError !== null ? (
          <div className="model3d-viewer__overlay model3d-viewer__overlay--error" role="alert">
            <p>{sceneError}</p>
          </div>
        ) : null}
      </div>
      <figcaption className="compare-pane__name" title={asset.name}>
        {asset.name}
      </figcaption>
    </figure>
  )
}

/**
 * STL 双模型比较：两实例并排（先选在左），相机同步由共享的 modelViewSync 承担
 * （组件随比较会话挂载/卸载，实例随之整体创建与释放）。
 */
export default function ModelComparePanes({ left, right }: ModelComparePanesProps) {
  // 比较会话生命周期内的同步器（useMemo 保证窗格重渲染不重建、参与者不丢注册）
  const sync = useMemo(() => createModelViewSync(), [])
  return (
    <div className="compare__panes">
      <ModelComparePane key={left.id} asset={left} paneId="left" sync={sync} />
      <ModelComparePane key={right.id} asset={right} paneId="right" sync={sync} />
    </div>
  )
}
