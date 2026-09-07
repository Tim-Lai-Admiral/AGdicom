# Task T-001: 系列聚合与解析范围修复

## Metadata

```yaml
id: T-001
cr: CR-007
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 20
depends_on: []
branch: feature/CR-007-T-001-series-parse-fix
```

## Context pack

- Requirement: R-018/R-019
- 关键文件：`src/features/viewer/dicom/seriesUtils.ts`（groupDicomBySeries/groupDicomByPatient：无 UID 聚合为"未知系列"）、`src/features/viewer/dicom/DicomViewer.tsx`（parseKey/parse 队列/orderedSlices：只解析所属 series）、`src/features/workbench/DicomSeriesExpansion.tsx`（未知系列行渲染）
- 场景：导入 10 个同患者无 UID 文件 → 目前 10 系列；目标 1 患者组 + 1 未知系列 + 10 切片
- 禁止：改持久化 schema；改患者分组键语义（R-012 已批准）

## Objective

无 UID 文件聚合为"未知系列"；DicomViewer 只解析所属 series。

## Scope

- `seriesUtils.ts`：无 UID 文件在患者组内聚合为"未知系列"（`seriesInstanceUID: null` 的行合并为单组，key 稳定如 `<patientKey>:unknown-series`）；保持 groupDicomBySeries 对外语义（DicomViewer 用）；切片排序 InstanceNumber → 文件名
- `DicomViewer.tsx`：parse 范围 = 所属 series 的文件集合（含聚合后未知系列）；parseKey/queue/回写按该集合；orderedSlices 语义不变
- `DicomSeriesExpansion.tsx`：未知系列行文案（"未知系列（N 个文件）"）
- 单测：聚合键/排序/混合（有 UID+无 UID 同患者）、解析范围断言（mock fetch 集合）
- `scripts\verify.ps1` 全绿（305 存量不回归）

## Out of scope

- 缩略图（T-002）；场景矩阵（T-003）；3D/测量

## Acceptance criteria

- [ ] 同患者 10 无 UID 文件 → 1 组 + 1 未知系列 + 10 切片
- [ ] 打开一文件不解析其他 series（单测）
- [ ] 有 UID 行为不变；合成样本（3 series×6）展示不变

## Test requirements

- [ ] Unit: 聚合 + 解析范围
- [ ] Manual: 批量导入同患者文件核对左栏

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查