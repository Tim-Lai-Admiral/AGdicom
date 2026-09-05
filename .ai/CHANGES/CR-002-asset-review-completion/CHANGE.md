# CR-002: 收尾交付与协作流程变更

## Metadata

```yaml
id: CR-002
title: "收尾交付与协作流程变更（任务卡 Context pack / 极简派发 prompt）"
change_level: L2
status: completed
parent: CR-001
created_by: Planner
created_at: 2026-09-04
```

## Why

1. CR-001 已完成 T-001~T-007（脚手架/领域模型/导入/图片库/DICOM/3D/评审面板，均验证通过）。剩余交付内容（Mock AI、样本素材、文档收尾）需要继续。
2. 复盘发现派发 prompt 重新变长（T-006/T-007 ~1100 字符），根因是任务卡缺 Context pack 段导致增量事实被复述。**Human 决定：任务卡格式与提示手段的变更必须提升到 CR 级别记录与审批**，不能静默改进程。

## Goal

- 以新格式（Context pack + 预期步数入卡片 + 极简派发 prompt）完成剩余交付：T-008 Mock AI、T-009 样本素材、T-010 测试与文档收尾。
- 将流程变更登记为可审查、可追溯的 CR 记录。

## Non-goals

- 不重做 CR-001 已交付功能。
- 不改变角色协议（AGENTS.md）与事实层级。

## Requirement changes

### Added（流程）

- P-001: 任务卡必须含 Context pack 段（R-ID、关键契约路径、参考模式、禁止项指针），预期步数入卡片 Metadata。
- P-002: 派发 prompt 采用极简格式（≤300 字符）：任务ID + 分支 + 卡片外增量事实，其余一律指向任务卡与 ENVIRONMENT.md。
- P-003: Builder 信息不足时按 `BLOCKED-信息不足` 报告所需清单，不得猜测（兜底极简 prompt 的可靠性）。
- P-004: Git 规则 15 条（Human 2026-09-04 发布，全文入 `.ai/AGENTS.md` §6）：main 为可接受状态、禁直接 push main、每 Task 独立分支、分支名含 CR+Task ID、Builder 可多 commit、完成后建 PR、Reviewer 审 PR、CI 自动 test/lint/build、Reviewer 独立验证、Human 最终 Merge、Merge 后删分支、重大版本 Tag、需求/架构历史归 CR 而代码历史归 Git、禁为跑通改 Requirement、Conflict 显式解决。

### Carried（产品，从 CR-001 移入）

- R-006（Mock AI 建议，含 AI_USAGE.md）
- R-007（样本素材与来源记录：合成 DICOM + README 素材章节；STL 已由协调者入库）
- R-008（交付文档 README.md / AI_USAGE.md）
- 另：T-010 附带处理 T-005 审查 Minor 项与 TD-002（3D 模块 lazy 加载）

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | minor | 剩余功能继续交付（AI/样本/文档） |
| UX/UI | none | — |
| Architecture | none | — |
| Data / API | none | — |
| Testing | minor | T-010 全量验证与 E2E 清单 |
| Process | major | 任务卡模板、派发 prompt 格式、agent 提示词兜底更新 |

## Tasks

- [x] T-007 及之前：CR-001（已完成）
- [ ] T-008: Mock AI 能力（CR-002 新格式卡片）
- [ ] T-009: 样本素材（合成 DICOM + README 素材章节）
- [ ] T-010: 测试与文档收尾（含 Minor 项与 TD-002）

## Dependencies

- CR-001（T-001~T-007 分支链，本 CR 分支在其上继续）。
- pydicom（T-009 样本生成脚本，pip 安装）。

## Approval

- [x] Human approved scope（2026-09-04：后续内容移至 CR-002；任务卡与提示手段变更提升至 CR 级）

## Result

- 2026-09-05 完成。T-008（PR #8）、T-011 Git 规则落地（PR #9）、T-009 样本（PR #10）、T-010 收尾（PR #11）全部合并至 master，分支已删。
- 终审 PASS（REVIEW-T009-010.md）；里程碑审查 PASS（REVIEW-T006-008.md）。
- 流程变更生效：Context pack 卡片、极简派发 prompt（T-008/T-009/T-010 实测）、BLOCKED-信息不足兜底、Git 15 条规则 + CI + oxlint。
- CURRENT 已更新，来源 CR-001 + CR-002。