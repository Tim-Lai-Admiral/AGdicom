# Task T-007: 标注与评审结论

## Metadata

```yaml
id: T-007
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-002]
branch: feature/CR-001-T-007-review"
```

## Objective

实现评审面板：标签管理（自建）、备注、评审状态与意见、评审历史（时间戳留痕）、JSON 导出/导入（可追溯）。

## Context and inputs

- Requirement(s): R-005
- Current architecture/design references: CR-001 DESIGN.md（评审面板）、ARCHITECTURE.md（store 导入导出）
- Dependency output: T-002 领域模型与仓储

## Scope

Allowed changes:

- `src/features/review/ReviewPanel.tsx`：标签增删（含自建）、备注编辑、状态选择、评审意见输入。
- `src/features/review/ReviewHistory.tsx`：历史列表（时间戳 + 状态 + 意见）。
- `src/domain/review.ts`：评审记录追加、历史合并（T-002 已建基座，此处完善）。
- `src/features/review/ExportImport.tsx`：导出 JSON 下载、导入 JSON 恢复（含冲突提示）。
- `src/features/review/*.test.ts`：单测。
- `src/App.tsx`：布局接线（侧栏/抽屉）。

## Out of scope

- AI 建议（T-008）。
- 多选批量评审（可选扩展）。

## Expected behavior

1. 对任一素材可增删标签（自建标签全局可复用）、编辑备注、设置状态与评审意见。
2. 每次评审保存形成历史记录（追加式，时间戳留痕），刷新不丢。
3. 导出 JSON（schema v1，含素材清单与全部评审记录）可下载；导入可还原；名称冲突提示。

## Acceptance criteria

### Functional

- [ ] 标签/备注/状态/意见持久化，刷新保留。
- [ ] 评审历史为追加式，多次评审均可见且按时间排序。
- [ ] 导出→清空→导入 往返还原一致。
- [ ] 导入版本不符或结构非法时拒绝并提示。

### Error handling and compatibility

- [ ] 导出/导入失败有明确提示（浏览器限制下载/文件读取失败）。

### UI (if applicable)

- [ ] 面板在窄屏折叠为抽屉可展开。
- [ ] 保存成功有反馈（状态提示）。

## Technical constraints

- 复用 T-002 仓储与 schema；schema 版本变更必须升版本并兼容旧版本导入。

## Implementation notes

- 导出文件名建议 `review-export-YYYYMMDD-HHmmss.json`。

## Test requirements

- [ ] Unit: 标签增删、历史追加排序、导出导入往返、非法导入拒绝。
- [ ] Manual/E2E: 完整"导入→标注→评审→导出→导入还原"链路。

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