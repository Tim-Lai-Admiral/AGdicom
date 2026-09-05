# CR-001: AI 图片、DICOM 与 3D 素材评审工作台 Lite

## Metadata

```yaml
id: CR-001
title: "AI 图片、DICOM 与 3D 素材评审工作台 Lite"
change_level: L4
status: approved
parent: null
created_by: Planner
created_at: 2026-09-03
```

## Why

外部预筛选作业（`README_题目简版.md`）：需要交付一个可运行的 Web 工作台，用于浏览、比较、筛选、标注并整理图片、DICOM 与 3D 素材，形成可追溯的评审结论。仓库当前仅有 `.ai` 协作脚手架，无任何产品代码。

## Goal

交付一个纯前端 SPA（Vite + React + TypeScript），支持：

- 图片素材的浏览、筛选、状态标记与双图并排比较；
- DICOM 素材的基本识别（元数据、series/切片数、去标识化标记、单切片灰度预览）与来源/状态记录；
- STL 3D 模型的加载与旋转/缩放/平移；
- 标签、备注与评审结论（状态 + 意见 + 时间戳）的持久化与 JSON 导入/导出；
- Mock AI 建议（命名/标签/摘要，确定性规则）与 `AI_USAGE.md`；
- 内置样本素材（4 个心脏 STL + pydicom 合成 DICOM phantom）与 `README.md` 完整交付文档。

## Non-goals

- 完整 DICOM 阅片器（窗宽窗位调参、MPR、测量）。
- 压缩传输语法（JPEG/JPEG2000 等）的像素解码（仅提示"仅元数据"）。
- 后端服务、数据库、多人协同、权限体系、真实患者数据接入。
- 任何诊断/治疗类临床结论生成。
- 外部 AI API 真实接入（仅 Mock 模式）。

## Requirement changes

### Added

- R-001: 素材导入与分类
- R-002: 图片浏览、筛选、状态标记与简单比较
- R-003: DICOM 基本识别与可验证信息展示
- R-004: 3D 模型加载与交互
- R-005: 标注与评审结论的持久化与导出
- R-006: Mock AI 建议能力
- R-007: 样本素材与来源记录
- R-008: 交付文档（README.md / AI_USAGE.md）
- R-009: 纯前端可运行性与 Mock 边界

### Modified

- 无（仓库无既有需求）。

### Removed

- 无。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | major | 全新产品定位（素材评审工作台），Human 已批准 |
| UX/UI | major | 全新界面（素材库 + 查看器 + 评审面板） |
| Architecture | major | 新增前端 SPA 架构（L3），Human 已批准技术栈与方案 |
| Data / API | major | 新增领域模型（Asset/DicomMeta/ReviewRecord）与 localStorage 仓储 + JSON 导入/导出契约 |
| Testing | major | 新增 vitest 单元测试与手动 E2E 清单 |
| Existing behavior | none | 空仓库起步，无既有行为 |

## Tasks

- [x] T-001: 环境与脚手架（Node 安装 + Vite/React/TS 工程 + 依赖）
- [x] T-002: 领域模型与存储
- [x] T-003: 素材导入与分类
- [x] T-004: 图片浏览、筛选与比较
- [x] T-005: DICOM 识别与元数据
- [x] T-006: 3D 查看器
- [x] T-007: 标注与评审结论
- [x] T-008~T-010: **MOVED to CR-002**（2026-09-04，Human 决定：任务卡/提示手段变更提升至 CR 级；剩余交付在 CR-002 以新格式卡片继续）

## Dependencies

- 外部：Node.js LTS（winget 安装）、npm registry、pydicom（仅样本生成脚本，开发期）。
- 素材：`../DEMO SET/stl/`（4 个心脏 STL，本作业自带素材）。

## Approval

- [x] Human approved scope（2026-09-03）
- [x] Human approved architecture change（2026-09-03）
- [x] Human approved product direction（2026-09-03）

## Result

<!-- 合并后：结果、关联 PR/commit、CURRENT 更新。 -->