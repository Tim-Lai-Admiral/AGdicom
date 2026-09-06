# Review: CR-004（T-001 PR #20 + T-002 PR #21）

## Metadata

```yaml
task: T-001 (PR #20) + T-002 (PR #21)
cr: CR-004
reviewer: Reviewer
target_commit_or_pr: "PR #20 (feature/CR-004-T-001-ui-figma-align @36ba0c2) / PR #21 (feature/CR-004-T-002-test-trim @bd03bc3)"
date: 2026-09-06
result: REQUEST_CHANGES
```

## 审查范围与方法

- 按 `.ai/AGENTS.md` 规则 7 审 PR（`gh pr diff 20/21`），不以 working tree 为准。
- 复跑验证：`git checkout <branch>` → `scripts\verify.ps1`（两次），并 `git merge-tree` 只读探测两 PR 合流冲突。
- 注：`gh pr checkout` 因代理网络失败（127.0.0.1:443），改用本地同名分支（HEAD 与 PR head 一致：T-001=36ba0c2，T-002=bd03bc3）完成全部复跑；`gh pr checks 20/21` 均显示 verify pass（见下方）。

## Scope and requirement check

| Check | T-001 | T-002 | Evidence / note |
|---|---|---|---|
| Task objective satisfied | pass | pass | T-001 左栏行式列表/顶栏图标化/StatusDot/删卡片与评审按钮全部落地；T-002 24 个同质化测试逐条删除 |
| Acceptance criteria | pass（见下方视觉项） | fail（数字 246 未达成，见 Finding M1） | T-001 grep 无 `.asset-card/.status-badge/评审按钮/onSetStatus/onOpenReview` 残留；T-002 删 24 无错删 |
| No out-of-scope changes | pass | pass | domain/store 未动；无功能/契约变更；无未授权能力引入 |
| CURRENT/architecture respected | pass | pass | UI-003 / P-005 需求对齐；核心层测试全保留 |

## 复跑测试结果（独立验证，非 Builder 声明）

| Verification | Result | Evidence |
|---|---|---|
| T-001 verify.ps1 | pass | 28 文件 / **270** 测试通过 + `tsc -b && vite build` OK（274→270：删 StatusBadge 6 用例、新增 StatusDot 2 用例，净 -4，与卡一致） |
| T-002 verify.ps1 | pass | 28 文件 / **250** 测试通过 + build OK（master 基线 274 − 24 = 250，删除清单 100% 落实） |
| `gh pr checks 20` / `21` | pass | 均 `verify pass`（45s / 55s） |
| 两 PR 合流（merge-tree） | fail | `src/features/library/AssetGrid.test.tsx` **CONFLICT**（见 Blocker B1） |
| 浏览器目检（rec/ 对照） | not run | Builder 与 Reviewer 均无法在 CLI 完成；需 Human 浏览器确认（见 Minor M4） |

核心层测试未动确认（T-002）：`domain/filter 14、domain/review 16、store/io 16、store/repository 8、parseDicom 14、decodePixel 24、seriesUtils 7、measure 8、windowLevel 3、mockProvider 10、importAssets 15、useModelLoader 13、buildDicomFile 2` 全部保留且通过。

## Findings

### Blocker

- **B1：T-002 未遵守 `depends_on: [T-001]`，与 T-001 合流冲突（`src/features/library/AssetGrid.test.tsx`）**
  T-002 任务卡声明 `depends_on: [T-001]`，但分支基于 master（基线 274）而非 T-001 之上。T-001 将 `shows the type glyph placeholder for dicom and model cards` 与 `keeps dicom cards non-interactive...` 重命名为 `...rows` 并改写断言（`src/features/library/AssetGrid.test.tsx`）；T-002 又按卡内清单删除这两个用例（基于 master 的 "cards" 版本）。`git merge-tree --write-tree feature/CR-004-T-001-ui-figma-align feature/CR-004-T-002-test-trim` 实测输出 `CONFLICT (content): Merge conflict in src/features/library/AssetGrid.test.tsx`。
  建议：待 T-001 合入后，Builder 将 T-002 rebase 到新 master，把这两处删除重放到重命名后的用例上（删除意图不变，仍应删 `...rows` 两用例），再 push 并请求复评。属流程缺陷，非代码正确性缺陷，但合流前必须解决（AGENTS.md §6 规则 15：冲突须显式解决）。

