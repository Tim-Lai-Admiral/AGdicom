# Task T-001: 中央视口重构（四角元数据 + 滚轮同步 + 元数据表格下线）

## Metadata

```yaml
id: T-001
cr: CR-009
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 25
depends_on: []
branch: feature/CR-009-T-001-viewport
```

## Context pack

- Requirement: R-023/R-025；参考 rec/src/App.tsx Viewport（corner overlays、orientation markers、wheel handler、viewport-overlay 类已在 index.css）
- 关键文件：`src/features/viewer/dicom/DicomViewer.tsx`（元数据表格区块移除；视口叠加层；滚轮处理；底部滑条已存在——补同步）；`src/index.css`（.viewport-overlay 已有）
- 契约：DicomMeta 字段（patientName/patientID/modality/transferSyntax/rows/columns/pixelSpacing/seriesInstanceUID/instanceNumber/deidentified）；窗口状态 wc/ww 由 App 持有（CR-003）
- 禁止：改右栏 MetadataPanel（T-002 范畴外保持现状）；改测量；改持久化

## Objective

DICOM 中央查看从"弹层卡片+内嵌元数据表格"重构为工作台视口：四角元数据叠加、滚轮切片滚动、滑动条双向同步、中央表格下线。

## Scope

- DicomViewer：移除中央"元数据"表格区块（保留预览必需状态）；新增四角覆盖层（`.viewport-overlay`，mono，半透明）：左上患者/ID/日期时间；右上 Modal·Series/Inst#/N；左下 C/W/厚度/间距（实时）；右下 Zoom/Rot/平面（预留，值来自工具状态默认值）；方向标记（R/L/A/P 或 S/I，按 plane）
- 滚轮：视口 onWheel（非 Ctrl → 切片 ±1，边界不溢出；Ctrl+滚轮 → 缩放或保持现状并说明）；底部滑条 onWheel 同步（共享状态，已有 selectedAssetId 通路）
- 测试：四角内容正确性（合成样本字段）、滚轮切片边界、滚轮↔滑条同步、中央无元数据表格（grep）、降级路径不回归
- `scripts\verify.ps1` 全绿（346 存量不回归）

## Out of scope

- 工具按钮（T-002）；测量迁移；图片查看器；抽屉（T-003）；右栏面板结构

## Acceptance criteria

- [ ] 四角覆盖层显示且数值正确（合成样本）；C/W 随窗宽窗位实时更新
- [ ] 中央无元数据表格（grep "元数据"标题残留仅右栏保留）
- [ ] 滚轮滚动切片 + 与滑条双向同步（单测/集成）
- [ ] 压缩/损坏降级不回归（占位替代四角显示亦接受，需说明）

## Test requirements

- [ ] Unit: 视口/滚轮/同步
- [ ] Manual: 合成样本目检四角

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查