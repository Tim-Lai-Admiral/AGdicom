# CR-004: UI 全面对齐 Figma（rec/）设计，清除旧设计残留

## Metadata

```yaml
id: CR-004
title: "UI 全面对齐 rec/（Figma Make）设计语言，清除旧卡片/评审按钮等独立设计"
change_level: L4
status: completed
parent: CR-003
created_by: Planner
created_at: 2026-09-06
```

## Why

CR-003 完成工作台布局后，Human 检查发现界面仍残留旧设计元素（素材卡片的独立设计、卡片上的评审按钮等），与 Figma 原型（rec/）不一致。Human 决定：**放弃之前的设计，UI 全部按照 rec/ 目录下的设计来实现**。

## Goal

- 所有界面元素遵循 rec/ 的设计语言：44px 顶栏（tool-btn 图标按钮、分隔线、preset-btn chips、mono 读数）、左栏紧凑行（方形缩略图 + 两行文本 + 选中 accent 高亮）、右栏 section-header/meta-row、无卡片化容器。
- 移除：素材卡片独立容器设计、卡片上的评审按钮与状态徽标按钮。
- 功能不变：评审/状态通过"选中素材 → 右栏评审面板"完成（T-002 已具备）。

## Non-goals

- 功能/契约变更（R-001~R-010 全部保留）。
- 引入 rec/ 的 Figma 专用插件或代码；仅视觉与结构对齐。
- 测量/MPR 等 rec demo 的未授权能力。

## Requirement changes

### Added

- UI-003: 全部 UI 视觉与结构对齐 rec/（Figma Make 原型，`rec/src/App.tsx` + `rec/src/index.css` 为唯一视觉参考源）；旧设计的卡片容器、卡片评审按钮、徽标式状态按钮不再使用。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | none | 功能不变 |
| UX/UI | major | 左栏/顶栏/状态表达全面按 rec/ 重做 |
| Architecture | minor | 样式与组件结构调整（library 组件改造/替换） |
| Data / API | none | domain/store 不动 |
| Testing | major | 现有 274 测试适配（语义尽量保持） |

## Tasks

- [x] T-001: UI 全面对齐 rec/（左栏行式列表、顶栏图标化、状态点、清除旧卡片/评审按钮设计）

## Dependencies

- rec/（视觉参考源，gitignore 不追踪，只读）

## Approval

- [x] Human approved scope（2026-09-06：放弃旧设计，UI 全部按 rec/ 实现）

## Result

- 2026-09-06 完成。T-001（PR #20）与 T-002（PR #21）合并至 master，分支已删；审查 PASS（REVIEW-CR004.md；T-002 经 rebase 解决 T-001 合流冲突后复评通过）。
- P-005 数字修正：测试基线实为 274（非预估 270），T-001 后 270，T-002 裁 24 → 246（REQUIREMENTS.md 已更正）。
- 附带修复：顶栏激活态类名 is-active→active（M2）。
- CURRENT 已更新（DESIGN/REQUIREMENTS），Tag v0.2.1。