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

## Reviewer result

> Reviewer fills this using the Review template.