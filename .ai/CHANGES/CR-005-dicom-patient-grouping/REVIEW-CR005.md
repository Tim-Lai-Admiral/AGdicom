# Review: CR-005 — T-001/T-002/T-003（PR #23/#24/#25）

## Metadata

```yaml
task: T-001 + T-002 + T-003
cr: CR-005
reviewer: Reviewer
target_commit_or_pr: PR #23 / #24 / #25
date: 2026-09-07
result: REQUEST CHANGES
```

## 结论（分项）

| Task / PR | 代码与验收 | 复跑验证 | 结论 |
|---|---|---|---|
| T-001（PR #23，R-011） | 通过 | 246 tests / 28 文件 + build OK | PASS（代码） |
| T-002（PR #24，R-012） | 通过 | 258 tests / 29 文件 + build OK | PASS（代码；含 1 处需 Human 确认的排序口径） |
| T-003（PR #25，R-013） | 通过 | 259 tests / 29 文件 + build OK | PASS（代码） |
| **CR-005 整体（合并卫生）** | — | — | **REQUEST CHANGES**（PR #25 body 失实 + 未推送的 CR 文档 commit 混入各 PR） |

> 三个任务的**代码实现与验收标准均通过**，且复跑 verify.ps1 全部通过。
> 阻塞项集中在**合并卫生/范围纪律**：PR #25 的 PR body 声明与分支实际内容不符；
> 另发现 CR-005 规划文档 commit `4574edc` 仅存在于本地 master（未 push 到 origin/master），
> 混入三个 PR 的分支历史，导致 GitHub 端 PR diff 把 CR 文档也当作新增文件展示。

---

## 复跑测试结果（独立验证）

| PR | 预期 | 实测 | build |
|---|---|---|---|
| #23（T-001） | 246 | 246 passed（28 文件） | tsc + vite OK |
| #24（T-002） | 258 | 258 passed（29 文件） | tsc + vite OK |
| #25（T-003） | 259 | 259 passed（29 文件） | tsc + vite OK |

- `gh pr checks`：三个 PR 的 `verify` job 均 pass。
- 全量验证方式：`powershell -ExecutionPolicy Bypass -File scripts\verify.ps1`（按 25 → 24 → 23 顺序 checkout 各 PR 复跑）。

---

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| R-011 验收（样本彻底移除） | pass | grep `handleLoadSamples|SAMPLE_STL_NAMES|samplesLoading|samplesError|onLoadSamples` → src 内 0 命中；`public/samples/stl/` 已删除（Test-Path False），`public/samples/dicom/` 保留；README 同步 |
| R-012 验收（患者分组） | pass | `groupDicomByPatient`/`findDicomPatientGroup` 纯函数 + 6 组单测；左栏两级展开（患者组 → series → 切片）；DicomViewer 内部 series 分组未动（T-002 未改 DicomViewer.tsx） |
| R-013 验收（滑动条） | pass | slider `aria-label="选择切片"` min=1 max=N + 越界守卫；grep `上一张|下一张|handleStepSlice|slice-button|slice-select` → 0 命中；读数 `切片 X / N（按 InstanceNumber 排序）` 保留；测量/W-L 未动 |
| 无 schema/契约改动 | pass | 未改 `domain/types.ts` / `store/` / 持久化 schema；seriesUtils 仅新增纯函数 |
| 无越界代码改动 | pass | 各任务仅改自身文件（T-001：App/TopToolbar/样本/README；T-002：seriesUtils/DicomSeriesExpansion/App.selectAsset/styles；T-003：DicomViewer/styles） |

---

## Findings

### Blocker

1. **PR #25 body 失实：声明“基于 master，无 T-001/T-002 改动”，但分支实际包含 T-001 与 T-002 的 commit。**
   - 证据：`git log --oneline master..feature/CR-005-T-003-slice-slider` = `e3ac831, 4f3fa0e, ae81b70, 482bee5, 2cac931, 76955bd`（T-003 + T-002 + T-001 全部在列）；`git diff --stat master...feature/CR-005-T-003-slice-slider` 共 19 文件（含 README、stl 删除、seriesUtils、DicomSeriesExpansion 等 T-001/T-002 改动）。
   - 影响：若 Human 仅看 PR #25 标题/body 而先合并 #25，会把 T-001+T-002+T-003 一次性并入 master，绕过逐任务评审；违反 `.ai/AGENTS.md` §6.3「每个 Task 默认独立 branch」与范围纪律。
   - 修正：Builder 更正 PR #25 body（如实披露分支含 T-001/T-002 commit，参照 PR #24 的披露方式），或（更优）将 T-003 分支 rebase 到 origin/master 使其真正独立。
   - 合并顺序必须是 **23 → 24 → 25**（三分支共享同一批 commit hash，顺序合并可干净收口）。

