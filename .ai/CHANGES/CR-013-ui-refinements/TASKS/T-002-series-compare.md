# Task T-002: 系列级比较选择

## Metadata

```yaml
id: T-002
cr: CR-013
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 18
depends_on: [T-001]
branch: feature/CR-013-T-002-series-compare
```

## Context pack

- Requirement: R-033 + R-029 细化
- 关键文件：`src/features/workbench/PatientGroupPanel.tsx`（比较模式下系列行可点选；新 props：compareMode/selectedSeriesKeys/onToggleSeriesSelect）、`src/App.tsx`（selectedSeriesKeys 状态；比较模式筛选与配对约束扩展；进入 DICOM 比较时以系列为准构造双窗）、`src/features/library/CompareView.tsx`（DICOM 比较数据源：由 selectedAssets 改为 series 键 → 该系列全部切片；或支持按 series 传参）、`src/features/viewer/dicom/seriesUtils.ts`（系列→切片集合已有）
- 设计要点：
  - 比较模式：image/model 仍按素材行选择；dicom 增加系列行选择（两种入口并存，约束：不与素材行混合选择——先选系列则后续只能选系列，反之亦然，或提示）
  - 选中两个系列 → 进入 DICOM 双系列比较（复用 CR-012 T-003 双窗）
  - PatientGroupPanel 系列行在 compareMode 显示选中态（checkbox/高亮）+ aria
- 禁止：改系列分组语义；改 STL/图片比较

## Objective

比较模式可直接选择两个 series 进入 DICOM 双系列比较。

## Scope

- PatientGroupPanel：series 行在 compareMode 可点选（选中态 + aria-label），onToggleSeriesSelect
- App：selectedSeriesKeys 状态；配对约束（系列选择与素材行选择互斥或混合拒绝提示）；进入比较按系列构造（DicomComparePanes 数据源改为系列切片集合）；退出清理
- 测试：系列行选择/取消、选满两系列自动比较、混合选择拒绝提示、退出清理；矩阵补系列比较场景
- `scripts\verify.ps1` 全绿

## Out of scope

- 图片/STL 系列概念；元数据同步（T-001）

## Acceptance criteria

- [ ] 比较模式下分组面板系列行可点选，选满两个系列自动进入 DICOM 双系列比较
- [ ] 与素材行选择互斥或混合有明确提示
- [ ] 退出清理系列选择；存量全绿

## Test requirements

- [ ] Unit: 系列选择状态机/配对/清理
- [ ] Manual: 目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查
## Builder result

- Implementation summary: PatientGroupPanel 比较模式系列行选择（aria-pressed/is-selected，不展开缩略图，组头保持展开/折叠）；App selectedSeriesKeys + 配对约束（系列与素材行互斥，混选 role=alert 拒绝）；选满两系列自动进入 DICOM 双系列比较（CompareView 资产输入契约保留：系列映射为首切片锚点素材，DicomViewport 经 findDicomPatientSeriesGroup 聚合全系列切片）；进入/退出比较清理系列选择
- Files changed: PatientGroupPanel.tsx、App.tsx、CompareView.tsx（props 文档）、styles.css、PatientGroupPanel.test.tsx、App.scenarioMatrix.test.tsx
- Tests run and result: verify.ps1 全绿（43 文件 451 用例 + build）；面板 3 用例 + 矩阵系列级比较 3 用例
- Commit / PR: db2dcd8；PR #58（按序合并 #57 → #58）
- Known limitations: 比较模式下系列行不再展开缩略图（有意交互：系列行作为选择开关）；无 meta 时面板显示占位
- 需 Reviewer 关注: 配对约束互斥语义、系列映射锚点方案（复用既有 DicomViewport 聚合链路）、矩阵新增用例
