# Task T-002: 重导入水合（幽灵复活）

## Metadata

```yaml
id: T-002
cr: CR-006
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 14
depends_on: [T-001]
branch: feature/CR-006-T-002-hydrate
```

## Context pack

- Requirement: R-014
- 关键文件：`src/features/library/importAssets.ts`（classifyImportFiles 去重逻辑：命中 duplicates 时跳过注册）、`src/features/library/useImport.ts`（objectUrl 附着与 saveState）、`src/features/library/ImportZone.tsx`（反馈文案）
- 现状：去重键 = fileName+fileSize+kind；命中即报"重复"并跳过 → 幽灵资产（无 objectUrl）无法复活
- 禁止：改持久化 schema；动 IndexedDB（T-003）；非幽灵去重行为

## Objective

去重命中且目标资产无可用 objectUrl（幽灵）时，重建 objectUrl 并回写该资产（不新增记录），反馈"已恢复预览"。

## Scope

- `importAssets.ts`（或 useImport 层）：classifyImportFiles 增加幽灵识别——命中重复时检查现有资产 objectUrl 是否存在（undefined = 幽灵）；幽灵 → 输出 hydrate 列表（assetId + File 引用），不产生 duplicate
- `useImport.ts`：对 hydrate 列表重建 objectUrl 并更新资产（saveState 持久化元数据，objectUrl 仍为会话字段）；反馈区分"已恢复预览"与"重复"
- `ImportZone.tsx`：反馈文案支持 hydrate 场景（中文）
- 测试：幽灵命中→复活（image 可预览断言）、非幽灵命中→仍报重复、水合后持久化不落 objectUrl、批量混合场景
- `scripts\verify.ps1` 全绿（271 存量不回归）

## Out of scope

- IndexedDB（T-003）；删除（T-001 已完成）；幽灵自动清理

## Acceptance criteria

- [ ] 幽灵资产重导入同文件 → 记录不新增、objectUrl 重建、预览恢复
- [ ] 非幽灵重导入 → 仍报"重复"（行为不变）
- [ ] 反馈文案区分两种场景
- [ ] 单测覆盖混合批次

## Test requirements

- [ ] Unit: classifyImportFiles/useImport 水合流
- [ ] Manual: 刷新后重导入同文件验证预览恢复

## Definition of done

- [ ] 验收通过；PR（body 写概要，注明含 T-001 提交链，按序合并）；Reviewer 审查

## Builder result

**实现摘要**

- `importAssets.ts`：`classifyImportFiles` 增加幽灵识别——库中存量记录按去重键（fileName+fileSize+kind）建索引时，`objectUrl === undefined` 的键登记为幽灵（ghostIdByKey）。命中重复键时先查幽灵：命中幽灵 → 输出 `hydrated` 项（assetId + fileName + fileSize + kind），不产生 duplicate、不新增记录；同批次同一幽灵键第二次命中回落为 duplicate（避免同资产重复水合）。新增 `ImportHydration` 类型，`ImportClassifyResult` 增加 `hydrated` 列表；纯函数边界不变（不修改入参、水合不触达 state，回写由 useImport 负责）。
- `useImport.ts`：新增 `hydrateGhosts`（复用提取的 `buildFileIndex`）——按 fileName+fileSize 匹配原始 File，`createObjectURL` 重建会话 objectUrl 并回写原资产（浅拷贝，不改元数据/updatedAt）；无法匹配 File 或环境不支持 createObjectURL 时保持原样（返回原引用）。持久化条件扩为 `created.length > 0 || hydrated.length > 0`（saveState 仍自动剥离 objectUrl，水合不改变落盘内容）。`ImportFeedback` 增加 `hydrated` 字段，与 duplicates 并列输出。
- `ImportZone.tsx`：反馈面板新增水合块"已恢复预览 N 个素材："（is-hydrated，success 色，styles.css 同步），条目按 assetId 列出"文件名（类型）"；空反馈判定纳入 hydrated。
- 未改持久化 schema、未动 IndexedDB、非幽灵去重行为不变（仅回归测试中把存量资产显式加上 objectUrl 以保持"非幽灵"语义）。

**文件清单**

- `src/features/library/importAssets.ts`（幽灵识别 + hydrated 输出）
- `src/features/library/useImport.ts`（hydrateGhosts + 反馈/持久化条件）
- `src/features/library/ImportZone.tsx`（水合反馈文案）
- `src/styles.css`（.is-hydrated 样式）
- 测试：`importAssets.test.ts`（+5：幽灵命中/非幽灵回归/四类混合/同批次单次水合/不改入参）、`useImport.test.tsx`（+2：幽灵复活含持久化断言/混合批次）、`ImportZone.test.tsx`（+1：水合文案渲染；既有反馈用例补 hydrated 字段）

**验证结果**

- `scripts\verify.ps1` 全绿：29 文件 279 测试通过（271 存量无回归 + 新增 8），`npm run build` 通过。
- 验收对照：幽灵重导入 → 记录不新增、objectUrl 重建、预览恢复（单测断言 blob URL + 记录数不变）✓；非幽灵重导入仍报"重复" ✓；反馈文案区分"已恢复预览"与"已存在，跳过" ✓；混合批次单测覆盖 ✓；水合后持久化不落 objectUrl（loadState 断言）✓。
- Manual（刷新后重导入同文件验证预览恢复）留给 Reviewer 按测试要求执行。

**Commit / PR**

- 分支 `feature/CR-006-T-002-hydrate`（基于 T-001 分支，含其提交链，PR 需按序合并 #28 → 本 PR）
- commit：`c109324` feat: 幽灵资产重导入水合（R-014）
- PR：见 Builder 报告（push 后创建，--base master）

**已知限制 / 需 Reviewer 关注点**

- 同批次同一幽灵键多次出现仅水合一次（其后按重复处理）——已用例锁定；库中同键多个幽灵资产只水合首个（去重键语义下不应存在多条同键记录，属防御性行为）。
- 水合不改 updatedAt（仅会话字段恢复，落盘内容不变）；如需"重导入时间戳"语义请 Planner 明确。
- 纯水合批次也会触发一次 saveState（内容与既有落盘相同）——保持流程统一，代价可忽略。