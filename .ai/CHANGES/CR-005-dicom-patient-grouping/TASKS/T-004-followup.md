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

## Builder result

- **实现摘要**：落实 REVIEW-CR005.md 全部 5 项 Minor/non-blocking 清理，零行为/契约/测试数变化：
  1. `src/App.tsx:292`：`)           : null}` → `) : null}`（格式残留）。
  2. `src/styles.css`：删除孤儿死 CSS `.library__samples-error`（862 定义块 + 1722/1733 两处组合选择器）；节注释同步移除"样本加载失败"字样。`.library__samples`（无 -error）在 styles.css 无定义、src 无引用，无需处理。
  3. `seriesUtils.ts:104`：`DicomPatientGroup.key` 注释方向订正为"已知键含 \0 分隔符，'unknown' 不含 \0，不会冲突"。
  4. "内置样本"字眼中性化：`buildStlFile.ts` 注释改为"真实样本 STL"（同时移除已删除的 `public/samples/stl/` 路径引用）；`Model3DViewer.test.tsx:24` fixture `source: '内置样本'` → `'样本 STL'`。`App.test.tsx` 中 3 处"内置样本"为 R-011 移除回归断言，按范围保留。
  5. CURRENT 文档按 R-011 更新：`REQUIREMENTS.md` R-004 移除"内置样本加载入口"（标注已按 R-011 移除）、UI-001 移除"加载样本"；`DESIGN.md` Primary flow 移除"加载样本"。
- **文件清单**：`src/App.tsx`、`src/styles.css`、`src/features/viewer/dicom/seriesUtils.ts`、`src/features/viewer/model3d/__fixtures__/buildStlFile.ts`、`src/features/viewer/model3d/Model3DViewer.test.tsx`、`.ai/CURRENT/REQUIREMENTS.md`、`.ai/CURRENT/DESIGN.md`（共 7 文件，+11/−23）。
- **验证结果**：grep `library__samples|samples-error` → src 0 命中；`scripts\verify.ps1` 全绿（259 passed / 29 文件 + tsc/vite build OK），与基线一致。
- **commit**：`1e95b0e`（分支 `feature/CR-005-T-004-followup`）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/26
- **已知限制 / 需 Reviewer 关注**：
  - `.ai/CURRENT/PRODUCT.md:33,38` 仍有"内置样本加载/内置样本"表述，不在本任务卡范围（卡片仅列 REQUIREMENTS.md 与 DESIGN.md），建议后续 CURRENT 收口时一并处理。
  - 工作区存在未跟踪的 `REVIEW-CR005.md`（Reviewer 文档），未随本任务提交，归属 Reviewer。
  - REVIEW-CR005.md 中"登记 R-011/R-012/R-013 到 CURRENT"属合并后 CURRENT 收口，超出本任务范围，未处理。