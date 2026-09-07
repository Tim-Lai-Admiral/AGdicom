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

- [x] 验收通过（自验）；PR（body 写概要）；Reviewer 审查（待）

## Builder result

**状态**：实现 + 自验完成，待 Reviewer 审查（不标记 done）

### 实现摘要（R-023 / R-025）

- 移除中央"元数据"表格区块（含 metaMissingMessage；`dicom-viewer__partial-hint` 移至切片导航下方保留）；
- `.dicom-viewer__canvas-wrap` 内新增四角覆盖层（`.viewport-overlay`，mono 半透明，index.css 复用）+ 方向标记（`.dicom-viewer__orient`）：
  - 左上：患者名 / `ID: x` / 日期时间行（DicomMeta 契约无日期字段 → 以当前切片文件名占位，注释说明）
  - 右上：`{modality} · {去标识化 | 传输语法可读标签}`；series UID 截断（>20 字符加 `…`，title 悬停全文）；`Inst #N / M`（instanceNumber 缺失回退视口序位；M=分组切片数）
  - 左下：`C: {wc} W: {ww}`（App 持有的真实 wc/ww，随右栏 W/L 实时更新；auto 态追加"（自动）"标注）+ `PixelSpacing a × b mm/px`
  - 右下：`Zoom: 100%` / `AXIAL`（Zoom/Rot 为 T-002/R-024 工具状态预留默认；Rot 0° 不显示；plane 字段无 → 默认 AXL）
  - 方向标记：R/L/A/P（默认 AXL 口径）
- 滚轮（R-025）：视口容器原生 wheel 监听（`passive: false` 才能 preventDefault，React onWheel 做不到）；非 Ctrl → 切片 ±1（上下边界钳制不溢出；横向滚动忽略），经 `setSelectedAssetId` 与底部滑条共享状态双向同步，并复用 `onSelectedSliceChange` 上报左栏高亮；Ctrl/Cmd → 仅 preventDefault（缩放为 T-002 预留，注释说明）
- 死代码清理：viewer 表格死 CSS（`__meta`/`__table`/`__uid`/`__deid-*`/窄屏对应项）

### 文件清单

- `src/features/viewer/dicom/DicomViewer.tsx`（核心：四角覆盖层、滚轮同步、表格下线）
- `src/styles.css`（死 CSS 删除 + `.dicom-viewer__orient` 新增）
- `src/features/viewer/dicom/DicomViewer.test.tsx`（断言重写 + 新增 4 用例）
- `src/App.test.tsx` / `src/App.workbench.test.tsx` / `src/App.scenarioMatrix.test.tsx`（表格断言 → 四角断言）
- `.ai/CHANGES/CR-009-figma-viewport/TASKS/T-001-CHECKPOINT.md`（过程检查点）

### 验证结果

- `scripts\verify.ps1` 全绿：36 文件 / **350 测试通过**（346 存量 + 4 新增），`tsc -b` + `vite build` 成功
- grep：中央无 `dicom-viewer__meta/table` 类与"元数据"标题（右栏 MetadataPanel 保留为唯一来源）

### 已知限制（降级口径，见 DicomViewer.tsx 文件头注释）

- 日期行=当前切片文件名占位；SliceThickness 无字段省略；plane 默认 AXL；Zoom/Rot 默认值（T-002 预留）；auto W/L 展示 App 状态值并标注"（自动）"（真实 min/max 在解码器内部不外泄）
- 过程事故：测试文件曾被 PowerShell 编码管道损坏，已恢复并用 Edit 工具重做（详见 Checkpoint；规范记忆：中文文件禁用 PowerShell 内容管道）

### 需 Reviewer 关注

- 四角文案口径（`modality · 传输语法或去标识化`、`Inst #N / M`、UID 截断 20 字符）是否符合图一预期
- auto W/L 的 C/W 展示口径（状态值 + "（自动）"）是否可接受（备选：显示 "AUTO"）
- 滚轮采用原生 `passive:false` 监听（挂载一次 + ref 读最新切片）的实现方式与测试注入（`fireEvent.wheel`）