2. **CR-005 规划文档 commit `4574edc`（CHANGE.md / REQUIREMENTS.md / 三张任务卡）只存在于本地 master，未推送到 origin/master，并随三个 PR 分支一起携带。**
   - 证据：`git log origin/master..master` = `4574edc`；`git branch -r --contains 4574edc` 只列出三个 `origin/feature/CR-005-*` 分支，不含 `origin/master`；PR 的 `baseRefOid` 均为 `bd47796`（落后于本地 master）。
   - 影响：GitHub 端三个 PR 的 "Files changed" 都把已批准的 CR 文档当作新增文件展示（`gh pr diff 23` 含 CHANGE.md/REQUIREMENTS.md 等 new file），diff 与「PR 应只含本任务改动」不符；也掩盖了真正的任务净改动。
   - 修正（Planner/Human，非 Builder 代码问题）：先将 `4574edc` 推送到 origin/master，再刷新 PR 基线，使各 PR diff 只含本任务改动。

### Major

- （无独立 Major 项；上述两条 blocker 已覆盖合并卫生风险。）

### Minor / non-blocking

1. `src/App.tsx:292`：移除 samplesError 分支后残留多余空白 `)           : null}`（合法但格式脏，建议 prettier 整理）。
2. `src/styles.css:885-886, 1746, 1757`：`.library__samples-error` 样式成为孤儿（App.tsx 已删除唯一使用点），属死 CSS，建议一并清理（不影响功能，验收 grep 不涉及类名）。
3. `src/features/viewer/dicom/seriesUtils.ts`（T-002 新增 `DicomPatientGroup.key` 注释）：`（与已知键不含 \0，不会冲突）` 表述方向反了——已知键 = `姓名\0ID` 是**含** \0 的，`'unknown'` 不含 \0 所以不会冲突。注释措辞建议订正。
4. 残留“内置样本”字样（非功能，Builder 已在 T-001 结果注明）：`src/features/viewer/model3d/__fixtures__/buildStlFile.ts:4` 注释、`src/features/viewer/model3d/Model3DViewer.test.tsx:24` 测试 fixture 的 `source: '内置样本'`。
5. `.ai/CURRENT/REQUIREMENTS.md:93` 与 `.ai/CURRENT/DESIGN.md:13` 仍写「加载样本」，属**合并后 CURRENT 更新**范畴（CHANGE.md「Result」为空，未明确 CURRENT 更新责任），非本 PR 范围，但需在合并后完成，否则事实层级文档与代码不一致。

---

## 需 Human 确认的产品口径（T-002 / R-012，非阻塞）

- R-012 原文「患者字段缺失者单独成组（未知患者），置于末尾」未界定“缺失”是**两者皆缺**还是**任一缺失**。
  Builder 采用：两者皆缺 → 共享 `unknown: true` 组置末尾；仅缺其一 → 按（姓名, ID）码点升序参与排序（缺失侧视为空串），不合入未知组。
  - 该口径确定性、可测，已加代码注释与单测覆盖，属低风险实现决策。
  - 请 Human 确认此口径符合预期；若要求“任一缺失即入未知组”，需新增 Task 调整。
  - 同源口径说明：未知组内 series 仍按 SeriesInstanceUID 升序、缺失 UID 排最后（沿用模块惯例）。

---

## Recommendation

- **代码层面：PASS**（三个任务的实现、验收、测试均达标，无 schema/契约/越界改动）。
- **合并卫生：REQUEST CHANGES** —— 在合并前请 Builder 更正 PR #25 body（披露分支含 T-001/T-002 commit）；请 Planner/Human 先推送 `4574edc` 到 origin/master 以刷新 PR 基线。
- 合并顺序：**#23 → #24 → #25**；合并后按 §6.11 删除 Task 分支，并补做 `.ai/CURRENT/` 更新（移除“加载样本”，登记 R-011/R-012/R-013）。
