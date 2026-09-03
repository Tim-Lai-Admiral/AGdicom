# Task T-006: 3D 查看器

## Metadata

```yaml
id: T-006
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-003]
branch: feature/CR-001-T-006-3d-viewer
```

## Objective

用 three.js（STLLoader + OrbitControls）实现 STL 3D 查看器：加载进度、旋转/缩放/平移、加载失败重试。

## Context and inputs

- Requirement(s): R-004
- Current architecture/design references: CR-001 ARCHITECTURE.md（three.js）
- Dependency output: T-003 导入

## Scope

Allowed changes:

- `src/features/viewer/model3d/Model3DViewer.tsx`：Canvas + three.js 场景；加载进度条；错误态与重试。
- `src/features/viewer/model3d/useModelLoader.ts`：STLLoader 加载（URL/File）、大文件提示、内存释放（卸载时 dispose）。
- `src/App.tsx`：点击 model 素材打开查看器；内置样本（public/samples/stl/）可直接从素材库加载。
- 视需要 `src/features/viewer/model3d/Model3DViewer.test.ts`（jsdom 限制时以手动验证为主）。

## Out of scope

- GLTF/OBJ 加载（可选扩展，不阻塞）。
- 测量、剖切、多模型同屏对比。

## Expected behavior

1. 打开 STL 素材（含 14MB LA.stl）→ 模型渲染，加载期间显示进度。
2. 拖拽旋转、滚轮缩放、右键平移可用（OrbitControls 默认映射）。
3. 损坏/缺失文件 → 明确错误提示 + 重试按钮，不崩溃。
4. 切换素材/关闭视图时释放 WebGL 资源。

## Acceptance criteria

### Functional

- [ ] 4 个内置 STL（aorta/CB/LA/LVOT）均可渲染。
- [ ] 旋转、缩放、平移三项交互可用。
- [ ] 错误文件提示并可在修复后重试成功。

### Error handling and compatibility

- [ ] WebGL 不可用时显示提示而非白屏。
- [ ] 多次打开/关闭不泄漏明显内存（任务管理器观察或代码层面 dispose 校验）。

### UI (if applicable)

- [ ] 加载进度可见；操作提示（旋转/缩放/平移）文案可见。

## Technical constraints

- 使用 three.js + @types/three；OrbitControls 从 three/examples 导入。
- 不引入 react-three-fiber（保持依赖面小）。

## Implementation notes

- 场景：平行光+环境光、半透明网格线辅助可省；相机默认 fit 模型包围盒。
- 材质 MeshStandardMaterial + 双面，或 MeshNormalMaterial（更快）。

## Test requirements

- [ ] Unit: loader 状态机（loading/error/success）逻辑可测部分。
- [ ] Manual/E2E: 四个 STL + 一个损坏文件验证。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

## Reviewer result

> Reviewer fills this using the Review template.