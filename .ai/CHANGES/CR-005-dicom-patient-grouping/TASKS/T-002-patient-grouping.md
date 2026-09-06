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