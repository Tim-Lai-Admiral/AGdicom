# Task T-004: STL 双模型比较 + 比较模式扩展收尾

## Metadata

```yaml
id: T-004
cr: CR-012
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 20
depends_on: [T-003]
branch: feature/CR-012-T-004-stl-compare
```

## Context pack

- Requirement: R-030 + R-029 收尾；关键文件：`src/features/viewer/model3d/Model3DViewer.tsx`（three.js 查看器：渲染循环/OrbitControls/加载——比较模式需要双实例 + 共享相机或同步变换）、`src/features/library/CompareView.tsx`（kind=model 渲染）、`src/App.tsx`（kind 校验已完成 image+dicom 扩展——model 加入）
- 设计要点：
  - STL 双窗：两实例（各自 Scene）；同步方案二选一并说明：A) 共享一个 OrbitControls 目标 + 复制 camera 变换（推荐，简单可靠）；B) 双向事件同步
  - 加载：各自进度/错误；懒加载（T-010 已 lazy 拆包）
  - 退出/清理：dispose 两实例
- 禁止：改单窗 3D 行为；改 DICOM 比较

## Objective

比较模式支持 STL：两模型并行渲染，旋转/平移/缩放同步；比较模式素材选择（image/dicom/model）收尾。

## Scope

- CompareView kind=model：双 three.js 实例 + 相机变换同步（旋转/平移/缩放）
- App：compareMode 支持 model（kind 校验、筛选、提示文案）
- 场景矩阵：比较模式选择矩阵扩展（image/dicom/model 各一对）断言
- E2E-CHECKLIST/README：比较扩展说明更新
- `scripts\verify.ps1` 全绿

## Out of scope

- 图片比较改造；模型测量

## Acceptance criteria

- [ ] 选择两个 STL 进入双窗并排渲染（样本模型）
- [ ] 任一侧旋转/平移/缩放 → 另一侧同步
- [ ] 加载失败/降级不崩溃；退出 dispose 清理
- [ ] 矩阵/文档更新；存量全绿

## Test requirements

- [ ] Unit: 双实例同步逻辑（相机变换）
- [ ] Manual: 两 STL 目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **实现摘要**：比较模式扩展 STL 双模型比较（R-030）+ 比较可选类型收尾（image/dicom/model，
  R-029+R-030）。同步方案采用任务卡**方案 A：共享 OrbitControls 目标 + 复制相机变换**——
  新增纯逻辑同步器 `modelViewSync.ts`（任一侧视图状态 = 相机 position + controls target
  变化 → 完整复制到另一侧；朝向由 lookAt(target) 推导、两侧 Up 一致故同步；`propagate`
  执行期 `syncing` 守卫吸收 applyViewState 联动 change 的回环，等值幂等复制必然收敛；
  相比双向事件同步无事件竞态、状态唯一）。渲染层 `ModelComparePanes.tsx`（CompareView 经
  React.lazy 按需加载，保持 TD-002 three.js 不进首屏主包）：两个独立 three.js 实例
  （各自 Scene/Renderer/相机 fit 包围盒/OrbitControls 默认映射），OrbitControls change →
  `propagate`，每窗独立 `useModelLoader`（分块进度/错误重试/会话失效/WebGL 降级单侧互不
  影响）；卸载逐窗 dispose（controls/材质/renderer + forceContextLoss，参与者注销）。
  初始 fit 各自独立（不同尺寸模型开箱可见），首次用户交互起两侧视图一致。App/AssetGrid：
  `COMPARE_SELECTABLE_KINDS` 加 `'model'`、比较模式 model 行呈「加入比较」语义、配对类型
  提示条与混选拒绝对 model 生效；模型比较不显示顶栏工具组（与图片比较同一 R-024 契约）。
- **文件清单**：新增 `src/features/viewer/model3d/modelViewSync.ts`（+7 单测）、
  `src/features/viewer/model3d/ModelComparePanes.tsx`（+7 组件测试，three/OrbitControls/
  useModelLoader 桩驱动场景 effect）、`src/features/viewer/model3d/__fixtures__/mockThree.ts`
  （测试桩）；修改 `src/features/library/CompareView.tsx`（kind=model 分派 + Suspense/lazy）、
  `src/features/library/AssetGrid.tsx`（isComparable 含 model 行）、`src/App.tsx`、
  `src/styles.css`（模型窗格样式）及测试 `CompareView.test.tsx`（+1 分派用例）、
  `App.test.tsx`（model-only 入口启用、混选/配对约束扩展）、`App.scenarioMatrix.test.tsx`
  （+STL 双模型比较集成场景、筛选期望更新）；文档 `E2E-CHECKLIST.md`、`README.md`。
- **验证结果**：`scripts/verify.ps1` 全绿（43 文件 441 测试通过；`tsc -b && vite build`
  成功）。覆盖：相机变换复制（position+target 逐分量，左右双向）、回环防护收敛、缺侧
  无操作、注销幂等、双实例创建与 dispose 全释放（含上下文）、单侧错误降级另一窗不受影响、
  进度/WebGL 降级/会话失效；App 级集成（选两个 STL →「模型比较」双窗先选在左 → 退出恢复、
  model-only 入口启用、三类混选拒绝）。构建产物：`ModelComparePanes-*.js` 4.55 kB 独立
  chunk，three.js 仍在 `Model3DViewer-*.js`（553 kB）按需加载，主包不含 three（TD-002
  契约保持）。Manual（真机 WebGL 双 STL 目检 + 拖拽同步）留待 Reviewer 按任务卡执行。
- **commit**：`8811163`（分支 `feature/CR-012-T-004-stl-compare`，基于 T-003 分支，含
  T-001~T-003 提交链）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/55
  （body 注明按序合并 #52 → #53 → #54 → 本 PR）。
- **已知限制/技术债**：① 初始 fit 各自独立：一侧加载完成前对侧的交互不会被补同步
  （各自 fit 是任务卡设计要点，两侧就绪后任一交互即对齐）；② 同步以 position+target
  为唯一状态、朝向由 lookAt 推导——双侧同时存在惯性阻尼残差时可能有一帧级微抖
  （OrbitControls damping 语义下固有，复制幂等保证收敛）；③ model 比较复用
  `.model3d-viewer__overlay` 系覆盖层样式（与单窗视觉一致，未另建一套类名）。
- **需 Reviewer 关注**：① 同步方案 A 的落地口径（modelViewSync 纯逻辑 + 窗格适配，
  单测直接断言相机变换复制）；② `ModelComparePanes` 经 CompareView 内 `React.lazy`
  加载而非进 App 的 lazy 清单——three.js 依赖仍在异步 chunk（构建产物已验证）；
  ③ AssetGrid `isComparable` 扩展到 model 行（比较模式行语义变化），普通模式 model 行
  「查看 3D 模型」语义不变；④ 真机 Manual 验收项（E2E-CHECKLIST §4/§12 人工条目）。