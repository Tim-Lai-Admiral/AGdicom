# Review: CR-007（T-001 / T-002 / T-003）

## Metadata

```yaml
task: T-001 / T-002 / T-003（栈式链 #33 → #34 → #35）
cr: CR-007
reviewer: Reviewer
target_commit_or_pr: "#33 (279f199) / #34 (0206046) / #35 (a0a3413)"
date: 2026-09-07
result: PASS
```

## 审查对象与方法

- 审查 PR 而非 working tree：`gh pr diff 33/34/35`；三 PR 均 `base=master`、`mergeable=MERGEABLE`、`state=OPEN`。
- 栈式链确认：`feature/CR-007-T-001-series-parse-fix`（#33，commit 279f199）→ `feature/CR-007-T-002-real-thumbs`（#34，含 #33，commit 0206046）→ `feature/CR-007-T-003-scenario-matrix`（#35，含 #33+#34，commit a0a3413）。CR-007 规划文档（CHANGE/REQUIREMENTS/TASKS 初稿）已在 master（8776159）。
- 全量验证一次：`powershell -ExecutionPolicy Bypass -File scripts\verify.ps1`（当前 working tree = #35 分支，与 PR 头一致）。

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| R-019 未知系列聚合（key/排序/混合） | pass | `seriesUtils.ts:86-117`：缺 UID 文件在 `options.patientKey` 下聚合为 `<patientKey>:unknown-series`；`sortSlicesByInstanceNumber`（InstanceNumber→fileName，seriesUtils.ts:58-68）；混合场景（有 UID + 无 UID 同患者）单测覆盖（seriesUtils.test.ts） |
| R-018 DicomViewer 解析范围收敛 | pass | `DicomViewer.tsx:149-159` parseScope = 所属 series ∪ 未归类；DicomViewer.test.tsx `parses only the opened asset's series...` + 场景矩阵②④ 断言 fetch 集合 |
| R-019 有 UID 行为不变 | pass | `groupDicomBySeries` 无 `patientKey` 时保持平铺语义（`asset:<id>`）；`findDicomSeriesGroup` 保留并有测试兜底 |
| R-017 sliceThumb 生成器（成功/缓存/失败/并发去重/压缩降级） | pass | `sliceThumb.ts`；sliceThumb.test.ts 6 例全绿 |
| R-017 组件占位↔像素 + 会话级不持久化 | pass | DicomSeriesExpansion.tsx / AssetGrid.tsx；`thumbCache` 为模块级内存 Map，不入导出 JSON；thumbs 测试 10 例 |
| R-017 stale promise 竞态修复 | pass | `sliceThumb.ts:72-79`：先登记 promise 再启动任务，finally 清理 pending；同步完成任务（无 objectUrl）不会残留 stale promise |
| R-020 矩阵 ①~⑤ 断言充分性 | pass | `App.scenarioMatrix.test.tsx` 6 例（①同系列 / ②跨系列 / ③无 UID / ④混合患者 / ⑤空批次+失败文件）；覆盖左栏层级、解析范围 fetch 集合、缩略图占位↔像素、持久化 |
| R-020 模板提示行可检索 | pass | `.ai/TEMPLATES/TASK.md:73`「Scenario matrix（场景矩阵，R-020）」 |
| R-020 E2E 手动清单 | pass | `E2E-CHECKLIST.md` §10（6 条人工项） |
| 范围纪律：schema 未改 | pass | `git diff master...HEAD --stat` 无 `domain/types.ts`；sliceThumb 仅新增局部 `SliceThumbSource` 接口 |
| 范围纪律：T-002 未动 3D | pass | 无 Model3DViewer/useModelLoader 改动 |
| 范围纪律：T-003 未改产品行为 | pass | 仅新增测试 + 文档 + 模板，无产品代码改动 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| 全量单测 + 构建（verify.ps1） | pass | 36 文件 / **339 tests passed**；`tsc -b && vite build` 通过（`== verify OK ==`） |
| 场景矩阵单独复跑 | pass | `App.scenarioMatrix.test.tsx` 6 tests passed（含 ①~⑤） |
| PR CI checks | #33 pass / #34 pass / #35 pending | `gh pr checks`：#33、#34 均 verify pass；#35 尚未完成（复跑已本地验证 339） |
| 回归风险 | pass | 存量测试（seriesUtils 21、DicomViewer 21、DicomSeriesExpansion 7、AssetGrid 10 等）全绿，无回归 |

