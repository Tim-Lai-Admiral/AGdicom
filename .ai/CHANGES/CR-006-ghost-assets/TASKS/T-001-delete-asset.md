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

## Builder result

- **实现摘要**：
  - 领域：`removeAsset(state, assetId)` 纯函数——删除资产本体（含挂载的 DICOM 元数据）+ 级联清除其评审历史（无孤儿）+ 其标签按剩余素材重算计数（注册表保留条目、计数可归零便于复用，与 removeAssetTag 同一约定）；素材不存在时返回原引用。未触及持久化 schema 与 IndexedDB。
  - UI：AssetGrid 行内删除按钮（仅选中行显示：`selectedIds` ∪ `activeAssetId`，保证三类素材均有行内入口；aria-label=`删除素材 <名称>`）+ 内联确认态（确认/取消）；ReviewPanel 面板末尾删除入口 + 内联确认；两处入口在未传回调时不渲染（向后兼容）。
  - App 接线：`handleDeleteAsset` → removeAsset → 清 `activeAssetId`/`selectedIds`/`expandedDicomId` → commit 持久化；series 分组由剩余素材即时重建（派生数据）。
- **文件清单**：`src/domain/review.ts`、`src/domain/review.test.ts`、`src/features/library/AssetGrid.tsx(+test)`、`src/features/review/ReviewPanel.tsx(+test)`、`src/App.tsx`、`src/App.workbench.test.tsx`、`src/styles.css`
- **验证结果**：`scripts\verify.ps1` 全绿——271 tests / 29 files passed + `tsc -b && vite build` 成功；存量 259 零回归，净变化 +12（纯函数 +3、AssetGrid +3、ReviewPanel +3、App 集成 +3）。验收"删除后重导入同文件可正常新增"已由 App 集成测试覆盖（去重仅基于现存 assets，删除后重导入报"成功导入 1 个素材"）。
- **Commit / PR**：commit `a17eae7`（feature/CR-006-T-001-delete-asset）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/28
- **已知限制**：
  - IndexedDB blob 同步删除属 T-003/R-016（R-015 行为中的"若 T-003 已启用"条件未满足，本任务不实现）。
  - Manual 项"三类素材各删一次"待人工在浏览器验证。
- **需 Reviewer 关注**：
  - "选中行"取 `selectedIds ∪ activeAssetId` 的并集（卡片原文"选中行"未区分比较选中与工作台选中；并集保证 dicom/model 行也可行内删除，符合 R-015"任一素材可删"）。
  - 删除不追加评审留痕（资产与历史一并移除，R-015 明确行为）。
  - 行内确认态在行失去选中态时自动复位；ReviewPanel 切换素材时确认态复位（均有测试）。