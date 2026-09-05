# Task T-002: 领域模型与存储

## Metadata

```yaml
id: T-002
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-001]
branch: feature/CR-001-T-002-domain-store
```

## Objective

定义 Asset / DicomMeta / ReviewRecord 等领域类型，实现 localStorage 仓储与 JSON 导入/导出（schema v1）。

## Context and inputs

- Requirement(s): R-005, R-009
- Current architecture/design references: CR-001 ARCHITECTURE.md（domain/store 模块）
- Dependency output: T-001 脚手架

## Scope

Allowed changes:

- `src/domain/types.ts`：AssetKind、AssetStatus、Asset、DicomMeta、ReviewRecord、ReviewHistory、Tag、AppState。
- `src/domain/review.ts`：状态流转与评审记录纯函数（增改历史、时间戳）。
- `src/store/repository.ts`：localStorage 读写（单 key，JSON 序列化，容量/损坏容错）。
- `src/store/io.ts`：JSON 导出（schema 版本 + 时间戳）与导入校验/恢复、名称冲突提示。
- `src/domain/*.test.ts`：vitest 单测。

## Out of scope

- 素材导入/文件处理（T-003）。
- UI 组件。

## Expected behavior

1. 仓储可保存/读取资产与评审记录；损坏数据回退空状态不崩溃。
2. 导出 JSON 含 `schemaVersion: 1` 与 `exportedAt`；导入可还原且版本不符时拒绝并提示。
3. 评审记录为追加式历史（每次评审意见留痕）。

## Acceptance criteria

### Functional

- [ ] 单测覆盖：仓储读写往返、损坏数据容错、评审历史追加、导入导出往返、版本不符拒绝。
- [ ] 导出文件含 schemaVersion 与 exportedAt。

### Error handling and compatibility

- [ ] localStorage 满或损坏时有提示与回退。
- [ ] Existing behavior remains compatible: 无既有行为。

### UI (if applicable)

- 不涉及。

## Technical constraints

- 类型集中在 `src/domain/types.ts`，其余模块不得自行定义领域类型。
- 导出 schema 一经发布不静默变更；变更须升版本。

## Implementation notes

- 资产 ID 使用 `crypto.randomUUID()`。
- localStorage key 如 `ag-review-workbench:v1`。

## Test requirements

- [ ] Unit: `npm test` 覆盖上述场景。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

- **任务ID**: T-002（领域模型与存储）
- **分支**: `feature/CR-001-T-002-domain-store`
- **Commit**: `0a39576` `feat: add domain types and store with json import/export`（7 files changed, 1250 insertions）

### 实现摘要

- `src/domain/types.ts`：全部领域类型集中定义（全项目唯一领域类型来源）——`AssetKind`（image/dicom/model）、`AssetStatus`（pending/passed/rejected）、`Asset`（含 `file: AssetFile{fileName,fileSize,fileType}`、可选 `dicomMeta`、可选会话字段 `objectUrl`）、`DicomMeta`（Modality/SOPClass/TransferSyntax/Rows/Columns/PixelSpacing/SeriesInstanceUID/PatientName/PatientID 可选，`sliceCount`+`deidentified` 必填，形状先定义、数据由 T-005 填充）、`ReviewRecord`（status+comment+createdAt）、`ReviewHistory = ReviewRecord[]`、`Tag`（name+count）、`AppState`（assets/tags/reviews 三个 Record 映射）。另附中文展示名常量 `ASSET_KIND_LABELS`/`ASSET_STATUS_LABELS` 与未知值守卫 `isAssetKind`/`isAssetStatus`（供导入校验复用，避免字面量集合重复定义）。
- `src/domain/review.ts`：评审纯函数——`applyReview`（状态+意见+时间戳原子提交，追加式历史）、`setAssetStatus`（等价于无意见评审提交，同样留痕）、`addAssetTag`/`removeAssetTag`（自建标签并入注册表、计数按实际使用重算、注册表条目保留可复用）。全部纯函数：不修改入参；资产不存在或空白标签名时返回原状态引用（不抛错）。
- `src/store/repository.ts`：localStorage 单 key（`ag-review-workbench:v1`）读写完整 AppState；`loadState` 损坏/结构不符回退空状态（`issue:'corrupted'`）、存储不可访问回退空状态（`issue:'storage-unavailable'`）、不崩溃；`saveState` 容量/写入异常抛 `RepositorySaveError`（可读中文提示，保留 cause）；`toPersistableState` 剥离会话字段 objectUrl（保存与导出共用同一规则）。
- `src/store/io.ts`：导出 `{ schemaVersion: 1, exportedAt(ISO), state }`（`buildExportFile`/`serializeExport`，2 空格缩进便于人工核对）；`parseImportFile` 深度校验（版本不符/非 JSON/结构非法均抛 `ImportFormatError`，message 可读中文、`issues` 携带全部问题路径）；`findNameConflicts` 按素材展示名称检测导入名称冲突（R-005 提示用，排序去重）。
- 单测：`src/domain/review.test.ts`（12）、`src/store/repository.test.ts`（8）、`src/store/io.test.ts`（14），共 34 个新测试（含脚手架冒烟共 35 全绿）。

