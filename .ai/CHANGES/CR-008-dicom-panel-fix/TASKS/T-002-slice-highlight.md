# Task T-002: 滑动条切片高亮同步

## Metadata

```yaml
id: T-002
cr: CR-008
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 12
depends_on: [T-001]
branch: feature/CR-008-T-002-slice-highlight
```

## Context pack

- Requirement: R-022
- 关键文件：`src/features/viewer/dicom/DicomViewer.tsx`（selectedAssetId 状态变化点：滑动条 onChange/步进/切片初始化）、`src/App.tsx`（activeSliceAssetId 状态：现仅由 selectAsset 设置，需新增独立 highLightSliceAssetId 或复用并加 onChange 通路）、`src/features/workbench/` 分组面板（消费高亮）
- 注意：高亮状态与"面板位置/展开状态"解耦（本任务只补状态通路，T-001 已改结构）
- 禁止：改变分组面板结构（T-001）；持久化

## Objective

中央查看器切片切换（滑动条等任意路径）时，通过 onSelectedSliceChange 上报，使左栏分组面板切片高亮实时跟随。

## Scope

- `DicomViewer`：新增可选 prop `onSelectedSliceChange?: (assetId: string) => void`；在 selectedAssetId 变化处调用（含初始选择、滑动条、步进）
- `App`：接入回调更新 `activeSliceAssetId`（左栏高亮数据源）；点击左栏切片仍走 selectAsset（现有行为不变）
- 测试：滑动条切换 → 高亮跟随断言；关闭查看器清理
- `scripts\verify.ps1` 全绿

## Out of scope

- 面板结构（T-001）；缩略图；持久化

## Acceptance criteria

- [ ] 滑动条拖动 → 左栏对应缩略图高亮实时更新
- [ ] 点击左栏切片 → 高亮/中央正确（不回归）
- [ ] 关闭查看器 → 高亮清理

## Test requirements

- [ ] Unit: DicomViewer 回调 + App 集成

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **实现摘要**：`DicomViewer` 新增可选 prop `onSelectedSliceChange?: (assetId: string) => void`，在 `selectedAssetId` 变化（初始选择 effect 挂载即报 + 滑动条 onChange 等任意路径）时上报切片素材 ID，经 ref 持有最新回调、`reportedSliceIdRef` 去重（同一素材 ID 不重复回调）；`App` 新增独立状态 `activeSliceAssetId` 作为左栏分组面板高亮数据源：`selectAsset` 按 DICOM/非 DICOM 设置/清理、查看器回调跟随更新、`closeActiveAsset`/删除对应素材时清理。面板结构与展开状态未动（T-001 结构保持）；点击左栏切片仍走 `selectAsset`。
- **文件清单**：`src/features/viewer/dicom/DicomViewer.tsx`（prop + 上报 effect + 头注释）、`src/App.tsx`（状态 + selectAsset/closeActiveAsset/handleDeleteAsset 接线 + handleDicomSliceChange + 传参）、`src/features/viewer/dicom/DicomViewer.test.tsx`（+2 用例：上报/去重、缺省回调）、`src/App.workbench.test.tsx`（+1 R-022 集成用例：滑动条跟随/点击不回归/关闭清理）
- **验证结果**：`scripts\verify.ps1` 全绿（36 文件 / 345 tests passed + build 通过）
- **Commit / PR**：commit `e8ff349`（分支 `feature/CR-008-T-002-slice-highlight`，含 T-001 commit 5d3e005）；PR #38（https://github.com/Tim-Lai-Admiral/AGdicom/pull/38，base master；**按序合并：先 #37 再本 PR**）
- **已知限制 / 技术债**：打开素材 A → 滑动条切到切片 B → 点击面板中 A 的缩略图时，`selectAsset` 同 id 不触发查看器重挂载（key=activeAsset.id，现有行为不变），中央停留在 B 而高亮回到 A。属"查看器内部选中 vs 面板点击"的原有解耦边界，未在本任务范围（现有行为不变）内改动，建议登记 TODO（受控选中或 nonce 重挂载需权衡解析缓存）。
- **需 Reviewer 关注**：① 上报 effect 的去重语义（同 ID 不重报）；② App 清理时机（关闭/切非 DICOM/删除）；③ jsdom 对 range input 有 min/max 钳制（`value:'5'` 实际生效为 max）——存量"越界值"用例实为两次钳制后还原，本次未改动该用例。
- **验证过程中的环境噪音**：`draws a measurement...`（W/L 测量）用例在两文件并行负载下偶发 waitFor 超时（改动前后均可复现、单文件 3/3 稳定、全量 verify 通过），判定为环境性 flake，非本次改动引入。