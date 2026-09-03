# Architecture Delta: CR-001

> L3 变更，Human 已于 2026-09-03 批准。

## Current relevant architecture

仓库仅有 `.ai` 协作脚手架，无产品代码；无既有架构可影响。

## Problem

需要从零搭建一个可运行的素材评审工作台。约束：本机无 Node.js（需先安装）、Python 3.11 可用、网络可用；题目允许纯前端 + 浏览器存储。

## Proposed change

```text
Before: （无）

After:
  Vite + React + TypeScript SPA（无后端）
  ├── src/domain/     # 类型与纯函数：Asset / DicomMeta / ReviewRecord / 筛选与分类
  ├── src/store/      # localStorage 仓储 + JSON 导入/导出（权威备份）
  ├── src/features/
  │   ├── library/    # 素材库：导入(拖拽/文件选择)、分类、筛选、网格、比较
  │   ├── viewer/     # 查看器：图片 / DICOM(元数据+Canvas切片预览) / 3D(three.js)
  │   ├── review/     # 评审面板：状态、标签、备注、历史
  │   └── ai/         # Mock AI：命名/标签/摘要建议（确定性规则，AIProvider 接口）
  ├── scripts/        # pydicom 合成 DICOM 样本脚本（开发期一次性）
  └── public/samples/ # stl/(4个心脏模型) + dicom/(合成 phantom 系列)
```

关键第三方：three.js（STLLoader + OrbitControls）、dicom-parser（元数据解析）、vitest（单测）。

## Module and contract changes

| Component / contract | Change | Compatibility / migration |
|---|---|---|
| domain 类型 | 新增 Asset / DicomMeta / ReviewRecord / ReviewHistory | 无既有代码 |
| store 仓储 | 新增 localStorage 仓储 + JSON schema v1 导入/导出 | 导出文件含 schema 版本字段 |
| AIProvider 接口 | 新增建议接口（mock 实现） | 未来真实 AI 实现同接口 |
| DICOM 解析 | dicom-parser 读取元数据；Canvas 渲染无压缩像素 | 压缩/损坏降级为仅元数据 |

## Alternatives considered

### Option A（选定）：纯前端 SPA（Vite + React + TS）

- 收益：无后端运维、状态在浏览器、构建产物可静态部署；React 生态成熟。
- 代价：需先安装 Node.js；大文件完全依赖浏览器内存（STL 14MB 可接受）。

### Option B：Flask + pydicom 后端 + 原生 JS 前端

- 收益：可用现有 Python，pydicom 解析成熟、可离线处理压缩编码。
- 代价：需要运行两个进程/一个服务器；用户已选择 Node 方案。

### Option C：纯静态页面（手写 DICOM 解析）

- 收益：零依赖。
- 代价：DICOM 解析风险高、无切片预览、可维护性差。

## Recommendation

Option A：技术栈由 Human 指定（Node + Vite + React），架构上采用纯前端 SPA 满足题目"不要求完整后端"的约束。

## Risks and tests

- Risk: Node 安装失败 → 缓解：winget 失败时改用官方安装包/nvm-windows；最终兜底 Option B（需 Human 批准切换）。
- Risk: 大 STL 内存占用 → 缓解：加载进度提示；网格过大时提示。
- Risk: 非标准 DICOM 文件解析失败 → 缓解：统一降级路径，不崩溃（R-003）。
- Test: 领域纯函数（分类/筛选/去重/Mock AI 确定性）vitest 单测；手动 E2E 清单覆盖核心流程（R-009）。

## Approval

- [x] Human approved on 2026-09-03