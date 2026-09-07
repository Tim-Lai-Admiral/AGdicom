# Checkpoint: T-001（中央视口重构）

> 协调者依据 Builder 35 步硬检查点报告落盘（2026-09-07）。恢复会话按此继续。

## Completed

- DicomViewer.tsx（已改）：移除中央元数据表格区块（`dicom-viewer__meta` 整节）与 metaMissingMessage；partial-hint 移至切片导航下方；canvas-wrap 内四角覆盖层（左上患者名/ID/文件名；右上 `{modality} · {去标识化|transferSyntaxLabel}` + series UID 截断(>20字符加…) + `Inst #N / M`；左下 `C: {wc>0?'+':''}{wc} W: {ww}` 单空格 + `（自动）` 标注 + `a × b mm/px`；右下 `Zoom: 100%`/`AXIAL`，Rot 0° 不显示）；方向标记 R/L/A/P（`.dicom-viewer__orient`）；滚轮 wheel 原生监听（passive:false，非 Ctrl 切片 ±1 边界钳制经 setSelectedAssetId 双向同步；Ctrl 仅 preventDefault 预留给缩放）；imports 清理（删 sopClassLabel/DEID_EVIDENCE_LABELS，留 transferSyntaxLabel）
- styles.css（已改）：删除 `__meta/__table/__uid/__deid-*/__meta-missing` 死 CSS；新增 `.dicom-viewer__orient`；保留 `.dicom-viewer__partial-hint`
- App 侧断言（已改，安全）：App.test.tsx / App.workbench.test.tsx / App.scenarioMatrix.test.tsx（`CT · 去标识化`、`Inst #…`、`已置空` 等）
- 首轮测试：27 过 25（2 败=旧 C/W 双空格匹配，组件已修为单空格）

## Critical：DicomViewer.test.tsx 编码事故（最优先）

PowerShell `-replace + Set-Content -Encoding utf8` 以 GBK 误读回写 → 中文全乱码。
恢复：`git checkout -- src/features/viewer/dicom/DicomViewer.test.tsx`（该文件未提交，master 原版完好）→ **只用 Edit/Read 工具**重做测试改动（本项目规范：绝不使用 PowerShell 内容管道改含中文文件）。

## Remaining

1. 恢复+重做 DicomViewer.test.tsx（要点见 Builder 报告 6 大项：四角覆盖层+无中央表格用例；非去标识化默认 fixture 用例；C/W 实时更新 rerender 用例；旧断言替换 `3 张（本序列）→Inst #1 / N`（两处）、`#1→Inst #1 / N`、压缩用例 deid、JPEG2000 用例去 deid 选项、刷新降级用例；新增 describe 滚轮↔滑条双向同步 R-025（wheel 事件钳制/双向/onSelectedSliceChange 末次/Ctrl 不变））
2. `scripts\verify.ps1` 全绿（346 存量 + 新增）
3. grep 中央无"元数据"表格残留（右栏保留）
4. 填 Builder result；commit（中文）；push；`gh pr create --base master`（body 概要 + 已知限制）

## Known limits（PR 说明）

- DicomMeta 无日期/厚度/plane 字段：日期行=文件名占位、厚度省略、平面默认 AXL；Zoom/Rot 默认（T-002 预留）；auto 态 C/W 显示 App 状态值并标"（自动）"

## Blocker

无协议级阻塞；仅编码事故（按恢复流程处理）。

## Recommendation

恢复同一 Builder 会话继续（约 10 步内完成）。