# Task T-002: 领域模型与存储

## Metadata

```yaml
id: T-002
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-001]
branch: feature/CR-001-T-002-domain-store
```

## Objective

定义 Asset / DicomMeta / ReviewRecord 等领域类型，实现 localStorage 仓储与 JSON 导入/导出（schema v1）。

## Context and inputs

- Requirement(s): R-005, R-009
- Current architecture/design references: CR-001 ARCHITECTURE.md（domain/store 模块）
- Dependency output: T-001 脚手架

## Scope

Allowed changes:

- `src/domain/types.ts`：AssetKind、AssetStatus、Asset、DicomMeta、ReviewRecord、ReviewHistory、Tag、AppState。
- `src/domain/review.ts`：状态流转与评审记录纯函数（增改历史、时间戳）。
- `src/store/repository.ts`：localStorage 读写（单 key，JSON 序列化，容量/损坏容错）。
- `src/store/io.ts`：JSON 导出（schema 版本 + 时间戳）与导入校验/恢复、名称冲突提示。
- `src/domain/*.test.ts`：vitest 单测。

## Out of scope

- 素材导入/文件处理（T-003）。
- UI 组件。

## Expected behavior

1. 仓储可保存/读取资产与评审记录；损坏数据回退空状态不崩溃。
2. 导出 JSON 含 `schemaVersion: 1` 与 `exportedAt`；导入可还原且版本不符时拒绝并提示。
3. 评审记录为追加式历史（每次评审意见留痕）。

## Acceptance criteria

### Functional

- [ ] 单测覆盖：仓储读写往返、损坏数据容错、评审历史追加、导入导出往返、版本不符拒绝。
- [ ] 导出文件含 schemaVersion 与 exportedAt。

### Error handling and compatibility

- [ ] localStorage 满或损坏时有提示与回退。
- [ ] Existing behavior remains compatible: 无既有行为。

### UI (if applicable)

- 不涉及。

## Technical constraints

- 类型集中在 `src/domain/types.ts`，其余模块不得自行定义领域类型。
- 导出 schema 一经发布不静默变更；变更须升版本。

## Implementation notes

- 资产 ID 使用 `crypto.randomUUID()`。
- localStorage key 如 `ag-review-workbench:v1`。

## Test requirements

- [ ] Unit: `npm test` 覆盖上述场景。

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