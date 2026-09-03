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

## Reviewer result

> Reviewer fills this using the Review template.