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

## Builder result

- 实现摘要：
  - `seriesUtils.ts`：`groupDicomBySeries` 新增可选 `patientKey` 选项——同患者缺 UID 文件聚合为单个"未知系列"（key = `<patientKey>:unknown-series`，R-019），不传时保持平铺语义（`asset:<id>` 各自成组）；切片排序改为 InstanceNumber 升序 → 缺失/相同时按来源文件名（`DicomSeriesEntry.fileName` 可选字段）；新增 `findDicomPatientSeriesGroup`（患者分组口径下定位素材所属 series，含未知系列）；`sliceCountByAsset` 统计口径改为患者分组语义（跨患者缺 UID 文件不合并）；`groupDicomByPatient` 内部传入患者键。
  - `DicomViewer.tsx`：解析范围收敛为"所属 series 文件集合（含聚合后未知系列）∪ 尚无元数据、无法归类的文件"（后者保持既有"打开即解析"行为，解析出元数据后纳入分组并去重；已归入其他 series 的文件不再解析）；parseKey/queue/回写均按该范围；会话元数据增加同步镜像 ref 保证多批次聚合口径一致；orderedSlices 仍为所属 series 的 InstanceNumber（→ 文件名）排序。
  - `DicomSeriesExpansion.tsx`：未知系列行文案"未知系列（N 个文件）"。
- 文件清单：`seriesUtils.ts` / `DicomViewer.tsx` / `DicomSeriesExpansion.tsx` + 三者测试（新增/调整 12 个用例）。
- 验证结果：`scripts/verify.ps1` 全绿（32 文件 / 317 用例通过，存量 305 无回归）；`tsc -b && vite build` 通过；oxlint 0 error（1 条与本改动无关的既有 warning）。
- 已知限制 / 需 Reviewer 关注：
  - 无元数据文件会随任何一次打开被解析（保持既有行为，用于归类）；已归类文件严格限定在所属 series（R-018 隔离由持久化元数据驱动，单测断言 fetch 集合）。
  - `findDicomSeriesGroup` 仍保留平铺语义并有测试兜底，应用内查看器已改用患者分组口径的 `findDicomPatientSeriesGroup`。
  - 场景矩阵（R-020）落地在 T-003；本任务单测覆盖聚合键/排序/混合/解析范围。
- Manual 待办：浏览器批量导入同患者无 UID 文件核对左栏（1 组 + 1 未知系列 + N 切片）。