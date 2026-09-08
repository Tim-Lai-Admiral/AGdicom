# Task T-003: DICOM 双系列比较

## Metadata

```yaml
id: T-003
cr: CR-012
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 30
depends_on: [T-002]
branch: feature/CR-012-T-003-dicom-compare
```

## Context pack

- Requirement: R-029；关键文件：`src/App.tsx`（compareMode/selectedIds：现仅 image——扩展 dicom；gridAssets 过滤；handleToggleSelect 的 kind 限制）、`src/features/library/CompareView.tsx`（现 image pane 用 imageViewport——改为按 kind 渲染：dicom 复用 DicomViewer 视口能力、model 复用 Model3DViewer）、`src/features/viewer/dicom/DicomViewer.tsx`（视口/工具/滑动条——比较模式复用其视口部分，可能需要抽共享视口组件或双实例）
- 设计要点：
  - 比较模式筛选扩展：image+dicom+model（gridAssets 与提示条文案）；选择两个同 kind 素材进入对应比较视图（image→现视图；dicom→本任务；model→T-004）
  - DICOM 双窗：每窗渲染所属系列切片（复用 DicomViewer 视口：四角/工具/W-L）；同步：切片索引（InstanceNumber 对齐）双向（滚轮/滑条任一侧驱动两侧）；pan/zoom/rotate 同步；W/L 独立（默认）
  - 建议抽 `DicomViewport`（视口+工具+滑动条，无右栏/元数据依赖）供单窗与比较窗复用；若有重构风险，双实例复用现有组件亦可（说明取舍）
- 禁止：改右栏元数据/评审；改测量口径；改图片比较

## Objective

比较模式支持 DICOM：选择两个 dicom 素材（两系列）双窗口并行显示，切片切换与视口变换同步。

## Scope

- CompareView 扩展：kind=dicom 渲染双 DicomViewport
- 同步逻辑：共享 sliceIndex（各系列 InstanceNumber 对齐：若两系列切片数不同，以 index 对齐并钳制）；共享 pan/zoom/rotate 状态；W/L 独立
- App：compareMode 支持 dicom（kind 校验、筛选、提示条文案"选择两个同类型素材"）
- 测试：双窗渲染、切片同步（滚轮/滑条双向）、变换同步、W/L 独立、降级不崩溃、退出清理
- `scripts\verify.ps1` 全绿

## Out of scope

- STL 比较（T-004）；图片比较改造

## Acceptance criteria

- [ ] 选择两个 dicom 素材进入双窗比较（合成样本两系列）
- [ ] 切片任一侧滚动/滑动 → 两侧同步（InstanceNumber 对齐）
- [ ] pan/zoom/rotate 同步；W/L 独立
- [ ] 降级/退出清理正确；存量全绿

## Test requirements

- [ ] Unit: 双窗同步/对齐/降级
- [ ] Manual: 合成样本双系列目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查