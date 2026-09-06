# Task T-004: 审查 Minor 收尾清理

## Metadata

```yaml
id: T-004
cr: CR-005
type: refactor
status: planned
owner: Builder
reviewer: Reviewer
priority: low
expected_steps: 8
depends_on: [T-003]
branch: feature/CR-005-T-004-followup
```

## Context pack

- Requirement: REVIEW-CR005.md 非阻塞发现（.ai/CHANGES/CR-005-dicom-patient-grouping/REVIEW-CR005.md）
- 关键文件：`src/App.tsx`、`src/styles.css`、`src/features/viewer/dicom/seriesUtils.ts`、`src/features/viewer/model3d/__fixtures__/buildStlFile.ts`、`src/features/viewer/model3d/Model3DViewer.test.tsx`
- 禁止：行为/契约改动；测试数量变化（仅注释/死代码）

## Objective

清理 REVIEW-CR005.md 的 Minor 项（死代码/注释/文案），不改行为。

## Scope

1. `src/App.tsx:292` 残留空白 `) : null}`
2. `src/styles.css` 孤儿死 CSS `.library__samples-error`（及 `.library__samples` 如无引用）
3. `seriesUtils.ts` `DicomPatientGroup.key` 注释方向写反修正
4. `buildStlFile.ts:4` 与 `Model3DViewer.test.tsx:24` "内置样本"字眼 → "样本 STL"或中性表述
5. CURRENT 文档：`.ai/CURRENT/REQUIREMENTS.md` 与 `DESIGN.md` 中"加载样本/内置样本"表述按 R-011 更新（文档改动随本任务提交）

## Out of scope

- 行为/契约/测试数变更；R-012 口径变更

## Acceptance criteria

- [ ] 上述 5 项落实；grep 验证（samples-error 类、内置样本字眼按目标清理）
- [ ] `scripts\verify.ps1` 全绿（259 测试不变）
- [ ] 任务卡 Builder result 记录

## Test requirements

- [ ] Unit: `scripts\verify.ps1`

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查