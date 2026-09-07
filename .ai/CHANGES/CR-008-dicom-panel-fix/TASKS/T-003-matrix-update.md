# Task T-003: 场景矩阵与手动清单更新

## Metadata

```yaml
id: T-003
cr: CR-008
type: test
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 10
depends_on: [T-002]
branch: feature/CR-008-T-003-matrix-update
```

## Context pack

- Requirement: R-020（场景矩阵）+ R-021/R-022 断言
- 关键文件：`src/App.scenarioMatrix.test.tsx`（矩阵断言适配：左栏层级断言改为"独立面板"口径；新增"点击切片面板不搬家"与"滑动条高亮跟随"用例）、`E2E-CHECKLIST.md`（§10 更新人工项）
- 禁止：产品行为改动（纯测试/文档）

## Objective

场景矩阵与手动清单按 R-021/R-022 更新：面板结构断言 + 高亮联动断言。

## Scope

- 矩阵用例更新：左栏"分组面板"层级断言（替代逐行展开口径）；新增：点击分组切片后面板位置不变（渲染位置断言）、滑动条切换 → 高亮跟随（mock 或事件驱动）
- E2E-CHECKLIST §10：面板交互与高亮人工项更新
- `scripts\verify.ps1` 全绿

## Out of scope

- 行为改动

## Acceptance criteria

- [ ] 矩阵相关用例全绿；新增两项断言存在
- [ ] 手动清单可执行

## Test requirements

- [ ] Unit/Integration: 矩阵
- [ ] Manual: 清单

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查