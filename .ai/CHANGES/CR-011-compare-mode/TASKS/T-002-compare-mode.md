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