### Major

- **M1：P-005 数字目标与实际不符，需 REVISION 更正或 Human 明确接受（REQUIREMENTS.md:42 / T-002 卡:51）**
  REQUIREMENTS.md P-005 验收写「预计 270 → ~246」，T-002 卡验收写「预期 246 测试」；实测 250。根因是 CR 估算基线 270，但 master 实际基线为 274（T-001 另开分支，未含 T-001 的 -4）。本次净删除恰为 24、清单 100% 落实，属**文档基线估算误差**而非实现错误。按 AGENTS.md §8，需以 REVISION-N.md 更正 P-005 目标数字（274 → 250），或由 Planner/Human 明确接受 250。此事项不阻塞代码，但阻塞「验收标准数字」达成。

### Minor / non-blocking

- **M2：顶栏导入/导出按钮 `is-active` 类与样式选择器不匹配，激活高亮失效（TopToolbar.tsx:109 / :142 vs index.css:151）**
  TopToolbar 使用 `tool-btn is-active`，但 rec 迁移样式只定义了 `.tool-btn.active`（index.css:151），无 `.tool-btn.is-active` 规则。导入/导出按钮激活态（`aria-pressed`/`aria-expanded` 仍在、可访问性与测试不受影响）视觉高亮丢失。右栏开关已用内联 `color: var(--accent)` 正确表达激活态，二者处理不一致。建议统一为 `.tool-btn.active` 或补 `.is-active` 规则。

- **M3：T-002 卡内 Filters 条目文案与实现不符（T-002 卡:38）**
  卡写 `preserves the other conditions when a single control changes (AND)`，实际测试标题为 `(AND 组合)`（src/features/library/Filters.test.tsx）。删除目标正确、无误删，仅文案差异；Builder 已在 PR body 说明 AssetGrid 的 "rows/cards" 差异，但未提及 Filters 此处。建议顺带在 Builder result 补一句。

- **M4：Manual 浏览器全链路目检未完成（T-001 卡 Test requirements）**
  左栏行/顶栏/右栏视觉与全链路功能需 `npm run dev` 目检（对照 rec/ 截图）。Builder 与 Reviewer 环境均无法执行，建议 Human 合并前浏览器过一遍，重点：导入/导出按钮激活态（见 M2）、导出弹层锚定 48px 位置、行选中高亮。

## 附带说明（非问题）

- T-001 附带修复导出弹层锚点（`.workbench` 加 `position: relative`、`top: 48px`）属顶栏重做的必要连带（顶栏改 `overflow-x:auto`/固定高度后弹层需重新锚定），在范围内，非越权。
- `setAssetStatus` 领域函数在 App 中不再被直改调用（状态改经右栏 `applyReview`），但其仍作为领域 API 保留并被 `domain/review.test.ts` 覆盖，符合 P-005 核心层全量保留，非死代码问题。
- 本地 `master` 领先 `origin/master` 2 个 docs 提交（fe6b424、90594da，与 T-002 分支共享），属环境残留，不影响本次 PR 审查结论，建议合并前核对 origin/master 为 d53f41d 的干净状态。

## Recommendation

**REQUEST CHANGES。** 代码与测试本身质量良好（删除清单 100% 落实、核心层未动、270/250 双绿、无残留、无越权），但存在两项合并前必须处理的事项：

1. **B1（阻塞）**：T-002 rebase 到 T-001 之后，显式解决 `AssetGrid.test.tsx` 冲突（按删除意图删 `...rows` 两用例），重新 push。
2. **M1（需决策）**：以 REVISION-N.md 更正 P-005 目标数字（274→250）或由 Planner/Human 明确接受 250。

最小下一步：Builder 处理 B1（rebase）后，Planner/Human 对 M1 做 REVISION 决策；M2/M3/M4 可在后续微调（不阻塞合并，但建议在 M2 的激活态样式上顺手统一）。
