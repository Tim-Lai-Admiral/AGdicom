# CR-010: 右栏评审面板按图样重样式（Review/Metadata 页签、VERDICT 三态、TAGS、AI 卡片、NOTES、HISTORY、DANGER ZONE、合规脚注）

## Metadata

```yaml
id: CR-010
title: "右栏评审面板 Figma 重样式：页签下划线、素材头、三态裁决按钮、标签库、AI 建议卡片化、备注、历史计数、危险区、合规脚注"
change_level: L2
status: approved
parent: null
created_by: Planner
created_at: 2026-09-07
```

## Why

Human 提供右栏评审面板图样（Review/Metadata 页签 + 素材头 + REVIEW VERDICT 三态 + Save 青色 + TAGS/Global library + AI SUGGESTIONS[Mock] 卡片 + NOTES + REVIEW HISTORY + DANGER ZONE + 合规脚注），要求按图样重样式。当前实现为旧式分组面板（标题/折叠/关闭 + 状态单选 + 通用区块）。

## Goal

- 右栏（评审页签）视觉与结构对齐图样；元数据页签样式联动（下划线高亮）。
- 保留全部既有功能与契约：三态评审/追加历史/标签自建与复用/AI 采纳忽略/备注独立保存/删除确认/Esc 与折叠。

## Non-goals

- 功能语义变化；数据契约；元数据页签内容（仅样式联动）；3D/图片面板不受影响。

## Requirement changes

### Modified

- UI-003/CR-009 样式细化：评审面板结构按图样（页签下划线、素材头、分区标题大写、卡片化建议、危险区、合规脚注）。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | none | 功能不变 |
| UX/UI | minor | 右栏评审面板重构 |
| Architecture | none | 组件与样式 |
| Data / API | none | schema 不变 |
| Testing | minor | 语义适配（P-005 UI 任务：不回归 + 冒烟） |

## Tasks

- [ ] T-001: 右栏评审面板图样重样式（页面骨架 + VERDICT 三态 + TAGS + AI 卡片 + NOTES + HISTORY + DANGER + 脚注 + 页签联动）

## Dependencies

- CR-008/CR-009（右栏结构/页签已有 rightTab）；评审契约 R-005/R-006/R-015

## Approval

- [x] Human approved（2026-09-07 图样指示）

## Result

<!-- 合并后填写 -->