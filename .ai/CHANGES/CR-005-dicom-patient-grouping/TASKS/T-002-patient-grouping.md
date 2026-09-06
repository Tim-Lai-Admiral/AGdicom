# Task T-002: DICOM 患者分组索引与排序

## Metadata

```yaml
id: T-002
cr: CR-005
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 20
depends_on: []
branch: feature/CR-005-T-002-patient-grouping
```

## Context pack

- Requirement: R-012
- 关键文件：`src/features/viewer/dicom/seriesUtils.ts`（新增 groupDicomByPatient 或同级模块）、`src/features/workbench/DicomSeriesExpansion.tsx`（展开层级改为 患者组 → series → 切片）
- 数据：`DicomMeta.patientName/patientID`（parseDicom 已抽取；空值→'已置空'/null 语义以现有为准）
- 禁止：改 DicomViewer 内部 series 分组（预览用）；改持久化 schema

## Objective

左栏 DICOM 素材按患者（姓名+ID）分组、组间排序；组内 series → 切片层级。

## Scope

- `seriesUtils.ts`（或新模块）新增 `groupDicomByPatient(entries): DicomPatientGroup[]`：键 = 姓名+ID；组排序（姓名, ID）升序；患者字段缺失 → "未知患者"组置末尾；组内 series 按 SeriesInstanceUID 排序（可复用现有分组排序）；切片按 InstanceNumber（现有 sortSlicesByInstanceNumber）
- `DicomSeriesExpansion.tsx`：两级展开（患者组头 → series 行 → 切片缩略图）；默认患者组折叠；选中素材时对应患者组自动展开并高亮
- 单测：分组正确性、排序（含缺失字段）、组内层级
- `scripts\verify.ps1` 全绿（DicomViewer/其他不回归）

## Out of scope

- 患者去重/合并；真实患者数据；测量

## Acceptance criteria

- [ ] groupDicomByPatient 纯函数单测通过（含缺失患者字段末尾、排序）
- [ ] 左栏两级展开可用；合成样本（3 series×6 切片，同一患者）显示为一组
- [ ] 既有按 series 查看/切片切换不回归

## Test requirements

- [ ] Unit: groupDicomByPatient + 展开组件交互
- [ ] Manual: 合成样本左栏展开

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

**实现摘要**

- `seriesUtils.ts` 新增 `groupDicomByPatient(entries): DicomPatientGroup[]` 与 `findDicomPatientGroup`：
  - 键 = 姓名 + ID（`\0` 分隔，缺失一侧归一为空串）；姓名与 ID 均缺失者共用一个
    "未知患者"组（`unknown: true`，与 parseDicom `empty-patient-fields` 语义一致）置末尾；
    仅缺其一者按现有值参与键（保留部分归属信息，不并入未知组）；
  - 组间按（姓名, ID）码点升序；组内 series 复用 `groupDicomBySeries` 后按
    SeriesInstanceUID 升序（缺失 UID 排最后，沿用模块惯例），切片沿用 InstanceNumber 排序。
- `DicomSeriesExpansion.tsx` 重写为两级展开：患者组头（姓名/ID/序列与切片计数）→ series 行
  （可折叠）→ 切片缩略图。患者组默认折叠（App 层控制）；series 行默认折叠，但当前在
  中央查看器打开的素材所属 series 自动展开，患者组头与当前切片缩略图 `is-active` 高亮。
- `App.tsx` `selectAsset`：选中 DICOM 素材时同步 `setExpandedDicomId(assetId)`——实现
  "选中素材时对应患者组自动展开"（卡片级面板打开后由组件自动展开其所在 series）。
- `styles.css`：新增患者组头/series 行开关样式（`__patient-head`、`__series-toggle` 等），
  移除不再使用的 `__series-head`；其余切片缩略图样式复用。

**文件清单**

- `src/features/viewer/dicom/seriesUtils.ts`（新增患者分组 API）
- `src/features/viewer/dicom/seriesUtils.test.ts`（+5 用例：分组/排序/缺失字段/组内层级/查找）
- `src/features/workbench/DicomSeriesExpansion.tsx`（两级展开重写）
- `src/features/workbench/DicomSeriesExpansion.test.tsx`（新增，6 用例）
- `src/App.tsx`（selectAsset 联动展开）
- `src/App.workbench.test.tsx`（左栏展开段落按新层级更新）
- `src/styles.css`

**验证结果**

- `scripts\verify.ps1` 全绿：258 tests passed（29 文件）+ `tsc -b && vite build` 成功；
  DicomViewer / parseDicom / 其余模块无回归。

**已知限制 / 技术债**

- 患者字段部分缺失（仅姓名或仅 ID）的排序口径：缺失一侧视为空串参与（姓名, ID）码点升序，
  不并入"未知患者"组——R-012 未明确该场景，属低风险实现决策，已在代码注释说明。
- 同一患者的素材仍按素材行逐行展示（AssetGrid 行结构未改），患者组面板在每行内独立渲染；
  行级合并去重超出本任务范围。
- 切片缩略图仍为占位示意 SVG（非像素解码），与既有行为一致。

**需 Reviewer 关注点**

- "未知患者"合并策略（均缺失 → 单组）与部分缺失排序口径是否符合预期（见上）。
- `App.tsx` 的 `selectAsset` 增加 `setExpandedDicomId` 联动：卡片级面板打开后患者组内
  series 自动展开是否与验收"选中素材时对应患者组自动展开并高亮"一致。

（commit `482bee5`；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/24；分支 `feature/CR-005-T-002-patient-grouping`。注意：分支历史包含 T-001 的 3 个 commit——分支实际自 T-001 分支创建，与派发说明不符；T-002 改动与 T-001 无文件重叠，PR diff 说明已写入 PR body）