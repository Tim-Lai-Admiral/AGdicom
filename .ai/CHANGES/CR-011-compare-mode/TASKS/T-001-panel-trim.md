# Task T-001: 评审面板精简 + 右栏页签均分

## Metadata

```yaml
id: T-001
cr: CR-011
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 10
depends_on: []
branch: feature/CR-011-T-001-panel-trim
```

## Context pack

- Requirement: R-005 实现细化 + UI-003 细化
- 关键文件：`src/features/review/ReviewPanel.tsx`（header 折叠/关闭/标题、collapsed 状态、closeButtonRef 焦点逻辑）、`src/App.tsx`（右栏页签渲染：评审/元数据）、`src/styles.css`（.workbench__tab 等宽）
- 保留：右栏自身收起（App rightOpen，与面板解耦）；Esc 关闭查看器（App 层）；页签切换 rightTab
- 禁止：改评审功能逻辑；改元数据页签内容

## Objective

评审面板移除内部收起/关闭（常驻右栏）；右栏页签（评审/元数据）各占 50%。

## Scope

- ReviewPanel：删除 header（标题/收起按钮/关闭按钮）与 collapsed 状态、closeButtonRef、onClose prop（若 App 不再需要传）；Esc 关闭查看器的 App 层逻辑保留（不影响）
- App：右栏页签样式改为等宽（grid/flex 1 1 0，下划线高亮保留）；onClose 引用清理
- styles.css：页签等宽 + 面板头部样式清理
- 测试适配：ReviewPanel.test 的 收起/关闭/Esc 用例移除或改语义（App 层 Esc 仍测）；App 相关断言同步
- `scripts\verify.ps1` 全绿（375 存量不回归，语义改动说明）

## Out of scope

- 比较模式（T-002）；页签内容；右栏收起（rightOpen）

## Acceptance criteria

- [ ] 评审面板内无收起/关闭/标题头（grep）；右栏自身收起可用
- [ ] 页签各占 50%（断言样式/布局）
- [ ] 存量测试适配后全绿

## Test requirements

- [ ] Unit: verify.ps1
- [ ] Manual: 右栏目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查