# Task T-001: 设计系统接入（Tailwind v4 + 深色令牌 + 字体本地化）

## Metadata

```yaml
id: T-001
cr: CR-003
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 25
depends_on: []
branch: feature/CR-003-T-001-design-system
```

## Context pack

- Requirement: UI-002；参考素材 `rec/src/index.css`（令牌与组件类，只读参考不提交）
- 关键文件：`vite.config.ts`（加 @tailwindcss/vite）、`src/styles.css`（迁移/拆分）、`public/fonts/`（woff2 本地化）、`src/main.tsx`（CSS 入口）
- 禁止：改产品逻辑/契约；引入 Google Fonts CDN（离线约束 R-009）

## Objective

引入 Tailwind v4，迁移深色主题令牌与基础组件类（tool-btn/range-input/preset-btn/sidebar-thumb/meta-row 等），字体本地化，保留现有功能不回归。

## Scope

- `npm i -D tailwindcss @tailwindcss/vite`；vite.config 注册插件
- `src/index.css` 或 styles.css：`@import 'tailwindcss'` + `:root` 令牌 + 组件类迁移 + @font-face（Inter/JetBrains Mono woff2 下载入 public/fonts/）
- 现有 238 测试不回归（`scripts\verify.ps1` 全绿）

## Out of scope

- 布局重构（T-002）；W/L 与测量（T-003）；组件替换（T-004 前仅保留现有组件行为）

## Acceptance criteria

- [ ] Tailwind v4 生效（build 通过）；令牌与组件类可用
- [ ] 字体本地化：无 fonts.googleapis 请求（build 产物与 dev 均验证）
- [ ] 现有测试全绿（238）

## Test requirements

- [ ] Unit: `scripts\verify.ps1`
- [ ] Manual: dev 页面主题/字体正常

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查