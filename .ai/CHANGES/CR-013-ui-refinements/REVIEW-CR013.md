# Review: CR-013 UI 细化（T-001 / T-002，PR #57 / #58）

## Metadata

```yaml
task: T-001 + T-002
cr: CR-013
reviewer: Reviewer (OpenCode)
target_commit_or_pr: "#57 (T-001) + #58 (T-002，含 T-001 链，按序合并)"
target_sha: 6d6ab00 (T-001) / db2dcd8 (T-002，head d3bd106)
date: 2026-09-09
result: PASS
```

## 审查方式

- 按 `.ai/AGENTS.md` §6 规则 7 审 PR（`gh pr diff/checks 57/58`），diff 以 PR 为准。
- 本机 checkout 至 PR #58 head（`d3bd106`，merge-base = master `927c819`，与 `gh pr view 58` 一致），
  复跑 `powershell -ExecutionPolicy Bypass -File scripts\verify.ps1` 后回 master。
- #57 CI `verify` 已 pass；#58 CI 审查时仍在 pending，以本机复跑为准（全绿，见下）。

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| T-001 目标满足（R-022 扩展 / R-031 / R-032） | pass | `App.tsx:200-201` metaAsset 派生；`PatientGroupPanel.tsx:260/316` Chevron；左栏 `PatientGroupPanel` 移至 `AssetGrid` 之前（`App.tsx:610-628`） |
| T-002 目标满足（R-033 + R-029 细化） | pass | 系列行选择开关（`PatientGroupPanel.tsx:275-306`）；`App.tsx` selectedSeriesKeys + 配对互斥 + 锚点映射（`App.tsx:206-222`） |
| 验收标准覆盖 | pass | 同步/顺序/箭头/系列选择/互斥/清理均有单测 + 矩阵用例 |
| No out-of-scope changes | pass | 10 文件，无 schema/契约改动；`CompareView.tsx` 仅 props 注释文档 |
| CURRENT/architecture respected | pass | 复用 `groupDicomByPatient`/`buildDicomSeriesEntries` 同口径；CompareView 资产输入契约不变（系列映射为首切片锚点，DicomViewport 内部经 `findDicomPatientSeriesGroup` 聚合全系列） |

## 逐项核验

### T-001（R-031 / R-032 / R-022 扩展）

| 审查点 | 结论 | 证据 |
|---|---|---|
| metaAsset 派生（activeSliceAssetId 优先 / 回退 activeAsset） | pass | `App.tsx:200-201`：`(activeSliceAssetId !== null ? state.assets[activeSliceAssetId] : undefined) ?? activeAsset`；陈旧/已清理切片 ID 防御性回退（CR-008 删除路径已清理） |
| 评审页签仍绑定 activeAsset | pass | `App.tsx:686-694`：评审/`showDicomReview` 分支仍用 `activeAsset`；`App.workbench.test.tsx` 用例断言 `review-panel__asset-name = s1.dcm` 不随切片变 |
| W/L 不随切片 | pass | `WindowLevelPanel` 仍由 App 级 `windowLevel` 状态驱动（`App.tsx:688`），与切片无关；契约不变 |
| 左栏 DOM 顺序（分组面板在素材库前） | pass | `App.tsx:610-628` 面板置于 `AssetGrid` 之前；`App.workbench.test.tsx` 用例断言 `panel` 下标 < `grid` 下标 |
| 空态/无 DICOM/比较模式正确 | pass | 无 DICOM 时 `dicomAssets.length > 0` 短路不渲染（测试断言 `.dicom-panel` 为 null）；空态走上方提示 |
| chevron 旋转（-90°/0°/0.15s，aria-expanded 保留） | pass | `styles.css:2501-2511`：`rotate(-90deg)` / `.is-open rotate(0deg)` / `transition: transform 0.15s ease`；分组头/系列行 `aria-expanded` 保留（`PatientGroupPanel.tsx:257/313`），Chevron `aria-hidden="true"` |

### T-002（R-033）

