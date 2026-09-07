# Review: CR-008 左栏 DICOM 患者分组面板重构 + 滑动条切片高亮同步

## Metadata

```yaml
task: T-001 / T-002 / T-003
cr: CR-008
reviewer: Reviewer
target_commit_or_pr: PR #37 (T-001) / #38 (T-002) / #39 (T-003)（栈式链，全链 head=2a6b36e）
date: 2026-09-07
result: PASS # 附非阻塞发现（含 1 项待登记 TODO）
```

## 审查范围与方法

- 按 `.ai/AGENTS.md` §6 规则 7 审 PR（`gh pr diff/checks 37/38/39`），diff 以 PR 为准；本机处于全链分支 `feature/CR-008-T-003-matrix-update`（= PR #39 head，merge-base = master `6813072`），`git diff master...HEAD` 与 PR 一致。
- CI 三 PR `verify` 均 pass；本机独立复跑 `scripts\verify.ps1`：**36 文件 / 346 tests passed + tsc 构建通过**（与 T-003 声明一致）。
- 事实层级确认：master 上 `key={activeAsset.id}`、`onOpenSlice→selectAsset`、`renderCardExtras/DicomSeriesExpansion`、`expandedDicomId` 均存在（`git show master:src/App.tsx` 已核）。

## Scope and requirement check

| Check | Result | Evidence |
|---|---|---|
| T-001 / R-021 逐行挂载彻底移除 | pass | `DicomSeriesExpansion.tsx` 删除；`src/` 无 `dicom-expand`/`展开切片`/`收起切片`/`expandedDicomId`/`renderCardExtras` 残留（grep）；`styles.css` 全部 `.dicom-expand__*` → `.dicom-panel__*` |
| T-001 分组面板一次渲染 + 排序复用 + 折叠 | pass | `PatientGroupPanel.tsx` 复用 `groupDicomByPatient`（R-012 排序）一次渲染全部组头；组头/系列行折叠；`openGroupKeys` 由 App 独立持有 |
| T-001 切片点击不改面板展开态 / selectAsset 解耦 | pass | `PatientGroupPanel.tsx` 切片点击仅 `onOpenSlice`（`onToggleGroup` 不被调用，单测断言）；App `selectAsset` 不再 `setExpandedDicomId` |
| T-001 删除素材后展开态语义 / 无元数据占位 | pass | `handleDeleteAsset` 只清选中/高亮，面板随 `dicomAssets` 派生重建（App.tsx:207-221）；`groups.length===0` → 占位提示 |
| T-002 / R-022 onSelectedSliceChange 上报（初始/滑动条/任意路径 + 去重 + ref） | pass | `DicomViewer.tsx:135-145`：ref 持有回调 + `reportedSliceIdRef` 去重，依赖 `[selectedAssetId]` 覆盖初始与滑动条路径；缺省回调不报错（+2 用例） |
| T-002 App activeSliceAssetId 独立状态与清理 | pass | App.tsx:52 独立状态；`selectAsset`(140)/`handleDicomSliceChange`(233)/`closeActiveAsset`(162)/`handleDeleteAsset`(211-217) 四处接线清理 |
| T-002 左栏高亮实时跟随 / 关闭清理 | pass | `App.workbench.test.tsx` 新增 R-022 用例：滑动条跟随 + 点击不回归 + 关闭清理 |
| T-003 / R-020 矩阵断言口径更新充分性 | pass | `App.scenarioMatrix.test.tsx` 组头口径 `.dicom-panel__group-head` 化 + 新增「面板交互与高亮联动」1 用例（位置下标 + 组头/系列/展开态/缩略图快照 + 高亮跟随）；7 tests |
| T-003 P-005 精简（未重复三类断言） | pass | 三路径完整覆盖在 `App.workbench.test.tsx`（滑动条/点击/关闭）；矩阵仅补 1 条同场景断言，符合 P-005 |
| T-003 E2E §10 人工项 | pass | `E2E-CHECKLIST.md` §10 计数 6→7、新增「面板交互（R-021）」「高亮联动（R-022）」两条人工项 |
| 范围纪律：schema 未改、无越界、测试全绿 | pass | 无 domain/store/schema 改动；变更集中在 workbench/viewer/App 与测试；`sliceThumb.ts` 仅注释更新 |
| CURRENT/ARCHITECTURE 提及旧组件 | 非阻塞 | ARCHITECTURE.md `DicomSeriesExpansion`、UI-001「DICOM 展开 series」仍指旧结构 → 属合并后 CURRENT 更新（协议 §7 明确 merge 后更新 CURRENT） |

