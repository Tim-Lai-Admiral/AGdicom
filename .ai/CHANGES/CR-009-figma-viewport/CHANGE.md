# CR-009: DICOM 视口对齐 Figma（四角元数据/顶部工具/滚轮同步/元数据去重/抽屉）

## Metadata

```yaml
id: CR-009
title: "DICOM 查看按图一重构：中央视口四角元数据、顶部工具（含测量）+平移/旋转/缩放、滚轮与滑动条同步、元数据去重、左右抽屉动画"
change_level: L4
status: completed
parent: CR-008
created_by: Planner
created_at: 2026-09-07
```

## Why

Human 以图一（rec/ Figma DICOMview 原型）为基准提出 UI 重构指示：
1. 去掉中间卡片元数据与右栏元数据的重复显示（元数据只保留右栏「WINDOW/LEVEL + 分组」唯一来源）。
2. 部分元数据显示在中央 UI 四角（左上患者/ID/日期；右上 Modal/Series/Inst；左下 C/W/厚度/间距；右下 Zoom/Rot/平面）。
3. 允许鼠标滚轮滚动切片并与底部滑动条同步。
4. 测量功能移到顶部工具栏；并支持图片/图像的平移、旋转、缩放（工具化：pan/zoom/window/rotate/measure）。
5. 左右侧栏面板加抽屉滑动动画。

## Goal

DICOM 中央查看区从「弹层卡片 + 内嵌元数据表格」重构为 Figma 式「工作台视口」：顶部工具栏工具化、四角覆盖层、滚轮+滑条同步、右栏为唯一元数据来源；图片查看器（ImageStage）增加平移/缩放/旋转；左右栏抽屉滑动；界面仍为深色 rec 语言（已对齐）。

## Non-goals

- 真实 MPR/翻页测量精度；3D 查看器改造；诊断暗示。

## Requirement changes

### Modified

- R-017 保留（缩略图）；R-005 不变（评审在右栏）。
- UI-003 细化：中央查看区统一为「视口 + 角标」，元数据仅右栏。

### Added

- R-023: DICOM 视口四角元数据（图一内容与格式）；中央不再显示元数据表格；右栏 MetadataPanel（分组折叠 + W/L）为元数据唯一来源。
- R-024: 视口工具（顶部工具栏）：pan/zoom/window/rotate/measure，作用于中央图像（DICOM 像素视图；图片查看器支持 pan/zoom/rotate 子集）；测量迁移至工具入口（移除查看器内"测量(模拟)/清空测量"按钮，清空置入工具区）。
- R-025: 鼠标滚轮滚动切片（视口内）与底部滑动条双向同步。
- R-026: 左右侧栏抽屉滑动动画（宽度过渡，图一 rec 风格）。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | major | DICOM/图片查看体验重构 |
| UX/UI | major | 视口/工具/抽屉 |
| Architecture | none | 组件层，契约不变 |
| Data / API | none | schema 不变 |
| Testing | major | 视口/工具/元数据去重测试适配 + 场景矩阵 |

## Tasks

- [x] T-001: 中央视口重构（R-023 四角元数据 + R-025 滚轮/滑条同步；去除中央元数据表格）
- [x] T-002: 顶部工具（R-024：pan/zoom/window/rotate/measure + W/L 预设读数；测量迁移）
- [x] T-003: 图片查看器工具 + 左右抽屉动画（R-024 子集 + R-026）
- [x] T-004: 矩阵与走查（R-023~R-026 断言 + E2E 更新 + 文档）

## Dependencies

- CR-003/CR-004（rec 设计语言）、CR-008（面板/高亮）、CR-007（缩略图/矩阵）

## Approval

- [x] Human approved scope（2026-09-07 图一指示五项）

## Result

- 2026-09-07 完成。T-001~T-004 合并至 master（PR #41~#44 按序，分支已删）；审查 PASS（REVIEW-CR009.md，协调者独立复跑 374 全绿）。
- 非阻塞登记：TD-008（rotate 测量落点失真）；Esc 语义叠加观感与 TD-003 同类（未单独登记，后续分层退出或并入）。
- 遗留人工：E2E-CHECKLIST §11 五条（四角/工具拖拽/图片工具/滚轮滑条/抽屉动画）待 Human 浏览器复核。
- CURRENT 已更新（REQUIREMENTS R-023~R-026、DESIGN 视口/工具/抽屉），Tag v0.5.0。