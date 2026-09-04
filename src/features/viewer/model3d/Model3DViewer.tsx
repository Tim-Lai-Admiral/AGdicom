/**
 * 3D 模型查看器（CR-001 T-006 / R-004）。
 *
 * 应用内弹层（role="dialog"，与 DICOM 查看器同构）：three.js WebGLRenderer 渲染
 * STLLoader 解析出的几何体；OrbitControls 提供旋转（左键拖拽）/ 缩放（滚轮）/
 * 平移（右键拖拽），全部使用默认映射不加改，操作提示文案常驻可见。
 *
 * 数据流：useModelLoader 负责 objectUrl → 字节（分块进度）→ 几何体
 * （loading/success/error 状态机 + geometry dispose）；本组件负责场景生命周期——
 * 几何体就绪且 WebGL 可用时初始化一次（灯光 / 相机 fit 包围盒 / 控制器 / 渲染循环 /
 * 尺寸自适应），卸载或几何体更换时完整释放 renderer / controls / 材质。
 *
 * 降级：WebGL 不可用（含测试环境）→ 显示提示而非白屏；文件损坏 / 为空 → 错误 + 重试；
 * 刷新后无会话文件内容 → 提示重新导入。任何路径都不崩溃。
 * 展示内容仅为几何网格预览，不包含任何诊断/治疗暗示。
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
import { useModelLoader } from './useModelLoader.ts'

export interface Model3DViewerProps {
  /** 当前打开的 3D 模型素材 */
  asset: Asset
  /** 关闭查看器（“关闭”按钮与 Esc 键均触发） */
  onClose: () => void
}

/** 探测当前环境 WebGL 可用性（不可用时查看器显示提示而非白屏） */
export function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const probe = document.createElement('canvas')
    return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null
  } catch {
    return false
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export default function Model3DViewer({ asset, onClose }: Model3DViewerProps) {
  const { status, progress, geometry, error, large, retry } = useModelLoader({
    objectUrl: asset.objectUrl,
    fileSize: asset.file.fileSize,
  })
  const webglSupported = useMemo(() => detectWebGLSupport(), [])
  /** 场景初始化失败（WebGL 探测通过但 renderer 创建失败）的可读信息 */
  const [sceneError, setSceneError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // ---- 弹层交互：打开时聚焦关闭按钮；Esc 关闭（与 DICOM 查看器一致） ----
  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

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

    // 材质：双面 + 平直着色（STL 面片观感清晰，与医学网格预览惯例一致）
    const material = new MeshStandardMaterial({
      color: 0xb6c6d8,
      metalness: 0.05,
      roughness: 0.6,
      side: DoubleSide,
      flatShading: true,
    })
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)

    // 相机默认 fit 模型包围盒：不同尺寸的模型开箱可见
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

    // OrbitControls 默认映射：左键旋转 / 滚轮缩放 / 右键平移（验收要求，不改映射）
    const controls = new OrbitControls(camera, canvas)
    controls.target.copy(center)
    controls.minDistance = radius * 0.05
    controls.maxDistance = radius * 50
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.update()

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
      controls.dispose()
      if (resizeObserver !== null) resizeObserver.disconnect()
      window.removeEventListener('resize', setSize)
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss() // 尽快释放 WebGL 上下文（多次开关不泄漏）
    }
  }, [geometry, webglSupported])

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
    <div className="model3d-overlay">
      <section className="model3d-viewer" role="dialog" aria-modal="true" aria-label="3D 模型预览">
        <header className="model3d-viewer__header">
          <h2 className="model3d-viewer__title">3D 模型预览</h2>
          <p className="model3d-viewer__file" title={asset.file.fileName}>
            {asset.file.fileName}（{formatBytes(asset.file.fileSize)}）
          </p>
          <p className="model3d-viewer__esc-hint">按 Esc 也可关闭</p>
          <button
            type="button"
            ref={closeButtonRef}
            className="model3d-viewer__close"
            onClick={onClose}
          >
            关闭
          </button>
        </header>

        {status === 'loading' && large ? (
          <p className="model3d-viewer__notice" role="status">
            {`文件较大（${formatBytes(asset.file.fileSize)}），正在后台读取，请稍候…`}
          </p>
        ) : null}

        <div className="model3d-viewer__stage">
          <canvas
            ref={canvasRef}
            className={
              canvasVisible ? 'model3d-viewer__canvas' : 'model3d-viewer__canvas is-hidden'
            }
            aria-label="3D 模型渲染视图"
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
              {percent === null && progress !== null && progress.loaded > 0 ? (
                <p className="model3d-viewer__loading-bytes">
                  {`已读取 ${formatBytes(progress.loaded)}`}
                </p>
              ) : null}
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
              <p>该素材没有可用的文件内容：刷新后需重新导入该 3D 模型文件</p>
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

        <footer className="model3d-viewer__hints" aria-label="操作提示">
          <span>左键拖拽：旋转</span>
          <span>滚轮：缩放</span>
          <span>右键拖拽：平移</span>
        </footer>
      </section>
    </div>
  )
}
