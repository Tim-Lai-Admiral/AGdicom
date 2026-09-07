# Task T-004: 矩阵与走查收尾

## Metadata

```yaml
id: T-004
cr: CR-009
type: test
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 12
depends_on: [T-003]
branch: feature/CR-009-T-004-finish
```

## Context pack

- Requirement: R-023~R-026 验收收口 + R-020（矩阵）
- 关键文件：`src/App.scenarioMatrix.test.tsx`（视口/工具/元数据断言适配）、`E2E-CHECKLIST.md`（新增视口/工具/抽屉人工项）、`README.md`（已知问题/功能说明更新）、`.ai/CURRENT/`（合并后更新）
- 禁止：行为改动（纯测试/文档）

## Objective

场景矩阵与文档按 R-023~R-026 更新：元数据唯一来源断言、工具/滚轮同步用例、抽屉动画、E2E 人工清单；全量回归。

## Scope

- 矩阵适配/新增：中央无元数据表格 + 右栏唯一（grep 断言）；滚轮↔滑条同步（矩阵内一条）；工具切换冒烟
- E2E-CHECKLIST：新增 §11 视口/工具/抽屉人工项（4~6 条）
- README 已知问题/功能说明同步
- `scripts\verify.ps1` 全绿

## Out of scope

- 行为改动

## Acceptance criteria

- [ ] 矩阵/存量全绿；新断言存在
- [ ] E2E 人工清单可执行；README 一致

## Test requirements

- [ ] Unit/Integration: verify
- [ ] Manual: 清单

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查