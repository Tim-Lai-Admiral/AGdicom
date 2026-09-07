# Task T-004: 收尾（幽灵文案统一 + TD-001 关闭 + 文档）

## Metadata

```yaml
id: T-004
cr: CR-006
type: docs
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 10
depends_on: [T-003]
branch: feature/CR-006-T-004-finish
```

## Context pack

- Requirement: R-014~R-016 收口
- 关键文件：`README.md`（已知问题更新：删除 TD-001 相关条目、补"刷新自动恢复预览/删除素材"说明）、`.ai/TODO.md`（TD-001 标记已解决/closed）、`src/features/library/ImportZone.tsx` 与查看器占位文案（幽灵提示统一："会话失效，可重新导入或删除"类文案）
- 禁止：行为改动；测试数量变化

## Objective

幽灵相关文案统一、README/TD-001 更新、全量回归确认。

## Scope

1. 幽灵占位提示文案统一（AssetGrid/DicomViewer/Model3DViewer 的"预览不可用/重新导入"提示 → 统一措辞，含"可删除"提示）
2. README：已知问题更新（TD-001 已解决说明：≤20MB 刷新自动恢复；>20MB 需重导入，重导入自动水合）；功能说明补"删除素材"
3. `.ai/TODO.md`：TD-001 标记 resolved（注明 CR-006）
4. `scripts\verify.ps1` 全绿（305 不回归）

## Out of scope

- 行为/契约变更；IndexedDB 逻辑

## Acceptance criteria

- [x] 文案统一（grep 原占位文案无残留）
- [x] README/TODO 与实现一致
- [x] 305 测试全绿

## Test requirements

- [x] Unit: `scripts\verify.ps1`

## Definition of done

- [ ] 验收通过；PR（body 写概要，注明含 T-001~T-003 链，按序合并）；Reviewer 审查

## Builder result

```yaml
status: implemented（未标 done，待 Reviewer 审查）
branch: feature/CR-006-T-004-finish
commit: 2b62ff2
pr: https://github.com/Tim-Lai-Admiral/AGdicom/pull/31
```

### 实现摘要

- 幽灵占位提示统一措辞为「会话失效，可重新导入或删除该素材」：`AssetGrid` / `ImageStage` / `CompareView` / `DicomViewer`（3 条：切片预览 / 元数据+切片预览 / 暂无元数据）/ `Model3DViewer`；`ImportZone` 超限提示补「或删除该素材」。相关注释同步 T-003 后事实（≤20MB 自动恢复 / >20MB 需重导入）。
- README：已知问题第 1 条改写（TD-001 已随 CR-006 解决）；功能一览补「删除素材」「本地预览持久化」两条；持久化描述更新为 localStorage + IndexedDB。
- `.ai/TODO.md`：TD-001 open → closed（注明 CR-006）。
- 测试断言同步新文案（`DicomViewer.test` / `Model3DViewer.test` / `App.blobRestore.test`），测试数量不变。

### 文件清单（12）

`README.md`、`.ai/TODO.md`、`src/App.tsx`（注释）、`src/App.blobRestore.test.tsx`、`src/features/library/AssetGrid.tsx`、`src/features/library/CompareView.tsx`、`src/features/library/ImportZone.tsx`、`src/features/workbench/ImageStage.tsx`、`src/features/viewer/dicom/DicomViewer.tsx`、`src/features/viewer/dicom/DicomViewer.test.tsx`、`src/features/viewer/model3d/Model3DViewer.tsx`、`src/features/viewer/model3d/Model3DViewer.test.tsx`

### 验证结果

- `scripts\verify.ps1` 全绿：**305 tests passed**（无回归、数量不变）+ build OK。

### 已知限制 / 需 Reviewer 关注

- `src/store/blobStore.ts` L143「本地二进制存储（IndexedDB）不可用…刷新后需重新导入恢复预览」为 IndexedDB 不可用时的运行时错误消息（非占位提示），且 blobStore 属卡片 Out of scope（IndexedDB 逻辑），保留原样；如需统一可作后续一行改动。
- 纯文案/文档改动，行为零改动；测试仅改断言文案，未增删用例。