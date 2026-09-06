# Task T-003: 切片切换改滑动条（rec 样式）

## Metadata

```yaml
id: T-003
cr: CR-005
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 12
depends_on: []
branch: feature/CR-005-T-003-slice-slider
```

## Context pack

- Requirement: R-013；参考 rec/src/App.tsx 的 Viewport 底部导航（ChevLeft + `3 / 64` + range slider flex-1 + ChevRight + Pos 读数）
- 关键文件：`src/features/viewer/dicom/DicomViewer.tsx`（`dicom-viewer__slice-nav` 区块：‹上一张/› 按钮 + select 下拉）、`src/index.css`（.range-input 已有）
- 禁止：改测量/降级路径；改 W/L

## Objective

切片导航改为滑动条（range input，aria-label="选择切片"），移除上一张/下一张按钮与切片下拉；保留位置读数。

## Scope

- DicomViewer 导航区：slider（min=1..N，按 orderedSlices 索引映射）+ 读数（`切片 X / N（按 InstanceNumber 排序）`）
- 移除两个按钮与 select（含 handleStepSlice 若仅按钮使用）
- 测试适配：既有"switches slices by InstanceNumber"等用例改为 slider 交互；无按钮/下拉残留（grep）
- `scripts\verify.ps1` 全绿

## Out of scope

- rec 的其他导航元素（chevron 按钮、Pos mm 读数——如原实现无 mm 定位数据则不加）；测量

## Acceptance criteria

- [ ] slider 拖动切换切片并重绘（含边界 min/max 禁用态无溢出）
- [ ] 无"上一张/下一张"按钮与切片 select 残留
- [ ] 位置读数保留；measure/W-L 不回归

## Test requirements

- [ ] Unit: slider 交互 + 存量适配
- [ ] Manual: 合成样本拖动切片

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- 实现摘要：`DicomViewer` 切片导航改为 range slider（aria-label="选择切片"，min=1..max=N 按
  `orderedSlices` 索引映射，复用 `.range-input` 类 + flex:1，rec 样式），移除"上一张/下一张"按钮
  与切片 select 及 `handleStepSlice`；保留位置读数 `切片 X / N（按 InstanceNumber 排序）`，新增
  mono 计数读数（`X / N`，rec 风格）。`styles.css` 中 slice-button/slice-select 样式替换为
  slice-counter/slice-slider 样式。未触及测量/W-L/降级路径。
- 文件清单：`src/features/viewer/dicom/DicomViewer.tsx`、`src/styles.css`、
  `src/features/viewer/dicom/DicomViewer.test.tsx`（存量用例适配 slider 交互 + 新增越界值
  无溢出用例 + 焦点圈定用例适配）。
- 验证结果：`scripts\verify.ps1` 全绿（29 文件 / 259 tests passed，build OK）。
- commit：<见 PR>；分支：feature/CR-005-T-003-slice-slider
- 已知限制：rec 的 chevron 按钮与 Pos mm 读数未加（Out of scope，无 mm 定位数据）。
- 需 Reviewer 关注：jsdom 对 range input 不做 min/max 钳制，越界用例依赖组件守卫；浏览器端由
  原生钳制兜底。