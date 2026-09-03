# Task T-001: 环境与脚手架

## Metadata

```yaml
id: T-001
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: []
branch: feature/CR-001-T-001-scaffold
```

## Objective

安装 Node.js LTS，创建可运行的 Vite + React + TypeScript 工程并安装全部运行时依赖。

## Context and inputs

- Requirement(s): R-009
- Current architecture/design references: CR-001 ARCHITECTURE.md
- Dependency output: none

## Scope

Allowed changes:

- 系统环境：winget 安装 Node.js LTS（或官方安装包/nvm-windows 兜底）。
- `package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、`src/main.tsx`、`src/App.tsx`、`src/styles.css`。
- 依赖：react、react-dom、typescript、vite、@vitejs/plugin-react、three、@types/three、dicom-parser、vitest、@testing-library/react（如需）。
- `README.md` 骨架（安装/启动命令占位）。
- `.gitignore` 补充 node_modules 等。

## Out of scope

- 任何业务功能代码（domain/store/features）。
- 样式设计细节。

## Expected behavior

1. `npm install` 无错误完成。
2. `npm run dev` 启动本地开发服务器，页面显示占位内容。
3. `npm run build` 产出 `dist/` 无类型错误。
4. `npm test`（vitest）可运行空测试。

## Acceptance criteria

### Functional

- [ ] `node --version` 为 LTS 版本。
- [ ] `npm run build` 通过（含 TypeScript 检查）。
- [ ] `npm run dev` 可访问并渲染占位页面。

### Error handling and compatibility

- [ ] 若 winget 安装失败，回退方案记录在任务结果中。
- [ ] Existing behavior remains compatible: 仓库原有 `.ai/` 与根 `AGENTS.md` 不被修改。

### UI (if applicable)

- [ ] 占位页可显示中文文案。

## Technical constraints

- TypeScript strict 模式开启。
- 不使用 UI 框架（手写 CSS）。

## Implementation notes

- Node LTS 安装命令：`winget install OpenJS.NodeJS.LTS`（或 `OpenJS.NodeJS`）。
- 脚手架可用 `npm create vite@latest . -- --template react-ts` 生成后精简。

## Test requirements

- [ ] Unit: `npm test` 跑通一个占位测试。
- [ ] Integration: `npm run build` 成功。
- [ ] Manual/E2E: `npm run dev` 打开页面可见占位内容。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Relevant documentation updated, if required.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

- **任务ID**: T-001（环境与脚手架）
- **分支**: `feature/CR-001-T-001-scaffold`
- **Commit**: `56b4605` `feat: scaffold vite react ts project`（13 files changed, 2243 insertions）

### 实现摘要

- Node.js 安装：`winget install OpenJS.NodeJS.LTS --source winget ...` 成功（首次尝试 msstore 源连接失败 `0x80072efd`，按提示指定 `--source winget` 后成功，无需官方安装包兜底）。安装后新 shell PATH 未自动刷新，每条命令前用机器/用户 PATH 重建 `$env:Path`；npm 需用 `npm.cmd`（PowerShell 执行策略阻止 `npm.ps1`）。
- 脚手架：`npm create vite@latest tmp-scaffold -- --template react-ts`（create-vite 9.2.0 模板：Vite 8 / React 19 / TS 6）生成后移入仓库根目录并精简（删除 oxlint 配置、模板样式/素材、favicon），`tmp-scaffold/` 已删除未入库。
- `src/App.tsx` 渲染中文占位页：`<h1>素材评审工作台</h1>` + `<p>脚手架就绪</p>`，`index.html` 为 `lang="zh-CN"` + 中文标题。
- TypeScript strict：模板 tsconfig.app.json 未显式包含 strict，已按任务技术约束显式添加 `"strict": true`。
- vitest 配置内嵌于 `vite.config.ts`（`defineConfig` 来自 `vitest/config`，`test.environment: 'jsdom'`），测试入口 `src/App.test.tsx` 用 @testing-library/react 渲染断言中文文案。

### 环境

- Node `v24.19.0`（LTS），npm `11.17.0`

### 依赖清单（实际安装版本）

| 运行时 | 开发 |
|---|---|
| react@19.2.8, react-dom@19.2.8, three@0.185.1, dicom-parser@1.8.21 | typescript@6.0.3, vite@8.2.2, @vitejs/plugin-react@6.1.1, vitest@5.0.0, jsdom@30.0.1, @testing-library/react@16.3.3, @types/react@19.2.18, @types/react-dom@19.2.7, @types/three@0.185.4, @types/node@24.13.3 |

### 修改文件

`package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/App.test.tsx`, `README.md`（新建）；`.gitignore`（追加 node_modules/dist/dist-ssr/*.local）。`.ai/`、`.opencode/`、根 `AGENTS.md` 未改动。

### 验证结果

| 检查 | 结果 |
|---|---|
| `node --version` | v24.19.0（LTS）✅ |
| `npm install` | 108 packages，无错误 ✅ |
| `npm run build`（tsc -b && vite build） | 通过，无类型错误，产出 dist/（16 modules，built in 67ms）✅ |
| `npm test`（vitest run） | 1 test passed（`src/App.test.tsx`）✅ |
| `npm run dev` | HTTP 200（端口 5199），按 UTF-8 解码确认返回 HTML 含"素材评审工作台"标题与 `/src/main.tsx` 入口，验证后进程树已终止、端口关闭 ✅ |

### 已知限制

- 未提交 lint 工具链（模板 oxlint 已移除，任务依赖清单未要求 linter）。
- Windows 下 npm 须用 `npm.cmd` 调用（PowerShell 执行策略限制 `npm.ps1`）；对 CI/其他 Agent 无影响（cmd/npm 原生调用不受限）。
- three / dicom-parser 已安装但本任务未使用（按 Out of scope，接入由后续 Viewer 任务完成）。
- 未验证 `npm run preview`（不在验收标准内）。

### 请 Reviewer 关注

1. 依赖版本较新（Vite 8 / TS 6 / React 19 / vitest 5），均为 create-vite 9.2.0 官方模板自带或 npm 解析的兼容组合，`npm ls` 无 peer 冲突；如需保守降级请指出目标版本。
2. `vite.config.ts` 使用 `vitest/config` 的 `defineConfig`（而非独立 vitest.config.ts），确认该组织方式可接受。
3. 占位测试为渲染冒烟测试（RTL + jsdom），后续任务可沿用该测试模式。
4. `.gitignore` 仅追加 Node 构建段，原有规则未动。

## Reviewer result

> Reviewer fills this using the Review template.