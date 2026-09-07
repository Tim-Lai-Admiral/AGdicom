# Task T-001: 资产删除能力

## Metadata

```yaml
id: T-001
cr: CR-006
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 18
depends_on: []
branch: feature/CR-006-T-001-delete-asset
```

## Context pack

- Requirement: R-015
- 关键文件：`src/domain/types.ts`（AppState 三容器）、`src/domain/review.ts`（新增 removeAsset 纯函数：删资产+评审历史+标签引用清理）、`src/store/repository.ts`（saveState）、`src/features/library/AssetGrid.tsx`（行内删除按钮，选中行）、`src/features/review/ReviewPanel.tsx`（删除入口）、`src/App.tsx`（接线：删除后清选中/清中央查看/清 series 分组）
- 参考：现有标签删除交互（removeAssetTag）；P-005（UI 测试 3~5 关键交互）
- 禁止：改持久化 schema；动 IndexedDB（T-003）

## Objective

提供资产删除：行内 + 评审面板入口，二次确认，级联清理评审历史与元数据，界面同步。

## Scope

- `domain/review.ts`：`removeAsset(state, assetId)` 纯函数（资产+review 记录+tag 引用清理；返回新 AppState）
- UI：AssetGrid 行内删除按钮（选中行显示，aria-label="删除素材 X"）+ ReviewPanel 删除入口；二次确认（confirm 或内联确认态）
- App 接线：删除后清空选中/查看器/元数据，series 分组即时重建
- 测试：纯函数（级联、无孤儿）+ 组件（删除流、确认/取消）
- `scripts\verify.ps1` 全绿

## Out of scope

- blob 删除（T-003）；水合（T-002）；幽灵自动清理

## Acceptance criteria

- [ ] 行内与评审面板删除均可用；确认/取消语义正确
- [ ] 删除后 review/tags 无孤儿（单测断言）；中央/选中状态清理
- [ ] 删除后重导入同文件可正常新增
- [ ] 259 存量不回归（净变化说明）

## Test requirements

- [ ] Unit: removeAsset 纯函数 + 组件流
- [ ] Manual: 三类素材各删一次

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查