| 审查点 | 结论 | 证据 |
|---|---|---|
| 系列行选择开关语义（aria-pressed/is-selected；比较模式不展开缩略图） | pass | `PatientGroupPanel.tsx:275-306`：compareMode 下系列行 `aria-pressed` + `is-selected`，无 `aria-expanded`、无 chevron、无 `.dicom-panel__thumbs`；组头仍可折叠（浏览系列行） |
| 配对约束互斥 + role=alert 提示 | pass | `App.tsx:375-416`：先选系列→素材行拒绝（`handleToggleCompareSelect`），先选素材行→系列拒绝（`handleToggleSeriesSelect`）；`compareMixNotice` 以 `<p role="alert">` 呈现（`App.tsx:614`） |
| 系列→首切片锚点映射（CompareView 契约不变、DicomViewport 聚合链路复用） | pass | `App.tsx:206-218`：所选系列键 → `series.slices[0].assetId` 锚点；`CompareView.tsx:157-166` 仅注释说明；`DicomViewport.tsx:269-270` 经 `findDicomPatientSeriesGroup` 聚合全系列切片。方案合理（无新增并行契约） |
| 进入/退出清理 | pass | `enterCompareMode`/`exitCompareMode`（`App.tsx:418-435`）均清空 `selectedIds` + `selectedSeriesKeys` + `compareMixNotice`；`validSeriesSelection` 剪除陈旧键防阻塞配对 |
| 矩阵用例 | pass | `App.scenarioMatrix.test.tsx` 新增「系列级比较选择」3 用例（选满两系列自动比较/系列先选素材行拒绝/素材行先选系列拒绝+素材行入口不受影响）；原「比较显式模式」用例更新断言面板在比较模式保留 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| Required unit tests（全部） | pass | `verify.ps1`：**43 文件 451 用例全绿**（PatientGroupPanel.test 14、App.workbench.test 16、App.scenarioMatrix.test 16 等） |
| Required build（tsc -b + vite build） | pass | `== verify OK ==`，无类型错误；仅 chunk 体积提示（TD-002 已知，非本 CR 引入） |
| Regression risk checks | pass | 存量 R-021/R-022/R-029/R-030 场景矩阵与工作台用例无回归；左栏 DOM 顺序重排后「面板不搬家」断言仍通过 |

## Findings

### Blocker

- None

### Major

- None

### Minor / non-blocking

- **m-1｜`compareMixNotice` 未在素材行取消/配对完成路径清除（App.tsx:385-388、390-392）**：混选拒绝后，若用户点击已选素材行取消（`setSelectedIds` 分支）或完成第二个素材配对，`compareMixNotice` 均不置 null；该 `role="alert"` 提示会滞留（含比较弹层打开期间左栏仍可见）。不影响功能与验收，属提示态残留的 UX 打磨。建议：在 `handleToggleCompareSelect` 的取消分支与配对完成分支补 `setCompareMixNotice(null)`。
- **m-2｜`handleToggleSeriesSelect` 取消分支用原始 `selectedSeriesKeys` 而非 `validSeriesSelection`（App.tsx:407）**：`selectedSeriesKeys.filter(key => key !== seriesKey)` 对陈旧键不做剪除。无可见影响（下游一律消费 `validSeriesSelection`），仅语义略不一致，可统一用 `validSeriesSelection.filter`。
- **m-3｜比较模式下「未解析 DICOM」面板同时显示系列选择提示与「暂无切片数据」占位**（`PatientGroupPanel.tsx:237-245`）：`p01.dcm` 未解析时既显示「比较模式：点击系列行选择比较对象」又显示「暂无切片数据…」，观感略冗余。非缺陷，可视需要折叠。

## Recommendation

**PASS**。T-001 / T-002 均满足 R-022 扩展 / R-031 / R-032 / R-033（及 R-029 细化）的验收标准；测试全绿（451 用例）、构建通过、范围纪律良好（无 schema/契约变更、无越界）。上述 3 项为 non-blocking 打磨项，不阻塞合并；如需合并后可另开小 Task 或登记 `.ai/TODO.md` 处理 m-1。

合并卫生提示：#58 含 T-001 提交链（6d6ab00/7ad6f63），须按序合并 #57 → #58；合并权属 Human，合并后删除 Task 分支。
