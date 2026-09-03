# Task T-004: 图片浏览、筛选与比较

## Metadata

```yaml
id: T-004
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-003]
branch: feature/CR-001-T-004-image-library
```

## Objective

实现素材库网格视图：类型/状态/标签筛选、名称搜索、状态徽标与状态标记、双图并排比较。

## Context and inputs

- Requirement(s): R-002
- Current architecture/design references: CR-001 DESIGN.md（素材库/比较视图）
- Dependency output: T-003 导入与分类

## Scope

Allowed changes:

- `src/features/library/AssetGrid.tsx`：网格卡片（缩略图、名称、类型、状态徽标）。
- `src/features/library/Filters.tsx`：类型/状态/标签筛选 + 搜索框（组合生效、即时更新）。
- `src/domain/filter.ts`（纯函数）：筛选逻辑 + 单测。
- `src/features/library/StatusBadge.tsx`：状态展示与设置（待评审/通过/驳回，颜色+文字）。
- `src/features/library/CompareView.tsx`：选中两张图片并排比较（等尺寸、可退出、Esc 关闭）。
- `src/App.tsx`：布局接线。

## Out of scope

- DICOM/3D 查看器（T-005/T-006）。
- 评审面板（标签/备注/AI，T-007/T-008）。

## Expected behavior

1. 网格展示全部素材；筛选条件组合生效并即时更新。
2. 状态徽标随设置立即更新并持久化（T-002 仓储）。
3. 选中两张图片进入比较视图；可退出；Esc 关闭。
4. 空筛选结果显示空态提示。

## Acceptance criteria

### Functional

- [ ] 类型/状态/标签/搜索各自生效且可组合。
- [ ] 状态设置刷新后保留。
- [ ] 比较视图：双图并排可见、可退出、Esc 关闭。

### Error handling and compatibility

- [ ] 图片加载失败显示占位与提示，不破坏网格。

### UI (if applicable)

- [ ] 状态徽标颜色+文字双通道（非仅颜色）。
- [ ] 窄屏下筛选区可滚动不溢出。

## Technical constraints

- 筛选为纯函数，便于单测；不引入路由库。

## Implementation notes

- 比较视图为应用内视图状态（非路由）。

## Test requirements

- [ ] Unit: filter 纯函数（单条件/组合/空结果）。
- [ ] Manual/E2E: 导入多张图验证筛选、状态、比较全流程。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

- **任务ID**: T-004（图片浏览、筛选与比较）
- **分支**: `feature/CR-001-T-004-image-library`
- **Commit**: `917ee11` `feat: asset grid with filters and image compare`（基于 T-003 合并后的分支基线，单 commit，13 个文件，+1653/-45）

### 实现摘要

- `src/domain/filter.ts`（纯函数）：`AssetFilter`（kind/status/tag 为 null 表示"全部"+ search 关键字）、`DEFAULT_ASSET_FILTER`、`isDefaultAssetFilter`、`filterAssets`（各条件 AND 组合、保持原顺序、返回新数组）、`collectTagNames`（标签注册表 ∪ 素材在用标签，码点排序保证跨环境确定性）。
- `src/features/library/Filters.tsx`：类型/状态/标签/搜索四个并列受控控件，任一变更立即回调 `onChange`（即时生效）；"清空筛选"一键恢复默认（默认条件时禁用）；窄屏 `nowrap + overflow-x: auto` 横向滚动不溢出。
- `src/features/library/AssetGrid.tsx`：素材卡片网格（auto-fill 自适应列）。卡片含缩略图、名称、类型中文标签、状态徽标。image 卡片主体为 toggle 按钮（`aria-pressed`，点击切换比较选中），dicom/model 卡片主体暂不可交互（查看器属 T-005/T-006）；选中态有 `is-selected` 高亮 + "已选中"文字标记（非仅颜色）。
- `src/features/library/StatusBadge.tsx`：颜色（待评审=灰 / 通过=绿 / 驳回=红）+ 文字双通道；提供 `onSetStatus` 时为按钮，点击按 待评审→通过→驳回→待评审 循环切换；状态计算（`setAssetStatus`）与持久化（`saveState`）由 App 层完成，组件无业务逻辑。
- `src/features/library/CompareView.tsx`：应用内弹层（`role="dialog"`，非路由）；两窗格 `flex: 1 1 0` 等尺寸并排、`object-fit: contain`；"退出比较"按钮 + Esc 键退出（打开时聚焦退出按钮）；objectUrl 缺失/加载失败显示占位提示，不影响另一侧。
- `src/App.tsx`：接线 Filters + AssetGrid + CompareView（ImportZone 保留）；状态设置 = `setAssetStatus` 纯函数 + `saveState` 持久化（保存失败显示 alert 且内存态保留）；选中规则：仅 image、最多两张（第三张忽略）、选中第二张自动进入比较；"比较"按钮在选中两张时可用（退出后保留选中可再进入）；空库/空筛选结果两种空态文案区分。

