# Task T-003: 图片查看器工具 + 左右抽屉动画

## Metadata

```yaml
id: T-003
cr: CR-009
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 15
depends_on: [T-002]
branch: feature/CR-009-T-003-image-drawers
```

## Context pack

- Requirement: R-024（图片子集）/ R-026；参考 rec TopToolbar 面板开关（Menu 图标 → 左栏拖动；Panel 图标 → 右栏）
- 关键文件：`src/features/workbench/ImageStage.tsx`（图片查看器：加 pan/zoom/rotate）、`src/App.tsx`（leftOpen/rightOpen 状态存在）、`src/features/workbench/TopToolbar.tsx`（开关按钮已存在）、`src/styles.css`（左侧栏/右栏 width transition）
- 禁止：改 DICOM 工具（T-002）；测量（图片无）；3D

## Objective

图片查看器支持平移/缩放/旋转（拖拽/滚轮/按钮）；左右侧栏抽屉滑动动画。

## Scope

- ImageStage：transform 状态（offset/scale/rotate）；拖拽平移、滚轮缩放（或按钮 +/-）、旋转按钮；Esc/重置；双图比较各 pane 独立
- 左/右栏容器：width 过渡（0.2s ease）+ min-width/overflow 处理（rec 样式）；收缩时不溢出
- 测试：图片工具交互、抽屉开合动画类名/aria
- `scripts\verify.ps1` 全绿

## Out of scope

- DICOM 工具；3D；测量

## Acceptance criteria

- [ ] 图片可平移/缩放/旋转（单图与比较视图）
- [ ] 左/右栏切换有滑动动画且不溢出（窄屏 OK）
- [ ] 存量不回归

## Test requirements

- [ ] Unit: ImageStage + 抽屉
- [ ] Manual: 图片工具手测

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查