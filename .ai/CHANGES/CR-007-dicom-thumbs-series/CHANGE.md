# CR-007: DICOM 真实缩略图 + 系列聚合与解析范围修复

## Metadata

```yaml
id: CR-007
title: "DICOM 行/切片真实像素缩略图；未知系列聚合；DicomViewer 只解析所属 series（场景矩阵测试）"
change_level: L2
status: approved
parent: null
created_by: Planner
created_at: 2026-09-07
```

## Why

Human 反馈（2026-09-07）：
1. 导入的图片等文件要有缩略图——目前仅 image 行有（objectUrl），DICOM 行与切片缩略图是图标/SVG 占位。
2. 批量导入 10 个 DICOM 文件 → 生成十个系列、点击在系列间跳转，体验差。根因：① `DicomViewer` 打开任一文件解析**全部** dicomAssets（元数据全库回写）；② SeriesInstanceUID 缺失的文件各自单独成组 → series 爆炸。
3. 需要规划测试方法避免此类"真实批量导入"问题回归。

## Goal

- DICOM 行缩略图与切片缩略图使用真实首帧像素（解析后生成 dataURL；未解析保持占位）；image 行维持 objectUrl 缩略图；3D 行保留图标。
- DicomViewer 仅解析**所属 series**（不再开一个解析全库）。
- 同患者 + UID 缺失文件聚合为"未知系列"（切片按 InstanceNumber/文件名排序）；有 UID 的保持各自 series。
- 场景矩阵测试：批量导入矩阵（同系列/跨系列/无 UID/混合患者）集成断言 + 手动清单；此类问题的测试要求固化进任务卡规范。

## Non-goals

- 3D 真实预览缩略图；测量/其他功能；真实患者数据。

## Requirement changes

### Added

- R-017: DICOM 缩略图：行缩略图与切片缩略图在解析后渲染真实首帧像素（dataURL），未解析显示占位；image 行保持 objectUrl 缩略图；3D 行保持类型图标。
- R-018: DicomViewer 解析范围 = 所属 series（含其全部切片），不再解析素材库全部 DICOM。
- R-019: 同患者 + SeriesInstanceUID 缺失的文件聚合为"未知系列"（组内按 InstanceNumber/文件名排序）；有 UID 者保持各自 series。
- R-020（流程）: 涉及"真实批量导入/多文件数据流"的任务卡必须含**场景矩阵测试**要求（导入组合矩阵 + 左栏层级断言 + 手动清单）。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | minor | DICOM 浏览体验（缩略图/系列组织） |
| UX/UI | minor | 左栏缩略图与展开层级 |
| Architecture | none | 纯函数 + 组件；解析范围收敛 |
| Data / API | none | schema 不变（缩略图 dataURL 会话级） |
| Testing | major | 场景矩阵集成测试 |

## Tasks

- [ ] T-001: 系列聚合与解析范围（R-018/R-019：未知系列聚合 + DicomViewer 只解析所属 series）
- [ ] T-002: DICOM 真实缩略图（R-017：行 + 切片像素缩略图）
- [ ] T-003: 场景矩阵测试（R-020：集成断言 + 手动清单 + 任务卡规范落地）

## Dependencies

- CR-005（患者分组）/ CR-006（blob 恢复）

## Approval

- [x] Human approved scope（2026-09-07：图片+DICOM 真实缩略图；同患者无 UID 聚合）

## Result

<!-- 合并后填写 -->