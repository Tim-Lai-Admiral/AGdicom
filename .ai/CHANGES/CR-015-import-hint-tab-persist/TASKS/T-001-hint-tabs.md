# Task T-001: 备份提示 + 页签全类型/持久化

## Metadata

```yaml
id: T-001
cr: CR-015
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 12
depends_on: []
branch: feature/CR-015-T-001-hint-tabs
```

## Context pack

- Requirement: R-035/R-036
- 关键文件：`src/features/library/ImportZone.tsx`（拖拽提示下加一行提示）、`src/App.tsx`（selectAsset 移除 setRightTab 重置；页签渲染条件从 `kind==='dicom'` 改为所有 activeAsset；showMetaPanel/showDicomReview 调整）、`src/features/workbench/MetadataPanel.tsx`（DICOM 专用，不动）、新增 `src/features/workbench/AssetInfoPanel.tsx`（非 DICOM 文件信息：名称/类型(ASSET_KIND_LABELS)/来源/大小(格式化)/创建/更新时间；复用 .meta-row 样式）
- 细节：
  - 提示文案（精简版）："数据保存在本机浏览器，可经顶栏「导出」备份 JSON"（muted/mono 小字）
  - 页签默认 'review'；切换素材不再重置；DICOM 打开时若上次是 meta 保持 meta（不再强制）
  - 非 DICOM 元数据页签 = AssetInfoPanel；右栏空态文案更新（"选择素材：页签切换元数据/评审"）
- 禁止：改导出/导入功能；改 DICOM MetadataPanel 结构；改评审功能

## Objective

中央导入视图备份提示；右栏页签所有素材可用且跨素材保持选择。

## Scope

- ImportZone 提示行 + 样式
- App：页签渲染条件/rightTab 持久化/空态文案；AssetInfoPanel 接入
- 测试：提示文案断言；页签持久化（图片 A 选元数据→切图片 B 仍元数据并显示文件信息；默认 review；DICOM 不回归）
- `scripts\verify.ps1` 全绿（451 存量不回归）

## Out of scope

- 功能变更；DICOM 元数据分组

## Acceptance criteria

- [ ] 中央导入视图显示备份提示（精简文案）
- [ ] 页签对所有素材显示；切换素材保持页签选择（单测）
- [ ] 非 DICOM 元数据页签显示文件信息（名称/类型/大小/来源/时间）
- [ ] 存量全绿

## Test requirements

- [ ] Unit: 提示/持久化/AssetInfoPanel
- [ ] Manual: 目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查