# Task T-002: 顶栏汉字按钮 + 比较显式模式

## Metadata

```yaml
id: T-002
cr: CR-011
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 25
depends_on: [T-001]
branch: feature/CR-011-T-002-compare-mode
```

## Context pack

- Requirement: R-002 实现细化；关键文件：`src/App.tsx`（handleToggleSelect 现状：点击图片行=selectAsset+toggle 选中+满2自动比较；selectedIds/compareOpen/compareAssets；toolGroupKind）、`src/features/workbench/TopToolbar.tsx`（Icon 图标按钮：导入/比较 → 汉字按钮）、`src/features/library/AssetGrid.tsx`（行点击语义依赖 onToggleSelect/onOpenDicom/onOpenModel props）、`src/features/library/CompareView.tsx`（不变）
- 目标交互：
  - 普通模式：图片行点击 = 中央查看该图片（selectAsset），不进入比较选择
  - 顶栏「比较」汉字按钮 → 进入比较模式：素材库筛选出可比较素材（image；提示条"选择两张图片进行比较"，非 image 隐藏或禁用）+ 清空/保留选择语义由设计定
  - 比较模式：image 行点击 = 加入比较选择（可取消）；选满两张自动进入比较视图；「比较」按钮在比较模式可显示"完成"态或提供退出
  - 退出比较模式：退出比较视图/再次点击 → 清空 selectedIds 恢复普通模式
- 禁止：改 CompareView；改 domain/store；改测量/评审

## Objective

比较功能重构为显式模式：顶栏「导入/比较」汉字按钮；比较模式先筛选可比较素材再显式选择；普通模式图片行点击恢复"中央查看"。

## Scope

- TopToolbar：导入/比较 图标 → 汉字按钮（比较在非 image 素材存在时可用；进入比较模式后按钮态切换）
- App：新增 `compareMode` 状态；普通模式图片行 onToggleSelect → 中央查看（onOpenImage）；比较模式列表过滤（kind=image）+ 提示条 + 行点击 toggle 选中（满 2 自动进比较）；退出清空选择
- AssetGrid：props 语义保持（onToggleSelect 由 App 在两种模式传不同 handler；行 aria-label 按模式：普通"查看图片 X"/比较"选择 X 加入比较"）
- 样式：比较模式提示条；按钮文字样式
- 测试：模式切换、筛选、显式选择、普通模式查看、退出清理（新增 + 适配存量比较用例语义）
- `scripts\verify.ps1` 全绿

## Out of scope

- CompareView 样式/功能；DICOM/3D 比较；导入按钮功能（仅文字化）

## Acceptance criteria

- [ ] 顶栏「导入」「比较」汉字按钮（grep 无旧图标按钮残留）
- [ ] 比较模式：仅显示 image 素材 + 提示条；行点击显式选择，满 2 自动比较
- [ ] 普通模式：图片行点击=中央查看（不再自动选中）；无残留"选择加入比较"困惑
- [ ] 退出比较模式清空选择并恢复列表
- [ ] 存量全绿（比较语义测试适配说明）

## Test requirements

- [ ] Unit: 模式状态机 + 交互
- [ ] Manual: 两种模式手测

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- 实现摘要：
  - TopToolbar：「导入」「比较」由图标按钮改为汉字文本按钮（`tool-btn--text`）；比较按钮在库中存在 image 素材时可用，进入比较模式后呈「完成」态（aria-pressed），再次点击退出；删除 Icon.Upload/Icon.Compare（grep 无旧图标按钮残留）。
  - App：新增 `compareMode` 状态。进入比较模式 = 清空 selectedIds + 列表过滤 kind=image（非 image 行与 DICOM 患者分组面板隐藏）+ 提示条「选择两张图片进行比较（已选 X/2）」；比较模式 image 行点击 = 显式 toggle 选中（仅 image、上限 2、满 2 自动进入比较视图、可取消）；普通模式 image 行点击 = selectAsset 中央查看（不再选中/不再联动比较）；退出比较模式（比较视图「退出比较」按钮/Esc 或顶栏「完成」）= 清空选择 + 关闭比较视图 + 恢复完整列表。CompareView/domain/store 未改。
  - AssetGrid：props 语义保持（onToggleSelect 由 App 按模式传 selectAsset 或 handleToggleCompareSelect）；新增 `compareMode?: boolean` prop，image 行 aria-label 按模式切换（普通「查看图片“X”」无按压态 / 比较「选择“X”加入比较」/「取消选择“X”」）。
  - 样式：`.workbench__toolbar .tool-btn--text` 文本按钮；提示条复用 `.library__select-hint`。
- 文件清单：`src/App.tsx`、`src/features/workbench/TopToolbar.tsx`、`src/features/library/AssetGrid.tsx`、`src/styles.css`；测试：`src/App.test.tsx`、`src/App.workbench.test.tsx`、`src/App.blobRestore.test.tsx`、`src/features/library/AssetGrid.test.tsx`、`src/features/workbench/TopToolbar.test.tsx`。
- 语义适配说明（P-005）与删除/改写的旧用例：
  - 改写（替换为新模式化用例，非简单删除）：App.test「compares two selected images side by side and exits via button and Esc」→ 拆为 3 个模式化用例（普通模式查看、比较模式端到端含 Esc/退出清理、比较模式内取消 +「完成」退出），并新增「无 image 素材时比较入口禁用」用例；删除的旧断言语义：未选满两张前比较按钮禁用（改为有 image 即可进入模式）、退出比较视图保留选中（改为退出即清空并退出模式）、已选满两张点第三张被忽略（行为保留在 handleToggleCompareSelect，用例随模式重写覆盖取消/重选路径）。
  - 存量 locator 适配（行为不变，仅行可访问名随模式变化）：App.test L123、App.workbench L103/355/493/544/551、App.blobRestore L82/102 由「选择“X”加入比较」→「查看图片“X”」；AssetGrid.test 比较选择用例改为传 compareMode，并新增普通模式「查看图片 X」语义用例。
- 验证结果：`scripts\verify.ps1` 全绿（38 个测试文件 / 385 用例通过 + tsc -b + vite build OK）。
- commit：fb4eaab（分支 feature/CR-011-T-002-compare-mode，含 T-001 提交 c8a7685，按序合并 #48 → 本 PR）。
- 已知限制：比较模式下中央若仍停留此前打开的素材查看器（activeAsset 不清理），选满两张后被比较视图覆盖，属可接受交互；比较模式下左栏「素材库（N）」计数仍为全部素材数；筛选条件（类型/标签/搜索）与 kind=image 叠加生效（AND），比较模式下若类型筛选非 image 会出现空列表提示。
- 需 Reviewer 关注点：① 退出比较视图（按钮/Esc）即退出整个比较模式并清空选择（与旧“保留选中便于再次进入”语义不同，为卡片要求的显式模式语义）；② AssetGrid onToggleSelect prop 名保持、App 按模式传不同 handler 的契约；③ 比较按钮可用性 = 存在 image 素材（hasImages），不再依赖已选满两张。