# Task T-003: 测试适配 + 矩阵更新 + 文档

## Metadata

```yaml
id: T-003
cr: CR-011
type: test
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 12
depends_on: [T-002]
branch: feature/CR-011-T-003-matrix-docs
```

## Context pack

- Requirement: R-002 实现细化 + R-020（矩阵）；关键文件：`src/App.test.tsx`、`src/App.workbench.test.tsx`、`src/App.scenarioMatrix.test.tsx`（比较相关用例语义改显式模式）、`src/features/library/AssetGrid.test.tsx`（行 aria-label 模式化）、`E2E-CHECKLIST.md`、`README.md`
- 禁止：产品行为改动（纯测试/文档）

## Objective

比较显式模式的测试语义全面适配（P-005：语义适配说明）；矩阵补充比较模式场景；E2E/README 同步。

## Scope

- 存量测试适配：原"点击图片=选中/比较"用例 → 显式模式（进入比较模式→选择→比较；普通模式点击=查看）
- 矩阵：新增比较模式场景（进入模式筛选断言、选择满2比较、退出恢复）
- E2E-CHECKLIST：比较相关人工项更新
- README：功能说明更新（比较显式模式、汉字按钮）
- `scripts\verify.ps1` 全绿

## Out of scope

- 行为改动

## Acceptance criteria

- [ ] 存量/矩阵全绿；新断言存在（比较模式筛选/退出）
- [ ] E2E/README 与实现一致

## Test requirements

- [ ] Unit/Integration: verify.ps1
- [ ] Manual: 清单

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查