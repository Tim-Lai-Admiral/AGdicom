# Task T-002: 顶部工具（含测量迁移 + 平移/旋转/缩放/窗宽窗位）

## Metadata

```yaml
id: T-002
cr: CR-009
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 25
depends_on: [T-001]
branch: feature/CR-009-T-002-tools
```

## Context pack

- Requirement: R-024；参考 rec TopToolbar（工具按钮组 + W/L 预设 reads + tool-btn 类已存在）
- 关键文件：`src/features/workbench/TopToolbar.tsx`（新增工具组；DICOM 激活时显示）、`src/features/viewer/dicom/DicomViewer.tsx`（工具状态接入：pan/zoom/window/rotate/measure 驱动；测量迁移）、`src/index.css`（.tool-btn/Pulse 已有）；测量逻辑（R-010）在 DicomViewer 内
- 契约：App 持 wc/ww（CR-003）；measure 单测在 DicomViewer.test
- 禁止：改测量数值口径（R-010 单测沿用）；改 W/L 面板（右栏保留）；3D

## Objective

工作台顶栏工具化：pan/zoom/window/rotate/measure 图标按钮（DICOM 激活时）；测量迁移至工具；清空测量移动；DICOM 视口支持拖拽平移/旋转/缩放/调窗。

## Scope

- TopToolbar：工具组（图标 16px 线性；aria-label 中文）；DICOM 视口激活时显示（或常显但 disabled 态）；W/L 预设 chips 与 C/W 读数可后续（本任务先工具组+必要预设复用右栏数据源，若冲突注明）
- DicomViewer：视口工具状态（activeTool）；pan（拖拽平移 offset）、zoom（拖拽缩放或滚轮 Ctrl）、rotate（拖拽旋转 angle）、window（拖拽调 wc/ww，上送 App）、measure（拖拽绘制，既有逻辑迁移）；移除查看器内"测量(模拟)/清空测量"按钮（清空进入工具区）
- 图片查看器（ImageStage）子集：pan/zoom/rotate（T-003 若拆分，本任务仅 DICOM）
- 测试：工具切换、各工具行为（平移 offset/旋转角度/缩放比例/调窗值）、测量迁移（既有 R-010 断言保持）、按钮移除无残留（grep）
- `scripts\verify.ps1` 全绿

## Out of scope

- 图片/3D（T-003）；抽屉（T-003）；W/L 面板结构

## Acceptance criteria

- [ ] 工具组存在且行为正确（DICOM 实测：拖拽平移/旋转/缩放/调窗）
- [ ] 测量经工具入口 + 清空可访问；Mock 明示保留
- [ ] 查看器内旧按钮无残留；R-010 单测沿用
- [ ] 存量全绿

## Test requirements

- [ ] Unit: 工具行为 + 迁移
- [ ] Manual: DICOM 拖拽手感

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查