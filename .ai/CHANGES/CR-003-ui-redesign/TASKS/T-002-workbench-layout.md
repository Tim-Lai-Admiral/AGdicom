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