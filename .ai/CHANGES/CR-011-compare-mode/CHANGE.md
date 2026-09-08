# CR-011: 评审面板精简 + 右栏页签均分 + 比较功能显式模式重构

## Metadata

```yaml
id: CR-011
title: "评审面板去收起/关闭；右栏页签各占 50%；顶栏 比较/导入 汉字按钮；比较改为显式模式（先筛选可比较素材再选择）"
change_level: L2
status: completed
parent: null
created_by: Planner
created_at: 2026-09-08
```

## Why

Human 反馈（2026-09-08）：
1. 评审面板内部的展开/收起/关闭与右栏面板重复 → 移除。
2. 右栏顶部「评审 / 元数据」页签各占 50%。
3. 比较功能不好用：顶栏 比较/导入 从 logo 图标改汉字按钮；点击「比较」后素材库**先筛选出可比较的素材**，再按用户选择进行比较；现有"点击图片即自动选中"易困惑 → 改为显式比较模式（普通模式点击图片=中央查看，比较模式点击=加入选择）。

## Goal

- 评审面板常驻右栏（仅右栏自身可收起；面板内无收起/关闭/标题头）。
- 右栏页签 50/50 等宽。
- 顶栏「导入」「比较」为汉字按钮；比较模式：筛选可比较素材（image）→ 提示选择两张 → 显式进入比较；退出比较模式恢复普通交互。

## Non-goals

- 比较对象扩展（DICOM/3D 仍不支持）；比较视图样式改造；Esc 语义大改。

## Requirement changes

### Modified

- R-002（图片浏览筛选比较）实现细化：比较为显式模式（普通模式图片行点击=中央查看；比较模式行点击=加入选择，选满两张自动比较）；顶栏「比较」汉字按钮入口。
- R-005 实现细化：评审面板移除内部收起/关闭（右栏面板自身的收起保留）。
- UI-003 细化：右栏页签 50/50；顶栏 比较/导入 汉字按钮。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | minor | 比较交互语义重构（显式模式） |
| UX/UI | minor | 按钮文字化、页签均分、面板精简 |
| Architecture | none | App 状态新增 compareMode |
| Data / API | none | schema 不变 |
| Testing | major | 比较语义相关测试适配（P-005 允许语义适配）+ 矩阵更新 |

## Tasks

- [x] T-001: 评审面板精简 + 页签均分（去收起/关闭；tabs 50/50）
- [x] T-002: 顶栏汉字按钮 + 比较显式模式（compareMode 状态、筛选、普通/比较模式行点击语义）
- [x] T-003: 测试适配 + 场景矩阵更新 + 文档

## Dependencies

- CR-010（评审面板图样）、CR-009（顶栏/工具）

## Approval

- [x] Human approved（2026-09-08 指示）

## Result

- 2026-09-08 完成。T-001~T-003 合并至 master（PR #48~#50 按序，分支已删）。
- 审查：初评 REQUEST CHANGES（B1：评审面板移除 Esc 后图片预览 Esc 关闭回归）→ 协调者修复（App 层 Esc 关闭图片预览 + 用例），复评通过；非阻塞 M1~M5（T-001 卡回填、tsconfig node types 建议独立测试 tsconfig、页签断言为 CSS 源码、E2E §10 计数过时、T-002 Scope 笔误）。
- CURRENT 已更新（REQUIREMENTS R-002 细化、DESIGN 比较显式模式/页签均分/面板常驻），Tag v0.6.0。