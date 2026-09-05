# Task T-003: DICOM 增强（W/L 调节 + 测量 Mock）

## Metadata

```yaml
id: T-003
cr: CR-003
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 25
depends_on: [T-002]
branch: feature/CR-003-T-003-dicom-enhance
```

## Context pack

- Requirement: R-003 修改（W/L）+ R-010（测量 Mock）
- 关键文件：`src/features/viewer/dicom/decodePixel.ts`（加 wc/ww 参数，缺省自动 min-max）、`DicomViewer.tsx`/右栏元数据面板（W/L 滑杆+6 预设）、视口（测量工具拖拽 + 覆盖层）
- 参考素材：`rec/src/App.tsx`（WINDOW_PRESETS、MeasureOverlay 结构，只读参考）
- 禁止：压缩/损坏降级路径回归；诊断/治疗暗示文案；测量结果持久化

## Objective

窗宽窗位调节（滑杆 C:-1000..1000 / W:1..4000 + Lung/Mediastinum/Bone/Brain/Liver/S.Tissue 预设）；测量工具 Mock（拖拽绘制 + PixelSpacing 确定性距离或 Mock 值，明示非临床）。

## Scope

- `decodeDicomFrame(dataset, frameIndex, opts?: {wc?, ww?})`：缺省自动 min-max；支持显式 WC/WW 映射
- 右栏 W/L 区块：双滑杆 + 数值显示 + 预设按钮（沿用 .range-input/.preset-btn 类）
- 测量工具：视口工具态 + 拖拽绘制线（端点+距离标注）+ "模拟测量，非临床" 提示；PixelSpacing 可用时按间距计算距离，否则 Mock（画布比例）；切换素材/切片清空
- 单测：wc/ww 映射（含边界 ww=1）、预设应用、测量距离计算、清空语义、降级不回归

## Out of scope

- 测量持久化/导出；多平面/旋转重建；曲线测量

## Acceptance criteria

- [ ] 默认预览行为与自动 min-max 等价（现有测试不回归）
- [ ] 滑杆与 6 预设实时生效
- [ ] 测量可拖拽绘制、标注距离、Mock 明示；PixelSpacing 路径确定性（单测）
- [ ] 压缩/损坏降级不变；切换清空测量

## Test requirements

- [ ] Unit: 上述场景（decodePixel.test 扩展）
- [ ] Manual: 合成样本 W/L 与测量手测

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查