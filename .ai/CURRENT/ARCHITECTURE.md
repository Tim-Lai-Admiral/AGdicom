# Current Architecture

> 主线架构事实（CR-001 + CR-002，2026-09-05 合并）。设计草案见各 CR 的 ARCHITECTURE.md。

## System overview

```text
浏览器（无后端）
Vite + React 19 + TypeScript 6（strict）
├── src/domain/     领域类型与纯函数：types（Asset/DicomMeta/ReviewRecord/AppState）、
│                   review（评审/标签/备注）、filter（筛选）
├── src/store/      localStorage 仓储（单 key ag-review-workbench:v1）+ JSON 导入导出（schema v1）
├── src/features/
│   ├── library/    导入（拖拽/文件选择、分类、去重）、素材库网格、筛选、状态徽标、双图比较
│   ├── viewer/     dicom/（dicom-parser 元数据 + Canvas 切片预览 + 降级）｜
│   │               model3d/（three.js STLLoader+OrbitControls，React.lazy 按需拆包）
│   ├── review/     评审面板（状态/意见/标签/备注）、历史、导出导入
│   └── ai/         AIProvider 接口 + Mock 确定性实现 + AiPanel
└── public/samples/ stl/（4 个心脏模型）+ dicom/（pydicom 合成 3 series×6 切片）
```

## Module boundaries

| Module | Owns | May depend on | Must not depend on |
|---|---|---|---|
| domain | 类型、纯函数、不变量 | — | store / features / DOM / 外部库 |
| store | localStorage、导出导入、schema 校验 | domain | features / DOM |
| features/library | 导入、网格、筛选、比较 UI | domain, store | viewer / review / ai |
| features/viewer | DICOM 解析与预览、3D 渲染 | domain, store（asset 数据） | review / ai |
| features/review | 评审面板、历史、导出导入 UI | domain, store | viewer / ai（AiPanel 由 review 内嵌，经 props 交互） |
| features/ai | AIProvider 接口与 Mock 实现 | domain | 具体 UI |

## Data and API contracts

- `Asset`：id/name/kind(image|dicom|model)/status(pending|passed|rejected)/tags/note/source/file{fileName,fileSize,fileType}/dicomMeta?/createdAt/updatedAt/objectUrl?（会话级，不持久化）
- `DicomMeta`：可选元数据字段 + sliceCount + deidentified（含 evidence）；series 按 SeriesInstanceUID 分组，无 UID 单独成组
- `AppState`：assets/tags/reviews 三容器；评审为追加式历史（ReviewRecord{status,comment,createdAt}）
- 导出 JSON：`{schemaVersion: 1, exportedAt, state}`；导入深度校验，版本/结构非法拒绝
- localStorage key：`ag-review-workbench:v1`；objectUrl 不落盘（刷新后需重导入，TD-001）
- AIProvider：`suggest(asset) → AiSuggestion{name, tags, summary}`，当前唯一实现为 Mock（确定性）

## Dependency rules

- UI 只经 domain 纯函数 + store 仓储修改状态；禁止直接写 localStorage。
- 领域类型单一事实来源 `src/domain/types.ts`；其余模块不得自行定义领域类型。
- viewer/review/ai 之间不互相依赖（review 内嵌 AiPanel 通过可选 props 交互）。

## Architecture decisions

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | 纯前端 SPA（Vite+React+TS），无后端；localStorage + JSON 备份（题目允许"不要求完整后端"） | accepted |
| ADR-002 | DICOM 用 dicom-parser（纯 JS 元数据）；像素解码仅支持无压缩 Little Endian 8/16-bit，其余降级"仅元数据" | accepted |
| ADR-003 | 3D 用 three.js（STLLoader+OrbitControls），React.lazy 按需拆包；不引入 react-three-fiber | accepted |
| ADR-004 | AI 用 AIProvider 接口 + Mock 确定性实现；未来真实接入同接口 | accepted |
| ADR-005 | 协作流程：任务卡 Context pack + 极简派发 prompt + 软步数检查点 + Spike 门禁（P-001~P-003） | accepted |
| ADR-006 | Git 15 条规则（P-004，全文 .ai/AGENTS.md §6）：PR 工作流、CI、Human 合并权 | accepted |

## Last updated

- Date: 2026-09-05
- Source: CR-001 + CR-002
- Approved by: Human