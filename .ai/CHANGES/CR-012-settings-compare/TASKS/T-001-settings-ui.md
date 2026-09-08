# Task T-001: 右栏页签字号放大 + 设置按钮/弹窗骨架

## Metadata

```yaml
id: T-001
cr: CR-012
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 12
depends_on: []
branch: feature/CR-012-T-001-settings-ui
```

## Context pack

- Requirement: R-027（弹窗骨架）；关键文件：`src/features/workbench/TopToolbar.tsx`（加设置按钮，图标或文字）、`src/App.tsx`（settingsOpen 状态 + 弹窗挂载）、`src/styles.css`（.workbench__tab 字号放大；弹窗样式）、`.ai/CURRENT/DESIGN.md`（rec 语言）
- 禁止：改功能逻辑；T-002 的配置存储本任务可留接口占位

## Objective

右栏页签字号放大（评审/元数据）；设置弹窗 UI 骨架（标题、关闭/Esc、字段占位）。

## Scope

- 页签字号：.workbench__tab 放大（如 10.5→13px，说明取值）
- TopToolbar：设置按钮（aria-label=设置；汉字或齿轮图标均可，样式统一）
- App：settingsOpen 状态；弹窗组件 `src/features/settings/SettingsDialog.tsx` 骨架（表单字段占位：API Base URL/API Key/启用/回退开关；保存/取消；Esc 关闭）
- 测试：页签字号（样式断言或类名）、设置按钮开合、Esc 关闭
- `scripts\verify.ps1` 全绿

## Out of scope

- 配置持久化与真实 API（T-002）

## Acceptance criteria

- [ ] 页签字号明显增大（CSS 声明可断言）
- [ ] 设置弹窗可开/关（按钮、Esc）；骨架字段展示
- [ ] 存量全绿

## Test requirements

- [ ] Unit: verify.ps1
- [ ] Manual: 目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查