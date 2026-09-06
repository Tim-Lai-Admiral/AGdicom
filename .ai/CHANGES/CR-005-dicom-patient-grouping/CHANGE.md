# CR-005: 导入简化、DICOM 患者分组索引、切片滑动条

## Metadata

```yaml
id: CR-005
title: "移除内置样本导入、DICOM 按患者分组索引排序、切片切换改滑动条（rec 样式）"
change_level: L2
status: approved
parent: null
created_by: Planner
created_at: 2026-09-06
```

## Why

Human 反馈（2026-09-06）：
1. "加载内置 STL"与文件选择导入功能重复——移除内置样本入口，统一走文件导入。
2. DICOM 素材按**患者姓名 + 患者 ID** 索引：全部相同者为一组并排序（当前仅按 SeriesInstanceUID 分组，无法按患者组织素材）。
3. 切片切换仿照 rec/ 原始设计：上一张/下一张按钮与下拉改为**滑动条**（更好用）。

## Goal

- 移除"加载内置样本"功能（顶栏按钮、handler、状态、样本 STL 文件）。
- 左栏 DICOM 素材按患者（姓名+ID）分组，组间与组内排序明确；组内 series → 切片层级保留。
- DICOM 切片切换改为 rec 风格滑动条（含位置读数），移除上一张/下一张按钮与下拉。

## Non-goals

- 真实患者数据接入；患者去重/合并策略；测量/其他功能变更。
- public/samples/dicom/（合成样本）保留（DICOM 功能仍需要演示数据）。

## Requirement changes

### Added

- R-011: 移除"加载内置样本"功能；STL 仅经文件选择/拖拽导入；`public/samples/stl/` 删除（历史可经 git 恢复）。
- R-012: DICOM 素材按 PatientName + PatientID 分组索引；组按（姓名, ID）排序，组内 series 按 SeriesInstanceUID 排序，切片按 InstanceNumber 排序。
- R-013: 切片切换改为滑动条（rec 样式：slider + 计数/位置读数），移除上一张/下一张按钮与切片下拉。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | minor | 导入入口统一；DICOM 浏览按患者组织 |
| UX/UI | minor | 顶栏减按钮；切片导航改 slider |
| Architecture | none | domain 纯函数新增，模块边界不变 |
| Data / API | none | 持久化 schema 不变 |
| Testing | minor | 相关测试适配（P-005：仅存量不回归+冒烟） |

## Tasks

- [ ] T-001: 移除内置样本导入（App/TopToolbar/样本文件/测试）
- [ ] T-002: DICOM 患者分组索引与排序（seriesUtils 纯函数 + 左栏展开层级）
- [ ] T-003: 切片切换改滑动条（DicomViewer + 测试适配）

## Dependencies

- rec/（T-003 参考滑动条样式）

## Approval

- [x] Human approved scope（2026-09-06 三项变更指示）

## Result

<!-- 合并后填写 -->