### 验证结果

| 检查 | 结果 |
|---|---|
| `npm test`（vitest run） | 4 files / 35 tests passed（含 T-001 冒烟 1 个）✅ |
| `npm run build`（tsc -b && vite build） | 通过，无类型错误，产出 dist/（16 modules，built in 67ms）✅ |

覆盖验收场景：仓储读写往返、损坏数据容错（非法 JSON/错误结构/读异常）、评审历史追加、导入导出往返、版本不符拒绝、objectUrl 会话字段剥离、纯函数不变性。

### 修改文件

`src/domain/types.ts`、`src/domain/review.ts`、`src/domain/review.test.ts`、`src/store/repository.ts`、`src/store/repository.test.ts`、`src/store/io.ts`、`src/store/io.test.ts`（全部新建）。未改动 `.ai/`（本卡片除外）、`.opencode/`、`AGENTS.md`、`README.md`、脚手架文件。

### API 契约摘要（后续任务依赖）

- 类型：`AssetKind`/`AssetStatus`/`Asset`/`AssetFile`/`DicomMeta`/`ReviewRecord`/`ReviewHistory`/`Tag`/`AppState`（详见 types.ts JSDoc）。
- `domain/review.ts`：`applyReview(state, assetId, {status, comment?}, now?)`、`setAssetStatus(state, assetId, status, now?)`、`addAssetTag(state, assetId, name, now?)`、`removeAssetTag(state, assetId, name, now?)`，均返回新 AppState；`now` 缺省取当前时间（可注入固定 ISO 字符串）。
- `store/repository.ts`：`STORAGE_KEY`、`loadState(storage?) → {state, issue}`、`saveState(state, storage?)`、`RepositorySaveError`、`createEmptyState()`、`toPersistableState(state)`。
- `store/io.ts`：`EXPORT_SCHEMA_VERSION=1`、`buildExportFile(state, now?)`、`serializeExport(state, now?)`、`parseImportFile(text) → AppState`（失败抛 `ImportFormatError`）、`findNameConflicts(current, incoming) → string[]`。

### 已知限制

- `resolveStorage` 中"全局 localStorage 访问器抛异常"的防御分支未做单测覆盖（jsdom 无法稳定模拟该场景），其余分支均已覆盖。
- 导入校验为深度结构校验但不重算标签计数：手工编辑过的备份若计数陈旧，将按原样还原（下次标签增删时由纯函数按实际使用重算自愈）。
- 标签匹配区分大小写、按去空白后的精确名称（英文大小写不同的标签视为不同标签）。
- 导入语义为"整体还原"（parse 返回完整 state），名称冲突仅提供检测函数，由 T-007 UI 决定提示与覆盖交互。
- `DicomMeta.sliceCount`/`deidentified` 设计为必填（解析产物必须回答切片数与去标识化状态）；若 T-005 对损坏文件需要更稀疏的元数据，需回来调整此契约。
- localStorage 存储为 AppState 本体（无版本信封），未来破坏性数据变更靠递增 STORAGE_KEY 版本号（`ag-review-workbench:v2`）实现旧数据回退，已在 repository.ts 注释说明。

### 请 Reviewer 关注

1. `AppState` 三容器均为 `Record` 映射（assets 按 ID、tags 按标签名、reviews 按资产 ID）——确认该结构对 T-003/T-007 的调用方友好。
2. 领域纯函数对"资产不存在/空白标签"采用返回原状态引用的 no-op 策略（不抛错），而非抛出异常——确认该边界行为约定。
3. 每次状态变更（含无意见的 `setAssetStatus`）都会追加一条评审历史记录（"状态变更即评审留痕"）——确认这是期望的留痕粒度。
4. `objectUrl` 会话字段在保存与导出两侧统一剥离（`toPersistableState` 单一来源）——确认会话字段管理方式。
5. types.ts 除类型外还含中文标签常量与类型守卫（低风险实现细节，服务于类型契约单一来源）——确认可接受。
6. `findNameConflicts` 按 `asset.name`（展示名称）匹配冲突——T-007 UI 提示时如需改为 `file.fileName` 匹配请提出。

## Reviewer result

> Reviewer fills this using the Review template.