## Findings

### Blocker

- None

### Major

- None

### Minor / non-blocking

1. **R-018 收敛的边界语义（首开全批解析）**：`DicomViewer.tsx:156-158` 的「未归类文件 ∪ 所属 series」使**首次**打开一个全新批次的任一文件时，仍会解析全部未归类文件（含将来会归类到其他 series/其他患者的文件），收敛到「仅所属 series」只有在元数据持久化后二次打开才成立。这是 T-001 Builder result 与场景矩阵②④ 明确文档化的既有「打开即解析」行为的保留，R-018 验收项（「打开一个 series 的文件不解析**已归类**的其他 series」）已由单测/矩阵断言覆盖。仅提示：若产品期望严格「首开即仅解析所属 series」需另行澄清，当前实现满足已批准验收口径。

2. **损坏/无法解析文件每次打开都会重试**：解析失败的文件不产生元数据，`knownMetaIds` 永不包含它 → 永远留在「未归类」解析范围；查看器卸载后 `completedIdsRef` 重置，下次打开会再次 fetch+解析再失败。属确定性廉价失败、非回归（CR-007 之前每次打开解析全库，损坏文件同样被反复解析），建议记入 `.ai/TODO.md` 作为后续优化（失败文件做会话级失败标记，与 sliceThumb 的 `failedThumbs` 对齐）。

3. **`sliceThumb.failedThumbs` 按 assetId 而非字节键控**（`sliceThumb.ts:30,100`）：同一 assetId 若会话内 objectUrl 变为不同字节（理论上重导入水合复用 id），不会重试；素材删除后缓存/失败标记残留（无失效挂钩，会话结束释放）。Builder 已文档化，属可接受的会话级实现，非阻塞。

4. **`sliceCountByAsset` 口径变化的影响面**（`seriesUtils.ts:133-141`）：由 `groupDicomBySeries`（全局按 UID）改为 `groupDicomByPatient`（患者内聚合）。grep 确认仅 `DicomViewer.tsx:210` 一处调用，影响面收敛。附带语义：同名 SeriesInstanceUID 跨不同患者时现在按患者分开计数（更符合 R-012/R-019，DICOM UID 全局唯一本不应冲突）；去标识化（姓名+ID 均空）文件同入 `unknown` 患者组的无 UID 文件会聚合（与 R-012 unknown 组语义一致）。均为正确方向，记录备查。

5. **R-020「CR-007 各任务卡含场景矩阵」**：T-001/T-002 卡未设独立「Scenario matrix」测试项（分别在 Out of scope / Acceptance 引用了「场景矩阵（T-003）」），矩阵实作集中在 T-003。因 R-020 为面向未来的流程要求、T-003 已落地 ①~⑤ 矩阵、模板已固化提示行，视为满足；如需逐卡强制，属文档一致性偏好，非阻塞。

## Recommendation

**PASS**（无需改动即可按序合并 #33 → #34 → #35）。

- 实现与验收标准、契约（seriesUtils R-012 患者分组 / decodePixel / buildDicomFile fixture）、范围纪律均对齐；schema 未改、3D 未动、T-003 纯测试+文档。
- 复跑结果：verify.ps1 全绿（339 用例 + 构建通过）。
- 合并前唯一外部依赖：#35 的 CI `verify` 尚为 pending（本地已复跑通过，可等待 CI 转绿或由 Human 直接合并）。
- 遗留的 Minor 项 2（损坏文件重复解析）建议由 Planner 记入 `.ai/TODO.md`，不阻塞本 CR。
