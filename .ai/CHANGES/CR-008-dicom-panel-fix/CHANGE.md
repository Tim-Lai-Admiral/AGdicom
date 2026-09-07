# CR-008: 左栏 DICOM 患者分组面板重构 + 滑动条切片高亮同步

## Metadata

```yaml
id: CR-008
title: "左栏患者分组改为独立面板（去除逐行挂载）；中央滑动条切换切片时左栏高亮实时同步"
change_level: L2
status: completed
parent: null
created_by: Planner
created_at: 2026-09-07
```

## Why

Human 真机反馈（2026-09-07，同患者同序列 7 文件实测）：
1. 患者分组面板逐行挂载（每个素材行下都有"展开切片"）→ 界面感知为多个序列；点击展开区另一张切片 → 面板跳到该行（"变成展开第二张的序列"）。
2. 中央滑动条切换切片时，左侧切片高亮不实时更新（仅点击缩略图才更新）。

## Goal

- 左栏新增**独立"DICOM 患者分组"面板**（一次渲染全部患者组），取消逐行挂载；素材行保持简洁（点击行选中 → 中央查看）；分组面板内点击切片只更新查看器与高亮，面板不搬家。
- 中央 DicomViewer 滑动条/切片切换时，通过回调把当前切片回传 → 左栏分组面板切片高亮实时跟随。

## Non-goals

- 分组语义变化（R-012/R-019 不变）；缩略图逻辑；3D。

## Requirement changes

### Modified

- UI-001/R-012 实现细化：患者分组展示从"逐行展开"改为"独立分组面板"（一次渲染；分组头折叠；点击切片不移动面板）。

### Added

- R-021: 左栏独立"患者分组"面板：渲染全部患者组（分组头/系列/切片），与素材行解耦；切片点击只切换中央查看与高亮，面板位置不变。
- R-022: 中央切片切换（滑动条/步进/缩略图点击任一路径）实时更新左栏高亮（DicomViewer 通过 onSelectedSliceChange 上报当前切片）。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | minor | DICOM 左栏浏览体验 |
| UX/UI | minor | 面板结构 + 高亮联动 |
| Architecture | none | 组件 props 扩展 |
| Data / API | none | schema 不变 |
| Testing | major | 场景矩阵更新（面板/高亮联动断言） |

## Tasks

- [x] T-001: 左栏患者分组独立面板（R-021：去逐行挂载 + 分组渲染）
- [x] T-002: 滑动条切片高亮同步（R-022：onSelectedSliceChange → 左栏高亮）
- [x] T-003: 场景矩阵与手动清单更新（R-021/R-022 断言）

## Dependencies

- CR-007（R-017~R-020 全套）

## Approval

- [x] Human approved scope（2026-09-07 反馈指示）

## Result

- 2026-09-07 完成。T-001~T-003 合并至 master（PR #37~#39 按序，分支已删）；审查 PASS（REVIEW-CR008.md）。
- M-1 非阻塞边界（点击当前已打开素材的缩略图不重挂载查看器）→ TD-007 登记。
- CURRENT 已更新（REQUIREMENTS R-021/R-022、DESIGN 面板化与高亮联动），Tag v0.4.1。