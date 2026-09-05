/**
 * 测试 fixture：最小二进制 STL 文件构造器（CR-001 T-006）。
 *
 * 背景：3D 查看器需要真实可被 STLLoader 解析的字节，而内置样本（public/samples/stl/）
 * 体积大（最大 14MB）且不适合在单测中断言。方案：参照 buildDicomFile 的做法，在代码内
 * 手工构造标准二进制 STL——80 字节头 + uint32 三角面数 + 每面 50 字节
 * （法线 3×float32 LE + 3 顶点 9×float32 LE + uint16 属性），默认 4 个三角面组成一个
 * 单位四面体（84 + 50×4 = 284 字节）。
 * 另提供损坏变体覆盖错误路径：声明面数大于实际数据（解析越界）、'solid' 开头但无
 * facet 的无效 ASCII（解析得到 0 三角面，由应用校验报错）。
 *
 * 仅测试使用，不进入应用构建产物（无应用模块导入本文件）。
 */

export interface StlFixtureOptions {
  /** 三角面数；默认 4（四面体）。面数据按四面体 4 个外表面循环复用，保证文件结构自洽 */
  triangles?: number
  /** 损坏模式：文件头声明的面数比实际携带的多 1（解析读取越界 → 报错） */
  inflateFaceCount?: boolean
}

/** 每面字节数：12（法线）+ 36（3 顶点）+ 2（属性） */
const FACE_BYTES = 50
/** 文件头（80 字节）+ 面数字段（4 字节） */
const HEADER_BYTES = 84

type Vec3 = readonly [number, number, number]

interface StlTriangle {
  /** 外法向（单位向量） */
  normal: Vec3
  /** 三顶点，顺序满足右手定则与 normal 一致 */
  vertices: readonly [Vec3, Vec3, Vec3]
}

const SQRT3 = Math.sqrt(3)

/** 单位四面体（顶点在原点与三个单位轴上）的 4 个外表面 */
const TETRAHEDRON_TRIANGLES: readonly StlTriangle[] = [
  { normal: [0, 0, -1], vertices: [[0, 0, 0], [0, 1, 0], [1, 0, 0]] },
  { normal: [0, -1, 0], vertices: [[0, 0, 0], [1, 0, 0], [0, 0, 1]] },
  { normal: [-1, 0, 0], vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 0]] },
  { normal: [1 / SQRT3, 1 / SQRT3, 1 / SQRT3], vertices: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
]

function writeFloat3(view: DataView, offset: number, v: Vec3): void {
  view.setFloat32(offset, v[0], true)
  view.setFloat32(offset + 4, v[1], true)
  view.setFloat32(offset + 8, v[2], true)
}

function writeTriangle(view: DataView, offset: number, triangle: StlTriangle): void {
  writeFloat3(view, offset, triangle.normal)
  writeFloat3(view, offset + 12, triangle.vertices[0])
  writeFloat3(view, offset + 24, triangle.vertices[1])
  writeFloat3(view, offset + 36, triangle.vertices[2])
  view.setUint16(offset + 48, 0, true) // 面属性（无颜色信息）
}

/** 构造最小二进制 STL（默认 4 面四面体，共 284 字节） */
export function buildStlFile(options: StlFixtureOptions = {}): ArrayBuffer {
  const triangles = options.triangles ?? 4
  const bytes = new ArrayBuffer(HEADER_BYTES + triangles * FACE_BYTES)
  const view = new DataView(bytes)
  // 80 字节头：写入可读标识。不能以 'solid' 开头，否则 STLLoader 会按 ASCII 分支解析
  new TextEncoder().encodeInto('binary stl fixture (AGdicom T-006)', new Uint8Array(bytes, 0, 80))
  // 面数：损坏模式下多写 1（STLLoader 按声明面数越界读取 → 抛错）
  view.setUint32(80, options.inflateFaceCount === true ? triangles + 1 : triangles, true)
  for (let i = 0; i < triangles; i += 1) {
    writeTriangle(view, HEADER_BYTES + i * FACE_BYTES, TETRAHEDRON_TRIANGLES[i % 4])
  }
  return bytes
}

/**
 * 无效 ASCII 内容：'solid' 开头但没有任何 facet（总长 ≥84 字节，保证 STLLoader 能读取
 * 面数字段并判定走 ASCII 分支）。解析后得到 0 三角面 → 由应用层校验
 * （position.count === 0）报“未找到有效的三角面”错误。
 */
export function buildInvalidAsciiStl(): ArrayBuffer {
  const text = 'solid broken fixture\nno facet in this file\n' + ' '.repeat(64)
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

/** 空文件（0 字节）：STLLoader 读取头部即越界 → 报错 */
export function buildEmptyStl(): ArrayBuffer {
  return new ArrayBuffer(0)
}
