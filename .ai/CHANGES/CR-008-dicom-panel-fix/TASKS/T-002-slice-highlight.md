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