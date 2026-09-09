# Task T-001: 元数据同步 + 左栏箭头/布局

## Metadata

```yaml
id: T-001
cr: CR-013
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 15
depends_on: []
branch: feature/CR-013-T-001-meta-layout
```

## Context pack

- Requirement: R-031/R-032 + R-022 扩展
- 关键文件：`src/App.tsx`（right 栏 MetadataPanel asset 传参——改为当前切片素材 `activeSliceAssetId ? state.assets[activeSliceAssetId] : activeAsset`；左栏 body 顺序：PatientGroupPanel 移到 AssetGrid 之前）、`src/features/workbench/MetadataPanel.tsx`（接收的 asset 随切片更新——展示当前切片 meta，无需改 props 契约）、`src/features/workbench/PatientGroupPanel.tsx`（分组头/系列行 chevron 旋转）、`src/styles.css`
- 注意：评审面板仍绑定 activeAsset（选中素材）——只有 meta 页签跟随切片；activeSliceAssetId 仅在 DICOM 查看时非空（CR-008 已有清理逻辑）
- 禁止：改元数据/评审契约；改比较

## Objective

右栏元数据随切片滑动同步；左栏箭头旋转；左栏先分组后素材库。

## Scope

- App：metaAsset 计算（activeSliceAssetId 优先）；左栏 body 顺序重排（分组面板上、素材库下；空态与无 DICOM 场景正确）
- PatientGroupPanel：分组头与系列行 chevron（SVG，旋转 -90°/0°，0.15s）
- styles.css：箭头类 + 布局顺序类调整
- 测试：右栏元数据随切片更新（滑动条 → meta 面板 InstanceNumber/文件名变化）、左栏 DOM 顺序、箭头旋转类、空库场景
- `scripts\verify.ps1` 全绿

## Out of scope

- 系列级比较（T-002）

## Acceptance criteria

- [ ] 滑动切片 → 右栏元数据同步（实例号等随切片变化）；评审页签仍绑定选中素材
- [ ] 分组头/系列行箭头随展开态旋转（类名/CSS）
- [ ] 左栏分组面板在素材列表上方（测试断言 DOM 顺序）
- [ ] 空库/无 DICOM 不回归；存量全绿

## Test requirements

- [ ] Unit: 同步/顺序/箭头
- [ ] Manual: 目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- 实现摘要：
  - 元数据随切片同步（R-022 扩展）：App 新增 `metaAsset` 派生值——`activeSliceAssetId` 命中的素材优先（DICOM 查看时随查看器滑动条等路径切换同步），无高亮/素材已清理时回退 `activeAsset`；仅右栏 meta 页签消费（`<MetadataPanel asset={metaAsset}>`），评审页签仍绑定 `activeAsset`。`WindowLevelPanel` 不随切片（查看器级状态，契约不变）。
  - 左栏重排（R-032）：`workbench__left-body` 内 `PatientGroupPanel` 移到 `AssetGrid` 之前（先患者分组、后素材库）；header「素材库（N）」计数保留，面板标题自带；比较模式下分组面板照旧隐藏，空库/无 DICOM/筛选空态行为不变。CSS：`.dicom-panel` 分隔线随新位置由 border-top 改 border-bottom，padding 镜像。
  - 折叠箭头（R-031）：`PatientGroupPanel` 新增行内 `Chevron` 组件（aria-hidden chevron SVG）插入分组头/系列行行首；`.dicom-panel__chevron` 收起 `rotate(-90deg)`、`.is-open` 展开 `rotate(0deg)`、`transition: transform 0.15s ease`；aria-expanded 语义保留。
- 文件清单：`src/App.tsx`、`src/features/workbench/PatientGroupPanel.tsx`、`src/styles.css`、`src/App.workbench.test.tsx`（新增 2 用例：meta 同步/评审绑定、DOM 顺序+无 DICOM 隐藏）、`src/features/workbench/PatientGroupPanel.test.tsx`（新增 1 用例：chevron is-open 类 + CSS 源码断言）
- 验证结果：`scripts\verify.ps1` 全绿（全部测试文件 + `tsc -b` + `vite build`）
- Commit：`6d6ab00`（feat，代码 + 本卡）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/57
- 已知限制：右栏 meta/评审页签切换会重挂载 MetadataPanel 并重置其分组折叠态（存量行为，非本任务引入）；`metaAsset` 对指向已删除素材的陈旧 `activeSliceAssetId` 防御性回退 `activeAsset`（删除路径本就有清理）
- 需 Reviewer 关注：左栏 DOM 顺序变更对存量断言无回归（scenarioMatrix「面板不搬家」位置断言重排后仍通过）；`.dicom-panel` border-top→border-bottom 目检观感；chevron 触达面积未扩大（仅行首 10px 图标，点击目标仍为整行按钮）