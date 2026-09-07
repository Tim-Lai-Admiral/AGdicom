# Checkpoint: T-003（IndexedDB 二进制持久化）

> 由协调者依据 Builder 40 步检查点报告落盘（2026-09-06）。恢复会话按此继续。

## Completed

- `fake-indexeddb@6.2.5` devDep 已装（package.json/lock 已改）
- `src/store/blobStore.ts`：BlobStore 接口（save/load/delete/list）+ `BLOB_MAX_BYTES=20MB` + `createIndexedDbBlobStore`（可注入 IDBFactory）+ 单例；记录存 `{key, fileName, fileType, lastModified, bytes: ArrayBuffer}`（fake-indexeddb 结构化克隆 File 会变空对象，故用 bytes 重建 File，鸭子判定 byteLength）
- `importAssets.ts`：`dedupKey` 导出（blob 键 = 去重键，`kind\0fileSize\0fileName`，与 T-002 水合索引同源）
- `src/features/library/blobPersistence.ts`：`restoreAssetBlobs` / `deleteAssetBlob`（单资产失败跳过；存储不可用返回 error 不阻塞）
- `useImport.ts`：`persistBlobs`（created+hydrated 入库；>20MB 记 oversize；allSettled 不抛）；`ImportFeedback.oversize`；`blobStore` 注入
- `ImportZone.tsx`：超限提示块 + 空反馈判定纳入 oversize
- `App.tsx`：启动恢复 effect（重建 objectUrl + "已从本地恢复 N 个素材的预览"）；删除接线 deleteAssetBlob
- `styles.css`：`.is-oversize` / `.app__restore-info`
- 测试：`blobStore.test.ts`（10）+ `blobPersistence.test.ts`（8）**已跑 18/18 全绿**；`useImport.test.tsx`（+4）、`ImportZone.test.tsx`（3 处补 `oversize: []` + 超限渲染）、`App.blobRestore.test.tsx`（3 例）**已写好未运行**

## Current approach

注入式 BlobStore 接口 + fake-indexeddb 单测；导入/水合/删除三条管线接入 blob 生命周期；启动恢复为独立 effect。

## Failed approaches

- 直接结构化克隆 File/Blob 入 fake-indexeddb → 克隆成空对象（已改用 bytes 重建）

## Remaining

1. 运行：`npm.cmd test -- src/features/library/useImport.test.tsx src/features/library/ImportZone.test.tsx src/App.blobRestore.test.tsx`，修复失败
2. 全量 `scripts\verify.ps1`（279 存量不回归；存量无 IDB 测试可能多一条 blob 降级提示，核对为正向断言即可）
3. 填任务卡 Builder result（不标 done）
4. 提交（含 package.json/lock）→ push → `gh pr create --base master`（body 注明链：**#28 → #29 → 本 PR**）

## Blocker

无。

## Recommendation

恢复同一 Builder 会话继续完成剩余步骤（测试→修复→verify→提交→PR）。