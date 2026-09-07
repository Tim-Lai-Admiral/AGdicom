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

- [x] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **分支**：`feature/CR-009-T-003-image-drawers`（含 T-001/T-002 提交，PR 按序合并 #41→#42→本 PR）
- **实现摘要**：
  - 图片查看器视口工具（R-024 图片子集）：新增共享模块 `src/features/viewer/imageViewport.tsx`
    （transform 状态 offset/scale/rotate + `useImageViewportTransform` hook + `ImageViewportControls`
    小控件；拖拽手感常量与 DICOM 视口 T-002 同口径）。`ImageStage` 接入 `activeTool`（App 下发
    viewerTool）：pan 拖拽平移 / zoom 竖拖或滚轮缩放 / rotate 横拖旋转（图片无切片，滚轮直接
    缩放）；视口右上按钮通道（放大/缩小/旋转 90°/重置 + mono 缩放读数）；Esc 或“重置”复位；
    切换素材即复位。`CompareView` 每个 pane 独立持有变换（比较视图无顶栏工具组 → 默认拖拽
    平移 + 滚轮缩放 + 各自按钮/重置），两侧互不影响。
  - 左右抽屉（R-026）：`App.tsx` 左/右栏改为常驻挂载（收起不卸载），`is-closed` 类 +
    `aria-hidden` + `inert` 标记收起态；`styles.css` width 0.2s ease 过渡 + 子元素
    `min-width: var(--drawer-width)` 锁定展开宽度（过渡期内容不重排、容器裁剪不溢出）+
    收起态 `overflow: hidden`/边框归零；窄屏经 `--drawer-width` 变量同步收窄；`prefers-reduced-motion`
    关闭动画。TopToolbar 开关（T-002 已有）不改，动画即在此口径下生效。
- **文件清单**：
  - 新增：`src/features/viewer/imageViewport.tsx`、`src/features/workbench/ImageStage.test.tsx`
  - 修改：`src/features/workbench/ImageStage.tsx`、`src/features/library/CompareView.tsx`、
    `src/features/library/CompareView.test.tsx`、`src/App.tsx`、`src/App.workbench.test.tsx`、`src/styles.css`
- **验证结果**：`scripts\verify.ps1` 全绿（38 个测试文件 / 371 用例通过，tsc + vite build 通过）；
  `oxlint` 无新增告警（既有 1 条与本任务无关）。受影响定向测试（ImageStage/CompareView/App.workbench）先行通过。
- **测试**：ImageStage 视口变换 9 例（控件渲染/按钮缩放旋转重置/拖拽 pan、zoom/rotate 工具
  重解释/滚轮缩放/Esc 复位/切素材复位/占位无控件）；CompareView 窗格独立变换 3 例（独立
  控件与读数/拖拽互不影响/各自重置）；App.workbench 抽屉开合断言更新为
  “保留挂载 + is-closed + aria-hidden/inert”（原“从 DOM 移除”断言随 R-026 契约更新）。
- **commit**：`c776705`（feat）/ `6d7669d`（docs）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/43（base master，合并顺序 #41→#42→#43）
- **已知限制 / 需 Reviewer 关注**：
  - 抽屉收起改为“保留挂载”（R-026 动画要求），收起态内容仍在 DOM（aria-hidden + inert +
    overflow hidden 裁剪）；右栏评审表单草稿在收起再展开后保留（行为微变，属预期）。
  - 比较窗格滚轮直接缩放（图片无切片），与 DICOM“滚轮切片”语义不同（R-024 图片子集口径）。
  - Esc 在单图视图语义为“复位视图”（非关闭）；关闭图片查看器仍经顶栏“导入”。
