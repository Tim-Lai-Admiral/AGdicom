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

## Builder result

- **实现摘要**：
  - 左栏：AssetGrid 卡片 → rec SeriesSidebar 行风格（38px 方形缩略图复用 `.sidebar-thumb` + 名称行 + 元信息行「类型 · 状态点」mono 字体；选中行 accent 左边框 + 底色）；三类素材行均可点击；DICOM series 展开/切片缩略图保留并同风格
  - 状态：`StatusBadge`（可点击循环徽标）删除 → 新 `StatusDot`（圆点+文字双通道，仅展示，保留 pending/passed/rejected 语义与文案）；状态修改入口唯一化为「选中素材 → 右栏评审面板」，持久化契约不变（App 移除 setAssetStatus 直改路径与 handleSetStatus）
  - 顶栏：rec 视觉语言（44px 面板底、tool-btn 16px 线性图标、垂直分隔线、mono 风格筛选组）；aria-label 保持原可访问名，存量顶栏测试零适配；W/L 预设本就在右栏（preset-btn/range-input 已是 rec 类），未移动
  - 右栏：ReviewPanel/ReviewHistory 徽标换 StatusDot；右栏页签改 preset-btn 风格；section-header/meta-row 已用 rec 类
  - 清理：styles.css 删除 `.asset-card*`（含评审按钮/选中标记/缩略图）、`.status-badge*`（含 workbench 覆盖）、`.workbench__tool*`、`.asset-grid`；新增 `.asset-list/.asset-row*/.status-dot*`；grep 确认无 `.asset-card`/`.status-badge`/行内“评审”按钮残留
  - 附带低风险修复：导出弹层原 `top: calc(100% + 4px)` 无定位祖先时相对视口会跑到屏外，改锚定 `.workbench`（新增 position: relative）顶栏下方 48px
- **文件清单**：`src/App.tsx`、`src/App.test.tsx`、`src/styles.css`、`src/features/library/AssetGrid.tsx`(+test)、`src/features/library/StatusBadge.tsx`(删)+test(删)、`src/features/library/StatusDot.tsx`(新)+test(新)、`src/features/workbench/TopToolbar.tsx`、`src/features/review/ReviewPanel.tsx`(+test)、`src/features/review/ReviewHistory.tsx`
- **验证结果**：`scripts\verify.ps1` 全绿（28 文件 / 270 测试通过 + tsc -b && vite build 通过）。测试数 274 → 270：StatusBadge 6 个按钮循环用例随入口移除，新增 StatusDot 2 个展示用例（净 -4）
- **语义适配的测试（功能不变）**：App.test 状态用例改走「选中→右栏评审」链路并断言行内状态点；`.asset-card__kind` → `.asset-row__kind`；AssetGrid.test 卡片断言 → 行断言（`已选中` 文字标记移除，改断言 `li.asset-row.is-selected` 与 aria-pressed）；ReviewPanel.test `.status-badge` → `.status-dot` 选择器
- **commit**：94dfd37（feat）；本文档：docs commit
- **PR**：https://github.com/Tim-Lai-Admiral/AGdicom/pull/20
- **已知限制 / 需 Reviewer 关注**：
  - 任务卡 Manual 项（浏览器全链路目检，对照 rec/ 截图）无法在 Builder 环境完成，需 Reviewer 在浏览器（`npm run dev`）目检左栏行/顶栏/右栏视觉与全链路功能
  - 「preset chips」落在右栏 W/L 面板与右栏页签（与 rec 相同组件类）；顶栏按任务卡列举的功能清单重排，未添加 W/L 预设 chips（功能位置不变）