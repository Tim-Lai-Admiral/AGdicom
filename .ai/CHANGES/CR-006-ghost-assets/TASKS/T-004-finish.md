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

- [ ] 文案统一（grep 原占位文案无残留）
- [ ] README/TODO 与实现一致
- [ ] 305 测试全绿

## Test requirements

- [ ] Unit: `scripts\verify.ps1`

## Definition of done

- [ ] 验收通过；PR（body 写概要，注明含 T-001~T-003 链，按序合并）；Reviewer 审查