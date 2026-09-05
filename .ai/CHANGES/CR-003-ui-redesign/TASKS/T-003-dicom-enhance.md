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

## Builder result

- **实现摘要**：
  - `decodeDicomFrame(dataset, frameIndex, opts?: {wc?, ww?})`（R-003 修改）：显式 WC/WW 时按 DICOM PS3.3 C.11.2.1.2.1 线性窗映射（ww=1 为阈值分支、不除零）；wc/ww 缺省、非有限或 ww<1 → 回退自动 min-max，默认路径与原实现逐字节等价（存量测试零改动通过）。MONOCHROME1 反转在窗映射之后照常应用。
  - 新增 `windowLevel.ts`：六档预设 `WINDOW_PRESETS`（取值同参考稿 rec/src/App.tsx：Lung -600/1500、Mediastinum 40/400、Bone 400/1800、Brain 40/80、Liver 60/160、S. Tissue 50/350）、滑杆范围 C:-1000..1000 / W:1..4000、状态模型 `{auto, wc, ww}` 与默认 `AUTO_WINDOW_LEVEL`。
  - 新增右栏 `WindowLevelPanel`（workbench）：C/W 双滑杆（`.range-input`）+ 数值显示 + 六档预设（`.preset-btn`）+“自动 min-max”按钮；auto 态明确提示“当前：自动（min-max）”，拖动滑杆/点预设即切手动并实时生效（App 持有状态 → DicomViewer 重解码）。App 在切换素材时将 W/L 复位为自动。
  - 测量工具 Mock（R-010）：DicomViewer 预览区新增“测量（模拟）”工具态（aria-pressed，十字光标）+“清空测量”按钮；拖拽绘制线（草稿虚线 + 落笔实线、双端点 + 距离标注，SVG 覆盖层与画布同为 contain-fit 对齐）；工具激活或有测量时明示“模拟测量，非临床：距离标注仅供界面演示”。
  - 距离口径：PixelSpacing 可用（[行间距,列间距] 均正有限）→ 确定性毫米（行间距作用纵向、列间距横向）；否则 Mock（图像像素距离，标注“≈ N px（模拟）”）。端点经 `clientToImagePoint`（object-fit: contain 信箱映射）换算到图像像素坐标，出界收拢。
  - 清空语义：切换切片即清空（组件内 effect）；切换素材由 App 以 `key={asset.id}` 重挂载达成；测量不持久化。预览未渲染（压缩/损坏降级）时测量按钮禁用，降级路径零回归。
- **文件清单**：`src/features/viewer/dicom/decodePixel.ts`（wc/ww 参数）、`windowLevel.ts`（新增）、`measure.ts`（新增，纯计算层）、`DicomViewer.tsx`（W/L 消费 + 测量工具）、`src/features/workbench/WindowLevelPanel.tsx`（新增）、`src/App.tsx`（W/L 状态 + 面板挂载 + windowLevel 透传）、`src/styles.css`（contain-fit 画布 + 测量覆盖层/工具行 + .wl-panel）；测试：`decodePixel.test.ts`（扩展）、`windowLevel.test.ts`、`measure.test.ts`、`WindowLevelPanel.test.tsx`（新增）、`DicomViewer.test.tsx`（扩展）、`App.workbench.test.tsx`（扩展）。
- **验证结果**：`scripts\verify.ps1` 全绿——272 tests（28 文件；含新增/扩展：wc/ww 映射含 ww=1 边界与非法回退 7 例、预设值与范围 3 例、测量距离 mm/mock/格式/坐标映射 8 例、W/L 面板 5 例、查看器 W/L+测量 7 例、App 右栏 W/L 1 例）+ `tsc -b && vite build` 通过。
- **commit**：见分支 `feature/CR-003-T-003-dicom-enhance`（feat + docs 两个 commit），PR 链接见 Builder 最终报告。
- **已知限制**：
  - auto 态下滑杆展示候选值（40/400，非帧实际 min/max 派生值），以“自动（min-max）”提示消歧；如需滑杆回显实际窗值需把帧 min/max 从解码层上报，未纳入本卡范围。
  - Mock 口径取图像像素距离（与画布/图像比例相关并随窗口缩放稳定），非真实毫米；已在标注与提示中双明示。
  - 测量覆盖层端点半径/字号按图像分辨率自适应（viewBox 坐标系），极小合成图上视觉比例偏大，仅影响测试 fixture 观感。
  - 测量线坐标基于拖拽时刻的画布布局（contain-fit），窗口 resize 后已有标注与图像仍按同一 viewBox 缩放对齐，无重算需求。
- **需 Reviewer 关注**：`.dicom-viewer__canvas` 由 max-width/max-height 改为 `width/height:100% + object-fit: contain`（覆盖层对齐的前提，画布盒占满预览区、像素等比居中，请手测真实 DICOM 缩放显示）；`decodeDicomFrame` 第三参数为可选对象（与卡片写法 `opts?: {wc?, ww?}` 一致）；“清空测量”按钮为卡片外最小补充（清空语义的手动入口，供验收）。