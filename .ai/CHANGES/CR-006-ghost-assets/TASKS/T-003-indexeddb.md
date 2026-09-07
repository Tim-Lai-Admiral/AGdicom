# Task T-003: IndexedDB 二进制持久化

## Metadata

```yaml
id: T-003
cr: CR-006
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 30
depends_on: [T-002]
branch: feature/CR-006-T-003-indexeddb
```

## Context pack

- Requirement: R-016
- 关键文件：`src/store/repository.ts`（loadState 启动恢复点）、`src/features/library/useImport.ts`（导入时 blob 入库）、`src/App.tsx`（启动水合调用）、T-001 的 `removeAsset`（删除时删 blob）
- 技术：IndexedDB 原生 API 或封装；jsdom 无 IndexedDB → 用 `fake-indexeddb`（devDep）或注入式接口（推荐接口抽象 + fake-indexeddb 集成测试）
- 阈值：单文件 >20MB 不入库（走会话态 + T-002 水合兜底）
- 禁止：改 localStorage schema；导出 JSON 含二进制；阻塞导入流程

## Objective

文件 blob 持久化到 IndexedDB（≤20MB），刷新后启动自动恢复并重建 objectUrl；删除资产同步删 blob；配额/失败降级会话态。

## Scope

- 存储层 `src/store/blobStore.ts`（接口：`saveBlob(key, file)` / `loadBlob(key)` / `deleteBlob(key)` / `listBlobs()`；IndexedDB 实现；20MB 阈值常量 `BLOB_MAX_BYTES`；失败抛可读错误）
- `useImport.ts`：注册成功且 ≤20MB → saveBlob（异步，失败不阻塞，反馈提示）
- `App.tsx` 启动：loadState 后 listBlobs → 按去重键匹配资产 → 重建 objectUrl；幽灵资产有 blob → 复活（无需重导入）
- T-001 removeAsset 接线：删除时 deleteBlob（R-015 级联）
- 测试：fake-indexeddb（或注入式）覆盖 保存/恢复/删除/超限不入库/失败降级；App 启动恢复集成
- `scripts\verify.ps1` 全绿（279 存量不回归）

## Out of scope

- 配额管理策略（仅降级提示）；导出含二进制；幽灵自动清理

## Acceptance criteria

- [ ] 刷新后 ≤20MB 素材 objectUrl 自动恢复（image 预览可见、dicom/model 可打开）
- [ ] >20MB 不入库：会话内可用，刷新后走 T-002 水合（提示）
- [ ] 删除素材同步删 blob（IndexedDB 无残留）
- [ ] 写入失败/配额满 → 降级会话态 + 提示，不阻塞导入
- [ ] 单测覆盖上述场景

## Test requirements

- [ ] Unit: blobStore + 集成（fake-indexeddb 或注入）
- [ ] Manual: 刷新恢复、删除清理、大文件降级

## Definition of done

- [ ] 验收通过；PR（body 写概要，注明含 T-001/T-002 链，按序合并）；Reviewer 审查