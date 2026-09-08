# Review: CR-011（PR #48 / #49 / #50）

## Metadata

```yaml
task: T-001 / T-002 / T-003
cr: CR-011
reviewer: Reviewer
target_commit_or_pr: "#48 (T-001) → #49 (T-002) → #50 (T-003)，栈式链"
date: 2026-09-08
result: REQUEST_CHANGES
```

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| T-001 目标（面板去收起/关闭/标题 + 页签 50/50） | pass | ReviewPanel 删除 header/collapsed/closeButtonRef/onClose/Esc；styles.css 删除 `.review-panel__header/title/collapse/close`；`.workbench__tab` 加 `flex: 1 1 0`；grep 无残留 |
| T-002 目标（汉字按钮 + 显式比较模式） | pass | TopToolbar 删 `Icon.Upload/Compare`，改汉字文本按钮；App 新增 `compareMode` 状态机；AssetGrid `compareMode` prop 控制行语义 |
| T-003 目标（矩阵/E2E/README） | pass | 矩阵新增比较显式模式场景；E2E §12 + §2 4 条；README 同步 |
| 验收标准 | fail（1 项见 Blocker） | 其余验收项全满足（见下） |
| 无越界改动 | pass | CompareView / domain / store 未动；导入按钮功能不变（仅文字化）；tsconfig 加 `node` types 属基础设施改动 |
| 架构/契约尊重 | pass | schema 不变；App 层新增 `compareMode` 状态；onToggleSelect prop 名保持 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| verify.ps1（本地复跑） | pass | 38 文件 / 386 用例通过 + tsc -b + vite build OK |
| CI（gh pr checks 48/49/50） | pass | 3× verify 全绿 |
| 回归风险检查 | fail（1 项） | Esc 关闭图片预览行为回归（见 Blocker B1） |

## Findings

### Blocker

- **B1 — Esc 关闭图片预览（ImageStage）行为回归，与任务卡「保留 Esc 关闭查看器」及 PR #48 body「行为不变」不符。**
  - 位置：`src/features/review/ReviewPanel.tsx`（Esc 监听与 `onClose` 已删除）；`src/App.tsx:528`（`onClose={closeActiveAsset}` 已移除）；`src/features/workbench/ImageStage.tsx:53-61`（Esc 仅 `reset()` 复位变换，不关闭）。
  - 对应 Requirement：T-001 Context pack「保留：Esc 关闭查看器（App 层）」；Scope「Esc 关闭查看器的 App 层逻辑保留（不影响）」；PR #48 body「closeActiveAsset 仅服务查看器 Esc/关闭，行为不变」。
  - 事实：改动前，查看 image 时右栏评审面板（`showReviewPanel` 恒挂载）的 window keydown Esc → `onClose` → `closeActiveAsset` → 中央图片预览关闭、回到导入视图。改动后该 Esc 路径被整体移除，而 App 层对 image 预览无任何 Esc 关闭逻辑，`ImageStage` 的 Esc 仅复位变换（且其行 52 注释明示「Esc 关闭查看器仅 DICOM/比较弹层语义」）。因此 Esc 关闭图片预览这一用户可见行为静默改变（DICOM 查看器 / 3D 查看器 / 比较视图的 Esc 关闭不受影响，仍保留）。
  - 修正方向（二选一，均小改动）：
    1. 在 App 层为 image 预览补充 Esc 关闭（如给 `ImageStage` 增加 `onClose`/App 级 keydown，或在 App 对非模态 image 预览监听 Esc → `closeActiveAsset`），恢复原行为；
    2. 若 Human 确认「图片预览 Esc 只复位、不关闭」为可接受语义，则修正任务卡「保留」表述与 PR #48 body 的「行为不变」声明，并在 README/E2E 明确记录，避免误导。

### Major

- 无（除 B1 外未发现正确性 / 契约 / 数据 / 严重回归问题）。

### Minor / non-blocking

- **M1** — T-001 任务卡未回填 Builder result 且 status 仍 `planned`（T-002/T-003 已回填 Builder result）。流程一致性建议补填。
- **M2** — `tsconfig.app.json:7` 新增全局 `"node"` types，用于 `src/App.workbench.test.tsx` 的 `node:fs` 样式源码断言。合理，但把 `process/Buffer` 等 node 全局暴露给整个 `src`（`include: ["src"]`），可能掩盖浏览器代码中的类型错误；更干净做法是独立测试 tsconfig 或局部 reference。非阻塞。
- **M3** — 页签 50/50 的断言（`src/App.workbench.test.tsx`「styles the right-column …」）是读 `styles.css` 源码文本 + 正则匹配 `flex: 1 1 0`，非真实布局断言，较脆（依赖 CSS 文本格式）。jsdom 无法计算布局故可接受，但属源码快照式测试，建议知晓其局限。
- **M4** — `E2E-CHECKLIST.md` §10 导语「合成 fixture，7 例全绿」计数过时（Builder 已在 T-003 卡标注，可记 `.ai/TODO.md`）。
- **M5** — T-002 任务卡 Scope「比较在非 image 素材存在时可用」疑为笔误（应为「image 素材存在时可用」）；实现按 `hasImages` 正确。仅提示 Planner 勘误，不影响结论。

## Recommendation

REQUEST CHANGES。最小下一步：Builder 就 B1 二选一处置（恢复 App 层 Esc 关闭图片预览，或取得 Human 确认并更正任务卡/PR 声明与文档），并顺带补填 T-001 Builder result（M1）。其余为 non-blocking 技术债，可随合并后记 TODO。
