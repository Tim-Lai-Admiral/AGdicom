# Task T-002: 工作台布局重构

## Metadata

```yaml
id: T-002
cr: CR-003
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 30
depends_on: [T-001]
branch: feature/CR-003-T-002-workbench-layout
```

## Context pack

- Requirement: UI-001；参考素材 `rec/src/App.tsx`（TopToolbar/SeriesSidebar/Viewport/MetadataPanel 结构，只读参考）
- 关键文件：`src/App.tsx`（布局壳）、`src/features/library/*`（AssetGrid/Filters/ImportZone/CompareView）、`src/features/review/ReviewPanel`、`src/features/viewer/*`
- 禁止：改 domain/store 契约；改 DICOM 解码与 3D 核心（T-003/T-004 范围外）

## Objective

重构为全屏工作台：顶栏（筛选/搜索/导入/加载样本/导出/面板开关）+ 左栏素材列表（DICOM 展开 series+切片缩略图）+ 中央统一查看区 + 右栏（元数据/评审）。

## Scope

- 布局壳与路由式视图切换（无路由库，状态切换）
- 顶栏 TopToolbar：类型筛选（含状态并入）、搜索、导入按钮、加载样本、导出、面板开关（左/右栏折叠）
- 左栏：素材列表卡片（image/model 缩略图、状态徽标）；DICOM 展开 series（按 SeriesInstanceUID）+ 切片缩略图（ThumbSVG 风格，点击切换）
- 中央：统一查看区容器，承载图片预览/比较、DICOM 预览、3D 查看器（保留各查看器行为与降级路径）
- 右栏：DICOM 素材显示元数据分组面板（折叠），其余素材显示评审面板（状态/标签/备注/历史/AI 保留）
- 现有功能入口全部可访问；回归现有测试并新增布局测试

## Out of scope

- W/L 滑杆真实调节与测量（T-003）；评审/AI/导出组件内部逻辑（T-004 迁移）；3D/DICOM 查看器内核

## Acceptance criteria

- [ ] 新布局四区齐全；现有功能（导入/筛选/状态/比较/评审/AI/导出）全部可访问
- [ ] DICOM 素材左栏可展开 series/切片并切换（复用 seriesUtils 数据）
- [ ] 窄屏侧栏折叠不溢出；Esc 行为保留
- [ ] `scripts\verify.ps1` 全绿（238 + 新增）

## Test requirements

- [ ] Unit: 布局切换、左栏 DICOM 展开、折叠交互
- [ ] Manual: 三类素材各走一遍查看链路

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **实现摘要**：
  - 全屏工作台布局壳：`App.tsx` 重构为 `TopToolbar`（顶栏）+ 左栏素材列表 + 中央统一查看区 + 右栏信息面板；状态切换（无路由库）——中央按“比较 > DICOM/3D 查看器 > 图片预览 > 导入视图”切换，右栏 DICOM 显示元数据分组（可切评审页签），其余素材显示评审面板。
  - 顶栏：类型/状态/标签筛选与搜索（复用 Filters，状态并入同一筛选组）、导入、加载样本、比较、导出（弹出面板承载 ExportImport）、左/右栏面板开关（折叠即卸载，不溢出）。
  - 左栏：AssetGrid 单列卡片（缩略图/状态徽标/评审入口不变）；新增 `DicomSeriesExpansion`——DICOM 卡片可展开 series（复用 seriesUtils `groupDicomBySeries`/`findDicomSeriesGroup`）+ ThumbSVG 风格切片缩略图，点击切片在中央打开该切片查看器并高亮。
  - 右栏：新增 `MetadataPanel`（患者/序列/图像/去标识化分组折叠，可读标签与查看器共用新抽出的 `metaLabels.ts`）；ReviewPanel 由固定抽屉改为嵌入右栏（组件 API 未变）。
  - 中央查看器保留原组件与全部降级路径：CompareView/DicomViewer/Model3DViewer 的 overlay 由 `position: fixed` 改为 `absolute` 嵌入查看区容器（role=dialog、Esc、焦点圈定行为不变）。
  - 启用 Tailwind preflight（index.css）；styles.css 新增 `.workbench` 作用域令牌映射（旧浅色令牌 → 深色令牌）与对比度修正，处理视觉回归。
  - 图片卡片点击在“比较选中”之外同时作为中央查看选择（工作台布局下的查看入口）。
- **文件清单**：`src/App.tsx`、`src/App.workbench.test.tsx`（新增）、`src/features/workbench/{TopToolbar,MetadataPanel,DicomSeriesExpansion,ImageStage}.tsx`（新增）、`src/features/viewer/dicom/metaLabels.ts`（新增，自 DicomViewer 抽出）、`src/features/library/AssetGrid.tsx`（新增可选 `renderExtras` 插槽）、`src/features/viewer/dicom/DicomViewer.tsx`（标签映射外移，行为不变）、`src/index.css`（preflight）、`src/styles.css`（工作台布局 + 令牌映射）。
- **验证结果**：`scripts\verify.ps1` 全绿——241 tests（238 存量 + 3 新增布局测试：四区与面板开关、图片预览+右栏评审+返回导入、DICOM 查看器+右栏分组折叠+页签+左栏切片展开切换）+ `tsc -b && vite build` 通过。
- **commit**：见分支 `feature/CR-003-T-002-workbench-layout`（feat + docs 两个 commit），PR 链接见 Builder 最终报告。
- **已知限制 / 技术债**：
  - 中央查看器（CompareView/DicomViewer/Model3DViewer）保留 `role="dialog" aria-modal="true"` 以维持 T-005/T-006 测试语义与焦点行为；嵌入布局下 `aria-modal` 语义不精确，待 T-004 组件替换时统一修正。
  - 选中图片会同时进入比较选择集合（现有交互契约），查看与比较选中暂未分离。
  - Esc 在多层级（比较 + 评审面板）同时监听时会一并关闭，与重构前多层弹层行为一致。
  - styles.css 中 `.library__compare`、`.library__samples`、`.app__title` 等旧类已无引用，随 T-004 组件替换清理。
- **需 Reviewer 关注**：`.workbench` 作用域令牌映射是 T-004 前的过渡方案（深色对比度修正散落在 styles.css 末段）；AssetGrid 的 `renderExtras` 为唯一契约改动（可选参数，默认不渲染）。