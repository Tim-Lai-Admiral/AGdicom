# Task T-XXX: <Title>

## Metadata

```yaml
id: T-XXX
cr: CR-XXX # use null for an L0/L1 standalone task
type: feature # feature | bug | architecture | refactor | test | docs
status: planned
owner: Builder
reviewer: Reviewer
priority: normal # low | normal | high | urgent
depends_on: []
branch: feature/CR-XXX-T-XXX-short-title
```

## Objective

<!-- 一句话说明要交付的、可观察的能力。 -->

## Context and inputs

- Requirement(s): R-XXX
- Current architecture/design references: <!-- exact paths/sections -->
- Dependency output: <!-- task/commit/contract; none if no dependency -->
- Context pack: <!-- 本任务适用约束摘要（R-ID、架构/设计要点、关键 API/文件）；Builder 以此为上下文，无需重读整份 CR 文档 -->

## Scope

Allowed changes:

- <!-- module/file/contract -->

## Out of scope

- <!-- 禁止修改的模块或功能 -->
- <!-- 此任务不解决的相邻问题 -->

若必须越界才能完成，停止并按 `.ai/AGENTS.md` 的 `BLOCKED` 格式报告。

## Expected behavior

1. <!-- 用户/系统行为 -->
2. <!-- 边界情况 -->

## Acceptance criteria

### Functional

- [ ] <!-- 可验证条件 -->

### Error handling and compatibility

- [ ] <!-- 错误/边界行为 -->
- [ ] Existing behavior remains compatible: <!-- what to verify -->

### UI (if applicable)

- [ ] <!-- 交互/状态/可访问性 -->

## Technical constraints

- <!-- 必须遵循的接口、模块边界、数据不变量、性能约束。 -->

## Implementation notes

<!-- 建议而非 Requirement；Builder 可在不违反约束前提下选择实现。 -->

## Test requirements

- [ ] Unit: <!-- command or scenario -->
- [ ] Integration: <!-- command or scenario -->
- [ ] Scenario matrix（场景矩阵，R-020）: <!-- 若涉及批量导入/多文件数据流（导入/分组/series/缩略图/批量解析）必填：导入组合矩阵（同系列多文件 / 跨系列 / 无 UID / 混合患者 / 空批次与失败文件）+ 左栏患者组/系列/切片层级断言 + 浏览器手动清单 -->
- [ ] Manual/E2E: <!-- user-visible verification -->

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Relevant documentation updated, if required.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

- Implementation summary:
- Files changed:
- Tests run and result:
- Commit / PR:
- Known limitations / follow-ups:

## Reviewer result

> Reviewer fills this using the Review template.

- Status: PASS / REQUEST CHANGES
- Review document:
