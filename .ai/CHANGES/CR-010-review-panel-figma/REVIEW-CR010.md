# Review: CR-010 T-001 — PR #46（右栏评审面板图样重样式）

## Metadata

```yaml
task: T-001
cr: CR-010
reviewer: Reviewer
target_commit_or_pr: "PR #46 feature/CR-010-T-001-panel-restyle head 88016f7"
date: 2026-09-08
result: REQUEST CHANGES
```

## 结论

代码实现与验收标准全部通过：图样六区块 + 页签下划线 + 素材头 + 合规脚注齐全，功能契约与可访问性保留，复跑 scripts/verify.ps1 全绿（375 = 374 存量 + 1 新增）+ build 通过，CI verify job pass，范围纪律守住（domain/store/io 未动；AiPanel/ReviewHistory/App.tsx 零 TSX 改动）。

阻塞项集中在合并卫生：CR-010 规划文档 commit 73dc177（CHANGE.md + T-001 任务卡）仅存在于本地 master，未推送到 origin/master，并随 PR #46 分支一起携带——与 CR-005 REVIEW 的「未推送的 CR 文档 commit 混入各 PR」阻塞项同型。代码本身无阻塞问题。

---

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | 图样六区块（评审结论/标签/AI 建议/备注/评审历史/危险区）+ 页签下划线 + 素材头 + 合规脚注齐全（ReviewPanel.tsx:176-410、styles.css 页签/分区/瓦片/脚注段） |
| Acceptance criteria | pass | 三态评审/标签自建复用/AI 采纳忽略重生成/备注独立保存/删除二次确认全部保留；收起(aria-expanded)+关闭钮+Esc 保留（ReviewPanel.tsx:108-118,176-194）；375 全绿 |
| 契约 R-005/R-006/R-015 不变 | pass | 追加历史（handleSubmitReview）、Mock AI 采纳/忽略（AiPanel 零改动）、删除级联二次确认（confirmingDelete 状态不变）均保留；R-015 行内入口 AssetGrid 未动 |
| 可访问性语义保留 | pass | radio 视觉隐藏用 clip 模式（非 display:none），保留可聚焦；label focus-within 外描边（styles.css:1292-1308）；getByLabelText 经 label 关联通过 |
| 范围纪律 | pass | git diff --stat master...HEAD 仅 3 代码文件 + 1 任务卡；AiPanel.tsx/ReviewHistory.tsx/App.tsx 零 TSX 改动（卡片化/空态斜体/页签下划线由 CSS 承载）核实 |
| 中文文案一致、无诊断暗示 | pass | 界面全中文（评审结论/全局标签库/采纳命名/危险区/删除素材）；脚注为合规文案（去标识化/PHI），非医疗诊断 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| verify.ps1 复跑（预期 375） | pass | 38 文件 375 passed（374 存量 + 1 新增）+ tsc -b && vite build OK |
| CI（gh pr checks 46） | pass | verify job pass（1m7s） |
| 新增测试（合规脚注三态） | pass | ReviewPanel.test.tsx:69-88：非 DICOM/已去标识化/未去标识化三态文案断言 |
| 既有分区断言补强 | pass | ReviewPanel.test.tsx:63-66（评审结论/标签/备注）、189-190（危险区） |
| Manual 目检（浏览器对照图样） | not run | 任务卡验收项，待 Reviewer/Human 目检（Builder 已标注） |

## Findings

### Blocker

1. CR-010 规划文档 commit 73dc177（CHANGE.md + T-001 任务卡）只存在于本地 master，未推送 origin/master，并随 PR #46 携带。
   - 证据：git log origin/master..master = 73dc177；git diff --stat origin/master..master = 2 文件 +116 行（CHANGE.md 58 + T-001 卡 58）；gh pr diff 46 --name-only 显示 5 文件（含 2 个 CR 文档作为 new file），而 git diff --stat master...HEAD 仅 4 文件（无 CHANGE.md）；PR 三 commit 首项即 73dc177 docs 新建 CR-010。
   - 影响：（1）GitHub 端 PR Files changed 把已批准的 CR 文档当作新增文件展示，掩盖真实代码净改动（+277/-40，3 代码文件）；（2）本地 master 的 T-001 卡为 planned 旧版（无 Builder result，git diff master:...T-001 HEAD:...T-001 = +17/-1），与 PR 内 Builder result 版不一致——Human 在本地 master 拉取合并后易产生 both-added 冲突或文档双份；（3）违反事实层级与范围纪律。
   - 修正（Planner/Human 协调，非 Builder 代码问题）：先 git push origin master 将 73dc177 推送到 origin/master，使 PR 基线包含规划文档、gh pr diff 46 收敛为纯代码改动，再合并 PR。

### Major

- 无。

### Minor / non-blocking

1. PR body 披露不足：body 标「变更（3 文件，+277/-40）」只覆盖代码文件，未披露 PR 同时携带 2 个 CR 规划文档（实际 5 文件、+409/-40）。与 Blocker 1 同根，随推送修复自然消解。
2. 合规脚注措辞：DICOM 去标识化态显示「未检测到 PHI」——实现实际依据 dicomMeta.deidentified 标记，并非真正扫描 PHI；但该文案为任务卡 Objective 原文指定，按图样执行，非阻塞。
3. Series UID 截断：seriesUid.length > 16 时取前 13 字符加省略号（ReviewPanel.tsx:168-169），阈值与显示长度不一致（16 vs 14）；纯视觉细节，title 保留全文，Builder 已自报低风险，非阻塞。

## Recommendation

REQUEST CHANGES（合并卫生阻塞；代码与测试全部 PASS）。

最小下一步：由 Planner/Human 将规划文档 commit 73dc177 推送到 origin/master（git push origin master），刷新 PR #46 基线使其 diff 只含代码改动；Builder 无需改代码。之后可重新审查放行，Human 再合并。
