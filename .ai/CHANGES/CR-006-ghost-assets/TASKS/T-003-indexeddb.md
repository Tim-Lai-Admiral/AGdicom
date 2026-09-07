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

## Builder result

**实现摘要**

- `src/store/blobStore.ts`（新建）：BlobStore 接口（`saveBlob`/`loadBlob`/`deleteBlob`/`listBlobs`）+ `BLOB_MAX_BYTES`（20MB）+ `BlobStoreError`（可读中文）+ `createIndexedDbBlobStore`（可注入 IDBFactory/dbName/storeName）+ `defaultBlobStore` 单例（运行时读 `globalThis.indexedDB`）。存储记录为 `{key, fileName, fileType, lastModified, bytes: ArrayBuffer}`：保存时 `file.arrayBuffer()`，读取时按元数据重建 File——因 fake-indexeddb 的结构化克隆会把 File/Blob 克隆成空对象（已实测），统一存字节保证跨环境一致；记录损坏读取降级为 null。每次操作独立 open/close，无长连接。
- `src/features/library/importAssets.ts`：私有 `dedupKey` 导出——blob 键 = 去重键（`kind\0fileSize\0fileName`），与 T-002 水合索引同源（未采用派发指令中 `fileName|fileSize|kind` 字面顺序，以“与 T-002 一致”为准绳）。
- `src/features/library/blobPersistence.ts`（新建）：`restoreAssetBlobs`（启动恢复：listBlobs → 按去重键匹配无 objectUrl 的幽灵资产 → loadBlob → 重建 objectUrl；单资产失败跳过；存储不可用返回 error）与 `deleteAssetBlob`（删除级联：按去重键 deleteBlob，失败仅 console.warn 不阻塞删除）。
- `src/features/library/useImport.ts`：`persistBlobs`——注册成功与水合成功的文件（≤20MB）按去重键入库（**水合项同样入库**：刷新后可自动恢复，超出卡面字面范围，属 R-016 精神内增强）；>20MB 记入 `oversize` 不入库；`Promise.allSettled` 收集失败消息，绝不抛出、不阻塞导入。`ImportFeedback` 增加 `oversize`，error 合并 blob 失败提示（“本地二进制保存失败…预览仅本次会话可用，重导入同文件可恢复”）；`UseImportParams.blobStore` 支持注入。
- `src/features/library/ImportZone.tsx`：超限提示块（“以下 N 个文件超过 20.0MB，未存入本地二进制库”+ 文件名/类型/大小 + “重新导入同名文件可恢复预览”说明）；空反馈判定纳入 oversize。
- `src/App.tsx`：启动恢复 effect（loadState 后 `restoreAssetBlobs` → 函数式 setState 合并 objectUrl → 提示“已从本地恢复 N 个素材的预览（无需重新导入）”，role=status；存储不可用仅 console.warn 不打扰）；`handleDeleteAsset` 接线 `deleteAssetBlob`（R-015 × R-016 级联）。
- `src/styles.css`：`.import-feedback__item.is-oversize`（警示色）与 `.workbench .app__restore-info`（成功色提示条）。
- 未改 localStorage schema、导出 JSON 不含二进制、导入流程不被 blob 写入阻塞（验收红线均守住）。

**文件清单**

- 新建：`src/store/blobStore.ts`、`src/store/blobStore.test.ts`、`src/features/library/blobPersistence.ts`、`src/features/library/blobPersistence.test.ts`、`src/App.blobRestore.test.tsx`
- 修改：`src/features/library/importAssets.ts`（dedupKey 导出）、`src/features/library/useImport.ts`、`src/features/library/useImport.test.tsx`（+4 例、fake-indexeddb 环境）、`src/features/library/ImportZone.tsx`、`src/features/library/ImportZone.test.tsx`（字面量补 oversize + 超限渲染例）、`src/App.tsx`、`src/App.workbench.test.tsx`（1 处等待目标修正，见下）、`src/styles.css`、`package.json` / `package-lock.json`（fake-indexeddb@6.2.5 devDep）
- 检查点：`.ai/CHANGES/CR-006-ghost-assets/TASKS/T-003-CHECKPOINT.md`（会话中断记录，保留）

**验证结果**

- `scripts\verify.ps1` 全绿：32 文件 305 测试通过（279 存量无回归 + 26 新增），`npm run build` 通过。
- 新增覆盖：blobStore 读写删列/覆盖/损坏降级/不可用可读错误/注入隔离（10）；blobPersistence 恢复命中/已有 objectUrl 跳过/无匹配跳过/无 createObjectURL 降级/单资产失败跳过/存储不可用返回 error/删除按去重键/删除失败兜底（8）；useImport 入库/水合入库/超限不入库+oversize 反馈/失败降级不阻塞（4）；ImportZone 超限渲染（1）；App 集成：启动恢复预览可见（行缩略图 + ImageStage）且不落盘/删除级联无残留/无匹配不提示（3）。
- 存量测试修正 1 处（`App.workbench.test.tsx` 删除后重导入用例）：blob 入库使导入完成多一拍异步，旧断言先命中上一批反馈的同文本“成功导入 1 个素材”（等待目标改为列表计数“素材库（1）”，即导入完成的真信号）。产品行为无变化。
- jsdom 下无 IndexedDB 属预期降级：测试 stderr 中的“本地二进制存储不可用/删除失败”console 提示为降级路径日志，非错误。
- Manual（真实浏览器刷新恢复/删除清理/大文件降级）留给 Reviewer 按测试要求执行。

**Commit / PR**

- 分支 `feature/CR-006-T-003-indexeddb`（基于 T-002 分支，含 T-001/T-002 提交链）
- commit：`694b436` feat: IndexedDB 二进制持久化（R-016）
- PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/30（body 注明链：**按序合并 #28 → #29 → 本 PR**）

**已知限制 / 需 Reviewer 关注点**

- 水合幽灵也会写 blob（卡面 Scope 仅写“注册成功”；理由：刷新后自动恢复对水合资产同样成立，键与删除/恢复逻辑天然一致）。
- 同去重键理论上只应存在一条资产记录（去重语义）；若历史数据存在同键多记录，恢复会为每条重建同一文件的 objectUrl（各自独立 URL，无共享冲突）。
- blob 键与资产去重键绑定：重命名素材不改键（键基于原始 file 元数据，与 T-002 一致）。
- 每次操作独立 open/close IndexedDB（简单可靠）；若未来批量恢复出现性能问题，可复用连接，未做（Out of scope：配额管理/性能优化）。
- 测试环境注意：fake-indexeddb 每用例 `new IDBFactory()` 隔离；`URL.createObjectURL` 桩沿用 useImport.test 的描述符保存/恢复模式。