# Task T-001: 元数据同步 + 左栏箭头/布局

## Metadata

```yaml
id: T-001
cr: CR-013
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 15
depends_on: []
branch: feature/CR-013-T-001-meta-layout
```

## Context pack

- Requirement: R-031/R-032 + R-022 扩展
- 关键文件：`src/App.tsx`（right 栏 MetadataPanel asset 传参——改为当前切片素材 `activeSliceAssetId ? state.assets[activeSliceAssetId] : activeAsset`；左栏 body 顺序：PatientGroupPanel 移到 AssetGrid 之前）、`src/features/workbench/MetadataPanel.tsx`（接收的 asset 随切片更新——展示当前切片 meta，无需改 props 契约）、`src/features/workbench/PatientGroupPanel.tsx`（分组头/系列行 chevron 旋转）、`src/styles.css`
- 注意：评审面板仍绑定 activeAsset（选中素材）——只有 meta 页签跟随切片；activeSliceAssetId 仅在 DICOM 查看时非空（CR-008 已有清理逻辑）
- 禁止：改元数据/评审契约；改比较

## Objective

右栏元数据随切片滑动同步；左栏箭头旋转；左栏先分组后素材库。

## Scope

- App：metaAsset 计算（activeSliceAssetId 优先）；左栏 body 顺序重排（分组面板上、素材库下；空态与无 DICOM 场景正确）
- PatientGroupPanel：分组头与系列行 chevron（SVG，旋转 -90°/0°，0.15s）
- styles.css：箭头类 + 布局顺序类调整
- 测试：右栏元数据随切片更新（滑动条 → meta 面板 InstanceNumber/文件名变化）、左栏 DOM 顺序、箭头旋转类、空库场景
- `scripts\verify.ps1` 全绿

## Out of scope

- 系列级比较（T-002）

## Acceptance criteria

- [ ] 滑动切片 → 右栏元数据同步（实例号等随切片变化）；评审页签仍绑定选中素材
- [ ] 分组头/系列行箭头随展开态旋转（类名/CSS）
- [ ] 左栏分组面板在素材列表上方（测试断言 DOM 顺序）
- [ ] 空库/无 DICOM 不回归；存量全绿

## Test requirements

- [ ] Unit: 同步/顺序/箭头
- [ ] Manual: 目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查