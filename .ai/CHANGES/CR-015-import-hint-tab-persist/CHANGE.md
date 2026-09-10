# CR-015: 中央导入备份提示 + 右栏页签持久化/全类型

## Metadata

```yaml
id: CR-015
title: "中央导入视图加备份 JSON 提示（精简文案）；右栏 元数据/评审 页签对所有素材显示并跨素材保持选择"
change_level: L2
status: approved
parent: null
created_by: Planner
created_at: 2026-09-09
```

## Why

Human 指示（2026-09-09）：
1. 中央导入视图添加备份相关提示（用户此前问过"导入导出 JSON 如何使用"——可发现性低）；文案用精简版。
2. 右信息栏页签记忆：在某素材选择「元数据」或「评审」后，切换到下一素材时保持该页签选择（如点击评审后切换图片，下一张图片仍显示评审栏）。现状：页签仅 DICOM 显示，且 selectAsset 重置 rightTab。

## Goal

- 中央导入视图拖拽提示下加一行精简备份提示（mono、muted，rec 语言）。
- 右栏页签（元数据/评审）对所有素材显示；非 DICOM 的"元数据"页签显示素材文件信息（名称/类型/来源/大小/创建更新时间等）；页签选择跨素材切换保持（不再重置）。

## Non-goals

- 导出/导入功能变更；元数据分组结构（DICOM 不变）。

## Requirement changes

### Added

- R-035: 中央导入视图备份提示（精简文案）。
- R-036: 右栏页签全类型显示 + 跨素材保持（rightTab 不因切换素材重置；非 DICOM 元数据页签显示文件信息面板）。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | none | 提示与交互记忆 |
| UX/UI | minor | 提示文案 + 页签 |
| Architecture | none | 组件与状态 |
| Data / API | none | schema 不变 |
| Testing | minor | 提示断言 + 页签持久化用例 |

## Tasks

- [ ] T-001: 中央导入备份提示 + 右栏页签全类型/持久化（含 AssetInfoPanel）

## Dependencies

- 无

## Approval

- [x] Human approved（2026-09-09 指示）

## Result

<!-- 合并后填写 -->