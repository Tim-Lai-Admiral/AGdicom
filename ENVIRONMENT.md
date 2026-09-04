# ENVIRONMENT.md — 项目环境事实（Agent 必读）

所有 agent 在开始工作前先读本文件，遇到与直觉不符的环境行为以本文件为准。

## OS 与 Shell

- 平台：Windows；Shell：PowerShell 5.1
- **禁止 `&&`**；顺序执行用 `;`，条件执行用 `if ($?) { ... }`
- **不要 `cd` 切目录**；用工具的 workdir 参数指定目录
- 中文路径/输出可能乱码，不影响功能

## Node.js

- Node v24.19.0（LTS），npm 11.17.0；安装在 `C:\Program Files\nodejs\`
- 新开的 shell 可能未刷新 PATH：直接使用完整路径 `C:\Program Files\nodejs\npm.cmd`，或先执行：
  ```powershell
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
  ```
- PowerShell 下 npm 一律用 `npm.cmd`（`npm` 别名可能被执行策略拦截）

## 项目技术栈（AGdicom 素材评审工作台）

- Vite 8 + React 19 + TypeScript 6（strict）+ vitest 5（jsdom，无 globals，RTL 需显式 cleanup()）
- 测试/构建环境配置内嵌于 `vite.config.ts`

## 统一验证（不要逐个重复执行）

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
```

`scripts/verify.ps1` 一次完成：刷新 PATH → `npm.cmd test` → `npm.cmd run build`。局部修改时可用 `npm.cmd test -- <文件或目录>` 只跑受影响测试。

## Git 工作流

- 每个 Task 在独立分支：`feature/CR-001-T-XXX-short-title`（见任务卡 Metadata.branch）
- 禁止直接提交到 master；禁止提交 node_modules/、dist/
- commit message 简洁中文，可带类型前缀（如 `feat: 3D 查看器基础实现`、`docs: 填写任务卡结果`、`fix: 修复切片解码类型错误`）

## 素材与外部目录

- 外部素材（如 `D:\BaiduNetdiskDownload\...`）由协调者复制进仓库（`public/samples/`）后供使用
- Agent 默认**只在仓库内工作**；不要主动读取工作区外目录（权限虽开放，属协议约束）
- 任务卡引用 `../DEMO SET/stl/` 等外部路径时，先检查仓库内是否已有副本

## 协作协议

- 角色与流转见 `.ai/AGENTS.md`；角色操作规范见 `.ai/AGENTS/`（BUILDER/REVIEWER/CODEX/UI_UX）
- 事实层级：Human 决定 > `.ai/CURRENT/` > `.ai/CHANGES/` 已批准文档 > master 代码 > 分支代码 > 推测
- 遇到停止条件（需求冲突、契约不清、目标文件被他人修改等）按 BLOCKED 格式报告，不要猜测绕过