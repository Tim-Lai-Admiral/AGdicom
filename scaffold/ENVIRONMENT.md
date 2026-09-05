# ENVIRONMENT.md — 项目环境事实（Agent 必读）

> 新项目脚手架：把 <<占位符>> 替换为实际值后放入仓库根目录。所有 agent 开始工作前先读本文件。

## OS 与 Shell

- 平台：<<Windows / Linux / macOS>>；Shell：<<PowerShell 5.1 / bash>>
- **禁止 `&&`**（PowerShell 下）；顺序执行用 `;`，条件执行用 `if ($?) { ... }`
- 不要 `cd` 切目录；用工具的 workdir 参数指定目录

## 运行时

- Node.js <<v24.x>>（LTS），npm <<11.x>>；安装路径 <<C:\Program Files\nodejs>>
- 若 shell 未刷新 PATH：先执行 `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')`（Windows PowerShell）
- PowerShell 下 npm 用 `npm.cmd`（`npm` 别名可能被执行策略拦截；可 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 根治）

## 项目技术栈（<<项目名>>）

- <<Vite + React + TypeScript（strict）+ vitest（jsdom）等实际栈>>
- 测试/构建配置位置：<<vite.config.ts 等>>

## 统一验证（不要逐个重复执行）

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
```

局部修改时用 `<<npm.cmd test -- <文件>>>` 只跑受影响测试。

## Git 工作流（15 条规则见 `.ai/AGENTS.md` §6）

- 每个 Task 在独立分支：`feature/<CR-ID>-T-XXX-short-title`（名称含 CR 与 Task ID，见任务卡 Metadata.branch）
- Agent 禁止直接提交 main；禁止提交 node_modules/、dist/
- commit message 简洁中文，可带类型前缀（如 `feat: 基础实现`、`docs: 填写任务卡结果`、`fix: 修复类型错误`）
- Builder 完成 Task 后：push 分支到 origin → `gh pr create --base main`（body 写概要：实现摘要+验证+任务卡路径）→ PR 链接写入 Builder result
- Reviewer 按 PR 审查：`gh pr checkout <num>` → 独立验证 → 结论写入 REVIEW 文档
- Conflict 必须显式解决，禁止静默覆盖其他 Agent 的修改；合并权属 Human，合并后删除 Task 分支
- 重大版本用 Tag（`git tag vX.Y.Z`）
- 行尾规范：`.gitattributes`（`* text=auto`），不要手改行尾

## 素材与外部目录

- 外部素材（设计稿、样本数据等）放入 `<<rec/ 或 materials/>>` 目录并在 `.gitignore` 排除；Agent 默认只在仓库内工作，外部素材由协调者复制进仓库后使用

## 协作协议

- 角色与流转见 `.ai/AGENTS.md`；角色操作规范见 `.ai/AGENTS/`（BUILDER/REVIEWER/CODEX/UI_UX）
- 事实层级：Human 决定 > `.ai/CURRENT/` > `.ai/CHANGES/` 已批准文档 > main 代码 > 分支代码 > 推测
- 遇到停止条件（需求冲突、契约不清、目标文件被他人修改等）按 BLOCKED 格式报告，不要猜测绕过