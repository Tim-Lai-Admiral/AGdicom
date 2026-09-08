# CR-012: 右栏字号 + 设置/API 接入 + DICOM/STL 双窗口比较

## Metadata

```yaml
id: CR-012
title: "右栏页签字号放大；设置弹窗（API 配置，真实 API 替代 Mock AI）；比较支持 DICOM/STL 双系列并行（滑动/旋转/平移同步）"
change_level: L3
status: completed
parent: null
created_by: Planner
created_at: 2026-09-08
```

## Why

Human 指示（2026-09-08）：
1. 右信息栏「评审 / 元数据」页签字号放大。
2. 加「设置」按钮 → 弹窗允许用户配置 API（接入真实 API 以替代目前 Mock 行为；AI 建议走真实 API，可回退 Mock）。
3. 比较功能支持 DICOM 与 STL：用户选择 dicom/stl 文件后，可选择两个系列文件**并行显示**；滑动切换切片与 STL 的旋转/平移要**同步作用于两个窗口**。

## Goal

- 右栏页签字号增大（可读性）。
- 「设置」入口 + 弹窗：API Base URL / Key / 启用开关；真实 AI 建议（命名/标签/摘要）接入，失败或未配置回退 Mock；配置持久化（localStorage，不落导出 JSON）。
- 比较扩展：DICOM（两系列并排 + 滑动条/切片切换双向同步）与 STL（两模型并排 + 旋转/平移/缩放同步）双窗口。

## Non-goals

- 图片比较改造（保留现状）；真实患者数据；测量接入 API；MPR。

## Requirement changes

### Added

- R-027: 设置弹窗：API 配置（baseURL/apiKey/启用开关/回退 Mock 开关）；配置 localStorage 持久化（不导出）。
- R-028: AI 真实 API 接入：AIProvider 新增远程实现（HTTP 调用），未配置/失败/超时自动回退 Mock；界面仍明示来源（真实 API / Mock）。
- R-029: DICOM 比较：比较模式可选 dicom 素材；选择两个系列（可跨文件合并为两系列）并行显示；切片滑动/滚轮在两个窗口同步；每窗可独立或同步 W/L（独立优先）。
- R-030: STL 比较：比较模式可选 model（STL）素材；选择两个模型并行显示；旋转/平移/缩放同步作用于两窗口。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | major | 真实 API 集成 + 跨类型比较 |
| UX/UI | major | 设置弹窗 + 比较视图扩展 |
| Architecture | major | AIProvider 远程实现 + 设置存储；比较视图多类型渲染 |
| Data / API | minor | 配置 localStorage；不涉及 schema v1 |
| Testing | major | 远程 provider mock 测试 + 双窗口同步矩阵 |

## Tasks

- [x] T-001: 右栏页签字号放大 + 设置按钮与弹窗骨架
- [x] T-002: API 配置存储 + 真实 AI provider（回退 Mock）+ AI_USAGE 更新
- [x] T-003: DICOM 双系列比较（并行显示 + 切片/滑条同步）
- [x] T-004: STL 双模型比较（旋转/平移/缩放同步）+ 比较模式素材选择扩展（dicom/model）+ 矩阵/文档

## Dependencies

- CR-011（比较模式框架）、CR-009（视口/工具）、CR-006（blob）

## Approval

- [x] Human approved（2026-09-08 指示）

## Result

- 2026-09-08 完成。T-001~T-004 合并至 master（PR #52~#55 按序，分支已删）。
- 审查：初评 REQUEST CHANGES（M1 隐私边界：远程请求含 PHI）→ 修复（toRemoteDicomMeta 白名单过滤 + 单测 + AI_USAGE 补强）→ PASS（REVIEW-CR012.md，442 测试复跑全绿）。
- 非阻塞：m1 图片比较 Esc 双重退出（与 TD-003 同族，待统一处理）；m2 设置弹窗无焦点圈定；m3 geometry dispose；m4 用例计数口径。
- 遗留人工：真机验收（设置弹窗假 API 回退、DICOM 双系列目检、STL 双模型拖拽同步）。
- CURRENT 已更新（REQUIREMENTS R-027~R-030、DESIGN/ARCHITECTURE 设置与比较扩展），Tag v0.7.0。