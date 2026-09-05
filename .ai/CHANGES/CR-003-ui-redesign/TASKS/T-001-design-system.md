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

## Builder result

- **实现摘要**：
  - `npm i -D tailwindcss @tailwindcss/vite`；`vite.config.ts` 注册 `@tailwindcss/vite` 插件
  - 新建 `src/index.css` 设计系统入口：Tailwind v4（theme + utilities 层）+ 深色令牌（`--bg/--panel/--surface/--accent/--text-*/--warn/--danger/--success` 等自 rec/src/index.css 直接迁移）+ 基础组件类（tool-btn / range-input / preset-btn / sidebar-thumb / meta-row / meta-label / meta-value / section-header / viewport-overlay / font-mono-data / measuring-line / 细滚动条）+ `pulse-ring` keyframes
  - 字体本地化（R-009）：Inter（300–600 可变）与 JetBrains Mono（400–500 可变）woff2 各 latin/latin-ext 子集下载至 `public/fonts/`（4 个文件，共约 176KB），`@font-face` 指向 `/fonts/`，全链路无 fonts.googleapis/gstatic 请求
  - `src/main.tsx` 引入 `./index.css`（在 legacy `styles.css` 之后）
  - 有意决策：未启用 Tailwind preflight、未迁移 rec 的 body/html 全局规则 —— 现有浅色组件（T-004 前保持原行为）不受影响，深色令牌/组件类就绪待 T-002 布局重构使用；启用 preflight 只需补一行 import（见 index.css 头注释）
- **文件清单**：`vite.config.ts`、`src/index.css`（新增）、`src/main.tsx`、`package.json`、`package-lock.json`、`public/fonts/*.woff2`（4 个新增）
- **验证结果**：`scripts\verify.ps1` 全绿（24 文件 / 238 测试通过 + build 通过）；build 产物与 dev server 均确认无 fonts.googleapis/gstatic 引用，`/fonts/*.woff2` dev 可正常取到（200）；built CSS 含全部令牌与组件类
- **Commit**：9fdae4f（分支 feature/CR-003-T-001-design-system）
- **已知限制**：深色主题与 Inter/JBM 尚未应用到现有页面（属 T-002 布局重构范围）；`--font-sans-data/--font-mono-data` 令牌为新增（供 T-002+ 组件引用字体栈，语义与 rec 一致）
- **需 Reviewer 关注**：① preflight 关闭决策是否可接受（T-002 前现有 UI 零回归的保守选择）；② 字体仅 latin/latin-ext 子集，CJK 文本回退系统字体（Inter/JBM 本无 CJK 字形）；③ PR body 概要