## Tests（本机复跑）

| Verification | Result | Evidence |
|---|---|---|
| `scripts\verify.ps1`（npm test + tsc build） | pass | 36 文件 / **346 tests passed**；`tsc -b && vite build` 通过（仅 chunk>500KB 既有告警） |
| CI（PR 37/38/39 `verify`） | pass | 三 PR 均 pass（1m2s / 1m11s / 1m6s） |
| 新用例定位 | pass | DicomViewer.test.tsx +2（上报/去重、缺省回调）；App.workbench.test.tsx +1（R-022 集成）；App.scenarioMatrix.test.tsx +1（R-021/R-022 矩阵）；PatientGroupPanel.test.tsx 10 + thumbs 5 |

## Findings

### Blocker

- 无。

### Major（非阻塞，建议登记）

- **M-1｜点击“当前已打开素材”的面板缩略图不重挂载查看器，中央停留滑动条所切片、高亮跳回点击切片**（`src/App.tsx:285-286` `key={activeAsset.id}`；`selectAsset` `src/App.tsx:135-141` 不触发同 id 重挂载）。
  复现：打开素材 A → 滑动条切到切片 B（高亮跟随 B）→ 点击面板中 A 的缩略图 → `selectAsset(A)` 令 `activeSliceAssetId=A`（高亮回 A），但 `key` 不变、查看器内部 `selectedAssetId` 仍为 B，中央停 B。属「查看器内部选中 vs 面板点击」既有解耦边界（master 上 `key={activeAsset.id}` 已存在，非本 CR 引入）；Builder 已在 T-002 结果文档化并“建议登记 TODO”，但 `.ai/TODO.md` 未见登记。
  影响：R-021「点击切片 → 中央打开该切片」在该边缘路径未完全满足；核心目标（面板不搬家、高亮跟随）不受影响。
  建议：登记 TD（受控选中或 nonce 重挂载，权衡解析缓存）或在本 CR 合并时一并补登记；不阻塞合并。

### Minor / non-blocking

- **m-1｜T-001 任务卡缺 Builder result**：`.ai/CHANGES/CR-008-dicom-panel-fix/TASKS/T-001-group-panel.md` 仍 `status: planned`、无 Builder result 段（T-002/T-003 已回填）。流程一致性缺失，不影响代码。
- **m-2｜`AssetGrid.renderExtras` 成为死代码**：`src/features/library/AssetGrid.tsx:46,319` 保留可选 prop 但 App 不再传入；任务卡明确「保留向后兼容 props」，非阻塞，可后续清理。
- **m-3｜CURRENT 文档陈旧**：`ARCHITECTURE.md` 组件清单仍列 `DicomSeriesExpansion`、`UI-001` 仍写「DICOM 展开 series+切片缩略图」→ 属合并后 CURRENT 更新（非阻塞）。

## Recommendation

**PASS**。三任务验收标准均满足、测试与构建全绿、无越界/契约违规。合并前无需代码修改；建议 Human 合并时或紧随其后：① 补登记 M-1 到 `.ai/TODO.md`；② 回填 T-001 任务卡 Builder result；③ 合并后按协议更新 CURRENT（ARCHITECTURE / UI-001）以反映独立分组面板。按序合并：#37 → #38 → #39。
