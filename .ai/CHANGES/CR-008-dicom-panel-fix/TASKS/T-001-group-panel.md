# Task T-001: 左栏患者分组独立面板

## Metadata

```yaml
id: T-001
cr: CR-008
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 18
depends_on: []
branch: feature/CR-008-T-001-group-panel
```

## Context pack

- Requirement: R-021；参考 CR-005 T-002 的 DicomSeriesExpansion（患者组/系列/切片渲染逻辑复用）
- 关键文件：`src/App.tsx`（renderCardExtras 移除 dicom 分支、expandedDicomId 状态重构、左栏分组面板挂载点）、`src/features/workbench/DicomSeriesExpansion.tsx`（改造为独立面板组件，或新建 PatientGroupPanel）、`src/features/library/AssetGrid.tsx`（renderExtras 若仅剩 dicom 用途则一并清理）
- 场景矩阵（CR-007 T-003）断言需同步（左栏层级断言点变化）
- 禁止：改分组/排序语义（R-012/R-019）；改持久化；缩略图逻辑

## Objective

患者分组展示从"逐行挂载"改为左栏独立面板（一次渲染全部组），点击切片不移动面板。

## Scope

- App：`expandedDicomId` → 分组面板展开状态（如 `openPatientPanel: boolean` 或各分组独立展开状态）；`selectAsset` 不再 setExpandedDicomId；`renderCardExtras` 对 dicom 返回 null（并清理 AssetGrid 对仅 dicom 用途的 extras 接线，保留向后兼容 props）
- 组件：独立"患者分组"面板（复用 groupDicomByPatient/ThumbSVG 风格；分组头可折叠；series 行可折叠；切片点击 → onOpenSlice）
- 左栏布局：素材列表 + 分组面板分区（样式沿用 rec 语言）
- 测试：面板渲染一次、点击切片面板不搬家、折叠交互、无元数据占位；场景矩阵适配
- `scripts\verify.ps1` 全绿（339 存量不回归）

## Out of scope

- 高亮实时同步（T-002）；分组语义；3D

## Acceptance criteria

- [ ] 素材行无"展开切片"（grep 无残留）
- [ ] 点击切片：中央打开 + 面板停留原位
- [ ] 场景矩阵相关断言更新后全绿

## Test requirements

- [ ] Unit: 面板组件 + App 集成（矩阵适配）
- [ ] Manual: 批量导入同患者文件核对

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查