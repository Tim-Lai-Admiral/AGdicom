/**
 * 测试 fixture：three.js 与 OrbitControls 的轻量桩（CR-012 T-004 组件测试专用）。
 *
 * 背景：jsdom 无 WebGL，真实渲染链路无法建立；而模型比较的同步接线（change →
 * 复制相机变换到对侧）与卸载清理（dispose）恰是 T-004 的核心断言点。方案：
 * vi.mock('three') / vi.mock('three/examples/jsm/controls/OrbitControls.js') 指向本
 * 模块——以可记录的最小类替代真实实现，配合 useModelLoader 桩（测试内替换）驱动
 * 场景 effect 走完整路径。
 *
 * 仅测试使用，不进入应用构建产物（无应用模块导入本文件）。
 * 注：项目 tsconfig 开启 erasableSyntaxOnly，构造器参数属性不可用，字段一律显式声明。
 */

/** 可记录实例的最小 Vector3 桩（仅实现应用代码用到的子集） */
export class MockVector3 {
  x = 0
  y = 0
  z = 0
  set(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }
  copy(v: { x: number; y: number; z: number }): this {
    return this.set(v.x, v.y, v.z)
  }
  addScaledVector(v: { x: number; y: number; z: number }, s: number): this {
    return this.set(this.x + v.x * s, this.y + v.y * s, this.z + v.z * s)
  }
  normalize(): this {
    const length = Math.hypot(this.x, this.y, this.z)
    return length === 0 ? this : this.set(this.x / length, this.y / length, this.z / length)
  }
}

export class MockPerspectiveCamera {
  static instances: MockPerspectiveCamera[] = []
  position = new MockVector3()
  aspect: number
  fov: number
  near: number
  far: number
  disposed = false
  lastLookAt: { x: number; y: number; z: number } | null = null
  constructor(fov: number, aspect: number, near: number, far: number) {
    this.fov = fov
    this.aspect = aspect
    this.near = near
    this.far = far
    MockPerspectiveCamera.instances.push(this)
  }
  updateProjectionMatrix(): void {}
  lookAt(v: { x: number; y: number; z: number }): void {
    this.lastLookAt = { x: v.x, y: v.y, z: v.z }
  }
}

export class MockScene {
  static instances: MockScene[] = []
  background: unknown = null
  children: unknown[] = []
  constructor() {
    MockScene.instances.push(this)
  }
  add(child: unknown): void {
    this.children.push(child)
  }
}

export class MockMesh {
  static instances: MockMesh[] = []
  geometry: unknown
  material: unknown
  constructor(geometry: unknown, material: unknown) {
    this.geometry = geometry
    this.material = material
    MockMesh.instances.push(this)
  }
}

export class MockMeshStandardMaterial {
  static instances: MockMeshStandardMaterial[] = []
  params: Record<string, unknown>
  disposed = false
  constructor(params: Record<string, unknown>) {
    this.params = params
    MockMeshStandardMaterial.instances.push(this)
  }
  dispose(): void {
    this.disposed = true
  }
}

export class MockAmbientLight {
  color: number
  intensity: number
  constructor(color: number, intensity: number) {
    this.color = color
    this.intensity = intensity
  }
}

export class MockDirectionalLight {
  static instances: MockDirectionalLight[] = []
  position = new MockVector3()
  color: number
  intensity: number
  constructor(color: number, intensity: number) {
    this.color = color
    this.intensity = intensity
    MockDirectionalLight.instances.push(this)
  }
}

export class MockColor {
  hex: number
  constructor(hex: number) {
    this.hex = hex
  }
}

/** 可记录实例与 change 监听的最小 OrbitControls 桩 */
export class MockOrbitControls {
  static instances: MockOrbitControls[] = []
  target = new MockVector3()
  camera: MockPerspectiveCamera
  canvas: HTMLCanvasElement
  minDistance = 0
  maxDistance = Infinity
  enableDamping = false
  dampingFactor = 0.05
  disposed = false
  updateCalls = 0
  changeListeners: Array<() => void> = []
  constructor(camera: MockPerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera
    this.canvas = canvas
    MockOrbitControls.instances.push(this)
  }
  addEventListener(type: string, listener: () => void): void {
    if (type === 'change') this.changeListeners.push(listener)
  }
  removeEventListener(type: string, listener: () => void): void {
    if (type === 'change') {
      this.changeListeners = this.changeListeners.filter((item) => item !== listener)
    }
  }
  update(): void {
    this.updateCalls += 1
  }
  dispose(): void {
    this.disposed = true
  }
  /** 测试辅助：模拟用户交互（旋转/平移/缩放）后 OrbitControls 派发的 change 事件 */
  emitChange(): void {
    for (const listener of [...this.changeListeners]) listener()
  }
}

/** 可记录实例的最小 WebGLRenderer 桩（不触碰真实 GL） */
export class MockWebGLRenderer {
  static instances: MockWebGLRenderer[] = []
  params: { canvas: HTMLCanvasElement; antialias?: boolean }
  animationLoop: (() => void) | null = null
  disposed = false
  contextLost = false
  constructor(params: { canvas: HTMLCanvasElement; antialias?: boolean }) {
    this.params = params
    MockWebGLRenderer.instances.push(this)
  }
  setPixelRatio(): void {}
  setSize(): void {}
  setAnimationLoop(callback: (() => void) | null): void {
    this.animationLoop = callback
  }
  render(): void {}
  dispose(): void {
    this.disposed = true
  }
  forceContextLoss(): void {
    this.contextLost = true
  }
}

/** 重置全部实例记录（测试 beforeEach 调用，避免用例间串扰） */
export function resetMockThreeInstances(): void {
  MockPerspectiveCamera.instances = []
  MockScene.instances = []
  MockMesh.instances = []
  MockMeshStandardMaterial.instances = []
  MockDirectionalLight.instances = []
  MockOrbitControls.instances = []
  MockWebGLRenderer.instances = []
}

/** vi.mock('three') 工厂：应用代码从 'three' 导入的名字在此全部提供 */
export const three = {
  AmbientLight: MockAmbientLight,
  Color: MockColor,
  DirectionalLight: MockDirectionalLight,
  DoubleSide: 2,
  Mesh: MockMesh,
  MeshStandardMaterial: MockMeshStandardMaterial,
  PerspectiveCamera: MockPerspectiveCamera,
  Scene: MockScene,
  Vector3: MockVector3,
  WebGLRenderer: MockWebGLRenderer,
}
