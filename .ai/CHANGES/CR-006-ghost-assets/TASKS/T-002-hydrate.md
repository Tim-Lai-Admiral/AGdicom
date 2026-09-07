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