### objectUrl 重建策略（请 Reviewer 重点关注）

- T-003 的 `useImport` 在导入时已为 image 素材创建会话级 `objectUrl` 挂在 Asset 上（`attachObjectUrls`），App 内存态整个会话可用；该字段不持久化（`toPersistableState` 剥离）。
- T-003 **未保留原始 File 引用**（仅 fileName/fileSize/fileType 元数据），刷新后无法从 `fileName` 重建 objectUrl。本任务采用任务说明中允许的第一种策略：**接受"刷新后图片预览需重新导入"**——卡片与比较视图在 objectUrl 缺失或 `<img>` 加载失败（onError）时显示类型图标占位 + 中文提示（"预览不可用：刷新后需重新导入该图片" / "图片加载失败"），不破坏网格（满足验收条款）。
- **已知限制（技术债，建议后续任务）**：刷新后重新导入同一文件会被 T-003 去重（duplicates 路径不重新附加 objectUrl），即当前**没有用户路径恢复刷新后的预览**。若需恢复，需要 T-003 的 `useImport` 在重复导入时为已有 image 素材重新附加 objectUrl（属 T-003 契约调整，超出本任务 Scope，未改动）。更彻底的方案是 IndexedDB 存 blob，属新的存储层设计，需 Planner/Human 决策。

### 修改文件清单

新增：`src/domain/filter.ts`、`src/domain/filter.test.ts`、`src/features/library/Filters.tsx`、`Filters.test.tsx`、`AssetGrid.tsx`、`AssetGrid.test.tsx`、`StatusBadge.tsx`、`StatusBadge.test.tsx`、`CompareView.tsx`、`CompareView.test.tsx`；修改：`src/App.tsx`（接线）、`src/App.test.tsx`（新增 3 个集成测试 + 1 处断言适配新 UI）、`src/styles.css`（替换旧 `.asset-list` 简单列表样式为筛选栏/网格/徽标/比较视图样式）。

### 测试与验证

- `npm.cmd test`：**12 个文件 114 个测试全部通过**（含 T-002/T-003 既有 54 个 + 新增 60 个：filter 纯函数 14、StatusBadge 6、Filters 7、CompareView 6、AssetGrid 8、App 集成新增 3）。
- `npm.cmd run build`（tsc -b + vite build）：**无类型错误**，构建成功。
- `npm.cmd run dev`：启动后 `http://localhost:5173/` 返回 **200**。
- 手动 E2E（任务卡要求）未执行自动化，但 App 集成测试覆盖：导入多类型 → 类型/搜索筛选组合 → 空态 → 清空筛选 → 状态点击持久化（localStorage + 评审历史断言）→ 双图选中自动进入比较 → 退出/Esc/再进入 → 第三张忽略 → 取消选择。剩余需人工验证：窄屏滚动观感、真实图片 objectUrl 渲染（jsdom 不加载图片资源）。

### 已知限制与 Reviewer 重点关注项

1. **objectUrl 重建策略**（见上节）——刷新后预览占位、重复导入不恢复预览的债务。
2. 状态徽标采用**单按钮循环切换**（pending→passed→rejected→pending）实现"点击设置状态"；从待评审设为驳回需两次点击。如 Reviewer/Planner 倾向三选一点击区或菜单，UI 层可替换（不影响契约）。
3. 筛选仅作用于素材库网格，比较选中集合不随筛选清除（选中的两张被筛掉后"比较"按钮仍可用，属有意保留）。
4. Filters 的静态 DOM id（`library-filter-*`）假定单实例渲染。
5. 标签筛选用空串 option 值表示"全部标签"，依赖"正常流程不会产生空名标签"的 T-002 约定（addAssetTag 拒绝空白名）。
6. T-003 的 App.test 有一处断言因筛选下拉新增"图片"选项而改为限定 `.asset-card__kind` 选择器（`图片` 文本不再唯一）。

## Reviewer result

> Reviewer fills this using the Review template.