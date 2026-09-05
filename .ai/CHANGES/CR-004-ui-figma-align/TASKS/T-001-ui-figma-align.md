# Task T-001: UI 全面对齐 rec/（Figma）设计

## Metadata

```yaml
id: T-001
cr: CR-004
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 30
depends_on: []
branch: feature/CR-004-T-001-ui-figma-align
```

## Context pack

- Requirement: UI-003；视觉唯一参考源 `rec/src/App.tsx`（TopToolbar/SeriesSidebar/MetadataPanel/Viewport 结构、行内样式与类）与 `rec/src/index.css`（令牌与组件类）——只读，不得复制整文件
- 现有实现（需改造）：`src/App.tsx`、`src/features/workbench/TopToolbar.tsx`、`MetadataPanel.tsx`、`DicomSeriesExpansion.tsx`、`src/features/library/AssetGrid.tsx`（卡片设计在此）、`StatusBadge.tsx`、`src/styles.css`（旧卡片类）
- 功能契约保留：评审在右栏（选中素材后）；状态数据保留；测试语义尽量保持（getByRole/getByText）
- 禁止：改 domain/store；删功能；引入 rec 的 Figma 插件

## Objective

清除旧设计（卡片容器、卡片评审按钮、徽标状态按钮），全部元素按 rec/ 设计语言重做。

## Scope

1. **左栏素材列表**：AssetGrid 卡片 → rec 风格行（同 SeriesSidebar 行：38~44px 方形缩略图 + 名称行 + 元信息行（类型·状态文本或彩色圆点，mono 字体））；选中行 accent 左边框+底色；DICOM series 展开行同风格；无独立卡片容器、无卡片评审按钮
2. **状态表达**：状态徽标按钮 → 紧凑文本/圆点（保留 pending/passed/rejected 语义与文案）；状态修改入口移到右栏评审面板（选中素材后）
3. **顶栏 TopToolbar**：按 rec 视觉语言（44px panel 底、tool-btn 图标按钮、垂直分隔线、preset-btn/preset chips、mono 读数）重排现有功能（菜单/面板开关、导入、加载样本、筛选/搜索、导出）；图标用 rec 的 SVG 风格（16px stroke 线性图标）
4. **右栏与元数据**：section-header/meta-row 统一（沿用现有 workbench 组件，补齐与 rec 不一致处）
5. **清理**：styles.css 旧卡片类删除；无引用死代码清理；确保无 .asset-card/.status-badge 类残留
6. 全量回归：现有功能（导入/筛选/状态经右栏/比较/DICOM W-L/测量/3D/评审/AI/导出）全部可用

## Out of scope

- 功能与契约变更；rec 中未授权的新能力（MPR 等）

## Acceptance criteria

- [ ] 界面无旧卡片容器/卡片评审按钮/徽标按钮（grep .asset-card、评审按钮文案确认移除）
- [ ] 三类素材在左栏以 rec 风格行展示并可选中；DICOM series 展开与切片缩略图保留
- [ ] 顶栏功能完整且视觉为 rec 语言
- [ ] 状态/评审经"选中 → 右栏"完成，数据持久化不变
- [ ] `scripts\verify.ps1` 全绿（274 存量不回归，语义性失败允许小幅适配并说明）

## Test requirements

- [ ] Unit: 存量 + 必要适配
- [ ] Manual: 浏览器全链路目检（对照 rec/ 截图）

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查