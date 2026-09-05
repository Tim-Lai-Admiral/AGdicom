# Task T-004: 功能集成迁移与回归

## Metadata

```yaml
id: T-004
cr: CR-003
type: feature
status: implemented
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

## Builder result

**实现摘要**（T-004，分支 feature/CR-003-T-004-integration）：

1. **中央查看器语义修正**（增量事实）：移除 CompareView / DicomViewer / Model3DViewer 的
   `aria-modal="true"`（三者已为中央查看区内嵌视图，非模态）；同步更正组件头注释
   （"弹层/抽屉" → 内嵌视图）。
2. **入口与状态核对**（代码走查确认，逻辑零改动）：右栏评审面板（状态/标签/备注/历史）与
   内嵌 AiPanel（Mock 徽标/采纳命名/采纳标签/忽略）经 `selectAsset` 归位可达；
   顶栏 ExportImport 弹出面板（导出 JSON / 导入回填含冲突确认）已迁移完成；
   双图比较在中央区可用（选两张 → 自动进入 → Esc/按钮退出）。
3. **死代码清理**（styles.css）：删除 TSX 无引用的旧布局类 `.app`、`.app__title`、
   `.library`、`.library__header`、`.library__title`、`.library__compare`（含 hover/disabled）、
   `.library__samples`（含 hover/disabled）及 `.workbench .library__compare` 选择器；
   仍在用的 `library__empty` / `library__select-hint` / `library__samples-error` /
   `app__storage-warning` / `app__save-warning` 保留。grep 抽查无残留引用。
4. **新增入口级测试**（App.workbench.test.tsx）：
   - 右栏评审全链路：提交评审（通过+意见）→ 历史留痕 → 新建标签 → 备注保存 → 采纳 AI 命名，
     逐步断言 loadState 持久化；
   - 顶栏导出/导入回环：导出（文件名/schema v1/成功反馈）→ 同名备份导入 → 冲突确认 →
     整体替换并持久化；
   - App.test.tsx 三处 dialog 增加 aria-modal 回归断言（比较/DICOM/3D）。
5. **README 同步**：已知问题小节（截至 CR-003 T-004）#6 重写为内嵌视图语义；DICOM 功能条目
   更正"弹层焦点圈定"表述。

**文件清单**：`src/features/library/CompareView.tsx`、`src/features/viewer/dicom/DicomViewer.tsx`、
`src/features/viewer/model3d/Model3DViewer.tsx`、`src/features/review/ReviewPanel.tsx`（仅注释）、
`src/styles.css`、`src/App.test.tsx`、`src/App.workbench.test.tsx`、`README.md`、本任务卡。

**验证结果**：`scripts\verify.ps1` 全绿 —— 28 个测试文件 / 274 测试通过，`tsc -b && vite build`
成功（Model3DViewer chunk 警告为既有状态，TD-002 已拆分按需加载）。

**已知限制 / Reviewer 关注点**：
- 手动走查（导入→浏览→评审→导出→导入）以 jsdom 入口级测试覆盖主链路；真机视项
  （WebGL 交互、W/L 滑杆手感、导出下载）需 Reviewer 按 E2E-CHECKLIST 人工确认。
- DICOM 查看器 + 右栏评审页签并存时，一次 Esc 会同时关闭两者（T-002 既有行为，
  两 handler 均注册 window keydown；未在本任务改动，如需分层退出记 TODO）。
- Commit：d407e84　PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/16