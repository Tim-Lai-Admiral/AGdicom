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