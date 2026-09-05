# Task T-004: 功能集成迁移与回归

## Metadata

```yaml
id: T-004
cr: CR-003
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 20
depends_on: [T-002, T-003]
branch: feature/CR-003-T-004-integration
```

## Context pack

- Requirement: UI-001（功能全量可访问）
- 关键文件：`src/features/review/*`（ReviewPanel/ReviewHistory/ExportImport）、`src/features/ai/AiPanel`、`src/features/library/CompareView`、`src/App.tsx`
- 禁止：改 domain/store/io 契约；改 mockProvider 规则

## Objective

评审、AI、双图比较、导出导入在 T-002 新布局下的入口与状态归位；全量回归 + 文档内联更新（README 已知问题同步 UI 变化）。

## Scope

- 右栏评审面板（状态/标签/备注/历史）与 AiPanel 在新布局下的展示与交互核对
- 顶栏导出/导入入口迁移（ExportImport）
- 双图比较在新布局中央区可用（选中两张图片 → 比较态 → Esc 退出）
- 清理遗留组件/样式死代码（旧布局专属）
- `scripts\verify.ps1` 全绿；README 已知问题小节同步

## Out of scope

- 新功能；契约变更；真实 AI

## Acceptance criteria

- [ ] 评审/AI/比较/导出导入在新布局全链路可用（手动+测试）
- [ ] 无旧布局死代码残留（grep 抽查旧类名）
- [ ] 全量测试绿；README 与实现一致

## Test requirements

- [ ] Unit: 现有测试全绿 + 新增入口级测试
- [ ] Manual: 全流程走查（导入→浏览→评审→导出→导入）

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查