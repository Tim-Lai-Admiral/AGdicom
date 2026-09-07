# Review: CR-006（PR #28~#31：删除 / 水合 / IndexedDB / 收尾）

## Metadata

```yaml
task: CR-006（T-001~T-004 合并审查）
cr: CR-006
reviewer: Reviewer
target_commit_or_pr: PR #28 / #29 / #30 / #31（栈式链，最终 #31 全链）
date: 2026-09-07
result: PASS
```

审查对象为 PR（`gh pr diff` + `gh pr checkout #31` 复跑），非 working tree。仅读 + 复跑 verify，未修改任何代码。

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| R-015 删除（T-001）目标满足 | pass | `removeAsset`（review.ts L188-207）级联清除 asset/reviews/tag 计数；行内（selected∪active）+ 评审面板双入口、内联二次确认；App L183-192 清 active/selected/expandedDicomId；App.workbench.test 覆盖"删除后重导入正常新增" |
| R-014 水合（T-002）目标满足 | pass | `classifyImportFiles`（importAssets.ts L145-174）以 `objectUrl===undefined` 识别幽灵→hydrated 列表；`hydrateGhosts`（useImport.ts L127-148）重建 objectUrl 回写不新增记录；非幽灵仍报重复；反馈"已恢复预览"（ImportZone.tsx L55-66）；持久化不落 objectUrl（repository.toPersistableState 剥离） |
| R-016 IndexedDB（T-003）目标满足 | pass | blobStore.ts 接口 + 字节方案（存 ArrayBuffer 规避 fake-indexeddb 克隆空对象）；`BLOB_MAX_BYTES=20MB`；启动恢复（blobPersistence.restoreAssetBlobs / App L75-99）；删除级联 deleteBlob（App L191）；失败降级（saveBlob 抛 BlobStoreError→persistBlobs allSettled 不抛、不阻塞） |
| T-004 收尾目标满足 | pass | 幽灵占位文案统一为「会话失效，可重新导入或删除该素材」（grep 覆盖 ImageStage/CompareView/AssetGrid/DicomViewer×3/Model3DViewer）；README/TD-001 更新一致；测试量不变（305） |
| 无越界改动 / schema 未改 | pass | objectUrl 仍会话字段（repository.toPersistableState 剥离，App.blobRestore.test 断言不落盘）；导出 JSON 经 io.ts 深度校验不含二进制；localStorage schema 未变（STORAGE_KEY 仍 `ag-review-workbench:v1`） |
| CURRENT / 架构尊重 | pass | 未改 types.ts 领域契约；blobStore 为新增存储层（CHANGE.md "minor" 已声明）；repository 未动 schema |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| 全量 verify（复跑） | pass | `scripts\verify.ps1` → **305 tests / 32 files passed** + `tsc -b && vite build` OK（预期 305，一致） |
| CI（gh pr checks） | pass | #28/#29/#30/#31 均 verify pass |
| 删除→重导入正常新增 | pass | App.workbench.test.tsx（review panel / inline row / DICOM 三例） |
| 幽灵命中 / 非幽灵重复 / 持久化不落 objectUrl | pass | importAssets.test(+5) / useImport.test(+2) / App.blobRestore.test(3) |
| blob 保存/恢复/删除/超限/失败降级 | pass | blobStore.test(10) / blobPersistence.test(8) / useImport.test(+4) / ImportZone 超限渲染 |
| Manual（真实浏览器） | not run | 三类素材各删一次、刷新恢复、大文件降级——需 Human 人工验证（见 Builder 已知限制） |

## Findings

### Blocker

- None

### Major

- None

### Minor / non-blocking

1. **T-003 水合幽灵也会写 blob（越界增强，已申报）** — useImport.ts L186-188 `persistBlobs` 对 `hydrated` 项同样入库。任务卡 Scope 仅写"注册成功"，Builder 已主动标注为"超出卡面字面范围、属 R-016 精神内增强"。行为合理（刷新自动恢复对水合资产同样成立，键与删除/恢复逻辑天然一致），不构成阻塞，但需确认 Planner 接受该扩展。
2. **去重键字面顺序偏差（已申报）** — `dedupKey` 实现为 `kind\0fileSize\0fileName`（importAssets.ts L109-111），与派发指令的 `fileName|fileSize|kind` 字面顺序不同。以"与 T-002 水合索引同源"为准绳，且全链路（保存/恢复/删除/水合）共用同一函数，无一致性风险。仅记录。
3. **反馈错误串拼接** — useImport.ts L236-239：当 saveState 已失败且 blob 也失败时，`error` 串接无分隔符，文案会连读（如"…保存失败X本地二进制保存失败…"）。纯文案，不阻塞。
4. **同去重键多记录的历史数据** — blobPersistence 按去重键匹配时，若历史数据存在同键多资产，恢复会为每条重建同一文件的独立 objectUrl（各自 URL 无共享冲突）。去重语义下不应存在，属防御性边界而已记录。

## Recommendation

**PASS**

四条 PR（#28→#29→#30→#31）按栈式链依序合并。实现满足 R-014/R-015/R-016 全部验收项，复跑 verify 305 tests + build 全绿，schema 未改、范围纪律守住（唯一越界"水合也写 blob"已申报且合理）。遗留均为非阻塞项。

合并前置提醒（信息不足项）：
- Manual 验收（真实浏览器三类素材删除、刷新自动恢复、>20MB 降级）在本审查环境无法执行，需 Human 在合并前人工确认；
- 若对"水合项也写 blob"有异议，需 Planner 明确是否接受该增强后方可合并。
