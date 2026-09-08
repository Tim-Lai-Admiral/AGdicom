# Task T-003: DICOM 双系列比较

## Metadata

```yaml
id: T-003
cr: CR-012
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 30
depends_on: [T-002]
branch: feature/CR-012-T-003-dicom-compare
```

## Context pack

- Requirement: R-029；关键文件：`src/App.tsx`（compareMode/selectedIds：现仅 image——扩展 dicom；gridAssets 过滤；handleToggleSelect 的 kind 限制）、`src/features/library/CompareView.tsx`（现 image pane 用 imageViewport——改为按 kind 渲染：dicom 复用 DicomViewer 视口能力、model 复用 Model3DViewer）、`src/features/viewer/dicom/DicomViewer.tsx`（视口/工具/滑动条——比较模式复用其视口部分，可能需要抽共享视口组件或双实例）
- 设计要点：
  - 比较模式筛选扩展：image+dicom+model（gridAssets 与提示条文案）；选择两个同 kind 素材进入对应比较视图（image→现视图；dicom→本任务；model→T-004）
  - DICOM 双窗：每窗渲染所属系列切片（复用 DicomViewer 视口：四角/工具/W-L）；同步：切片索引（InstanceNumber 对齐）双向（滚轮/滑条任一侧驱动两侧）；pan/zoom/rotate 同步；W/L 独立（默认）
  - 建议抽 `DicomViewport`（视口+工具+滑动条，无右栏/元数据依赖）供单窗与比较窗复用；若有重构风险，双实例复用现有组件亦可（说明取舍）
- 禁止：改右栏元数据/评审；改测量口径；改图片比较

## Objective

比较模式支持 DICOM：选择两个 dicom 素材（两系列）双窗口并行显示，切片切换与视口变换同步。

## Scope

- CompareView 扩展：kind=dicom 渲染双 DicomViewport
- 同步逻辑：共享 sliceIndex（各系列 InstanceNumber 对齐：若两系列切片数不同，以 index 对齐并钳制）；共享 pan/zoom/rotate 状态；W/L 独立
- App：compareMode 支持 dicom（kind 校验、筛选、提示条文案"选择两个同类型素材"）
- 测试：双窗渲染、切片同步（滚轮/滑条双向）、变换同步、W/L 独立、降级不崩溃、退出清理
- `scripts\verify.ps1` 全绿

## Out of scope

- STL 比较（T-004）；图片比较改造

## Acceptance criteria

- [ ] 选择两个 dicom 素材进入双窗比较（合成样本两系列）
- [ ] 切片任一侧滚动/滑动 → 两侧同步（InstanceNumber 对齐）
- [ ] pan/zoom/rotate 同步；W/L 独立
- [ ] 降级/退出清理正确；存量全绿

## Test requirements

- [ ] Unit: 双窗同步/对齐/降级
- [ ] Manual: 合成样本双系列目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **实现摘要**：比较模式扩展 DICOM 双系列比较（R-029）。采用**抽组件方案**（非双实例）：
  自 DicomViewer 抽出 `DicomViewport`（视口+工具+滑条+四角+解析/预览/降级链路），单窗
  DicomViewer 精简为弹层壳后复用之，比较双窗各挂一个实例；同步契约经受控 props 实现——
  共享 `sliceIndex`（各系列按 InstanceNumber 排序后按 index 对齐，切片数不同按本系列长度
  钳制显示；滚轮/滑条任一侧变更上报共享索引驱动两窗）、共享 `viewportTransform`
  （pan/zoom/rotate 拖拽与 Ctrl+滚轮）、W/L 每窗独立状态（CompareView 持有 leftWl/rightWl，
  进入比较复位 auto；window 工具拖拽仅影响所在窗）。App 侧：比较可选类型扩展 image+dicom
  （gridAssets 过滤、先选 kind 锁定配对拒绝混选、提示条「选择两个同类型素材进行比较（已选
  n/2）」并在已选 1 时明示配对类型）；dicom 比较时顶栏工具组显示（R-029「工具沿用现有查看器」；
  图片比较维持 R-024 隐藏工具组契约不变）；AssetGrid 比较模式下 dicom 行呈「加入比较」语义。
- **文件清单**：新增 `src/features/viewer/dicom/DicomViewport.tsx`；修改
  `src/features/viewer/dicom/DicomViewer.tsx`（精简为弹层壳）、
  `src/features/library/CompareView.tsx`（kind 分派 + DicomComparePanes）、`src/App.tsx`、
  `src/features/library/AssetGrid.tsx`、`src/features/workbench/TopToolbar.tsx`（比较按钮
  title 文案）、`src/styles.css`（少量双窗样式）及测试 `CompareView.test.tsx`（+7 用例）、
  `App.test.tsx`（+混选拒绝用例、文案断言更新）、`App.scenarioMatrix.test.tsx`（+双系列
  集成用例、筛选期望更新）。
- **验证结果**：`scripts/verify.ps1` 全绿（41 文件 425 测试通过；`tsc -b && vite build`
  成功）。覆盖：双窗渲染/退出、切片滚轮↔滑条双向同步、InstanceNumber 对齐与钳制（3+2
  系列越界钳制、末片再滚不越界）、pan/Ctrl+滚轮变换双窗同步、W/L 独立（左拖右不变）、
  压缩降级（仅元数据）单窗不影响另一窗、损坏文件不崩溃、退出恢复列表与普通模式语义；
  DicomViewer 存量 42 用例全绿（抽取无回归）。Manual（合成样本双系列目检）留待 Reviewer
  按任务卡执行。
- **commit**：`bf99882`（分支 `feature/CR-012-T-003-dicom-compare`，基于 T-002 分支，
  含 T-001/T-002 提交链）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/54
  （body 注明按序合并 #52 → #53 → 本 PR）。
- **已知限制/技术债**：① 全量并行跑测时 `remoteProvider`/`AiPanel` 测试文件存在偶发
  unhandled rejection（ENOTFOUND api.example.com，真实网络请求逃离 stub 窗口），vitest
  提示可能造成其他文件用例误报失败——本次全量验证曾出现一次（复跑即绿），已登记
  TODO TD-009（属 T-002 范围，本任务不修）；② 比较双窗各自解析所属 series， fresh 导入
  尚无元数据时两窗解析范围会短暂重叠（既有「打开即解析」行为的一致延伸，解析完成后
  收敛、元数据回写幂等）；③ 混合类型选择被静默拒绝（与既有「选满忽略」一致），提示条
  已明示所需类型。
- **需 Reviewer 关注**：① 抽组件取舍：DicomViewport 为 DicomViewer 视口逻辑的整体搬移
  （含 wheel/pointer/解析 effect），单窗行为经存量测试证明不变；② dicom 比较显示顶栏
  工具组为 R-029「四角/工具/W-L 沿用现有查看器」的实现口径（图片比较工具组仍隐藏）；
  ③ 切片钳制语义：共享索引超过短系列长度时短窗钳制末片，在短窗继续滚动不驱动长窗
  （可预测性优先）；④ `onMetasParsed` 在比较模式照常回写 App 持久化（与单窗一致）。