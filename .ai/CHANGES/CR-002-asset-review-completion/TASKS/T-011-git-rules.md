# Task T-011: Git 规则落地（文档 + CI + PR 工作流）

## Metadata

```yaml
id: T-011
cr: CR-002
type: docs
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 12
depends_on: [T-008]
branch: feature/CR-002-T-011-git-rules
```

## Context pack

- Requirement: P-004（CR-002，Human 2026-09-04 发布的 15 条 Git 规则）
- 关键文件：`.ai/AGENTS.md` §6（重写）、`ENVIRONMENT.md`（Git 工作流节）、`.ai/CHANGES/CR-002-asset-review-completion/REQUIREMENTS.md`（新增 P-004）、`.opencode/agent/builder.md` / `builder-flash.md` / `reviewer.md`（PR 工作流提示词）、`.gitattributes`（新建）、`.github/workflows/ci.yml`（新建）、`package.json`（oxlint）
- 环境：gh 2.99.0 可用，origin 推送凭据正常
- 禁止：不改产品代码；不合并任何既有分支（合并属 Human 权限）；不改 `.ai/AGENTS.md` 其他章节

## Objective

将 Human 的 15 条 Git 规则固化为文档、CI 与 agent 提示词，并让本任务自身示范 PR 工作流（push + `gh pr create`）。

## Scope

- `.ai/AGENTS.md` §6 重写为 15 条规则（"main"指默认分支，本仓库当前为 master）
- `ENVIRONMENT.md` Git 节：分支命名含 CR+Task ID、完成后 push+PR、冲突显式解决、合并后删分支、重大版本 Tag
- CR-002 `REQUIREMENTS.md` 新增 P-004 + `CHANGE.md` 登记
- `.gitattributes`：`* text=auto` + `*.stl`/`*.dcm` 标记 binary
- `.github/workflows/ci.yml`：push/PR → `npm ci` → `npm run lint` → `npm test` → `npm run build`
- `package.json`：devDep `oxlint` + `lint` 脚本（先本地跑通，修复既有 lint error）
- builder/builder-flash/reviewer 提示词：Builder 完成后 push+建 PR；Reviewer 审查 PR diff（`gh pr checkout`）而非 working tree

## Out of scope

- 既有 8 个分支的补建 PR（协调者另行征询 Human）
- 默认分支 rename（master→main）
- Git LFS

## Acceptance criteria

- [ ] 15 条规则全部写入 `.ai/AGENTS.md` §6
- [ ] CI workflow 文件存在且覆盖 lint/test/build；本地 oxlint 无 error
- [ ] 三个 agent 提示词含 PR 工作流
- [ ] 本任务自身：分支提交后 push + `gh pr create` 成功（示范规则 6）
- [ ] `scripts\verify.ps1` 全绿（产品测试不回归）

## Test requirements

- [ ] Unit: 无（文档/配置变更）；`npm run lint` 通过
- [ ] Integration: CI workflow 语法可被 GitHub 接受（YAML 校验）

## Definition of done

- [ ] 验收通过；填 Builder result；PR 创建成功，等待 Reviewer 按 PR 审查