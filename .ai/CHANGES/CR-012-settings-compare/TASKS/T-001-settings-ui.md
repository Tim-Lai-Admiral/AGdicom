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

## Builder result

- 实现摘要：
  - 页签字号：`.workbench__tab` font-size 10.5px → 13px（取值依据：与右栏既有 `0.8125rem=13px` 次要文本刻度一致，可读性明显提升且不突兀；mono 字体/字距/下划线高亮与右栏其余字号均不动）。
  - TopToolbar：新增齿轮图标设置按钮（16px 线性图标语言），`aria-label=设置` + `aria-expanded` + active 态，位于导出按钮与右栏开关之间；只回调，状态由 App 持有。
  - App：`settingsOpen` 状态 + 条件挂载 `<SettingsDialog onClose>`（与 exportOpen 弹层同模式）；App 层图片预览 Esc 兜底在设置弹窗打开期间跳过（`settingsOpen` 守卫），避免一键关闭两层。
  - `src/features/settings/SettingsDialog.tsx` 骨架：标题「设置」、字段占位（API Base URL 文本框、API Key 密码框、启用 checkbox、失败回退 Mock checkbox，均空值/未勾选、非受控）、保存/取消/关闭按钮、Esc 关闭（window keydown）；保存/取消暂时仅关闭并以提示文案明示「配置暂不保存」（不持久化，T-002 接入）。
  - 样式：`.settings-dialog__*` 追加于 styles.css 末尾，深色令牌与导出弹层同语言；保存按钮沿用 accent 青色 + 深色文字（对齐既有可读性修正）。
- 文件清单：`src/features/settings/SettingsDialog.tsx`（新增）、`src/features/settings/SettingsDialog.test.tsx`（新增）、`src/features/workbench/TopToolbar.tsx`、`src/features/workbench/TopToolbar.test.tsx`（补新必填 props + 设置按钮断言）、`src/App.tsx`、`src/App.workbench.test.tsx`、`src/styles.css`
- 验证结果：`scripts\verify.ps1` 全绿（39 文件 / 392 测试 + tsc -b + vite build）
- Commit：`5b846ae`（feat，代码）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/52
- 已知限制：本任务不持久化配置（T-002）；「保存」不落库仅关窗（弹窗内有明示文案）；设置弹窗未做焦点圈定（存量为非模态 dialog 语义，后续如需模态焦点管理另行登记）
- 需 Reviewer 关注：App Esc 兜底新增 `settingsOpen` 守卫对存量「图片预览 Esc 关闭」无回归（存量用例覆盖）；齿轮图标为「中心圆 + 虚线外圈」极简线性画法，目检确认观感