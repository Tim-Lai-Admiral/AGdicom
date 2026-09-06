# Task T-001: 移除内置样本导入

## Metadata

```yaml
id: T-001
cr: CR-005
type: feature
status: done
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 12
depends_on: []
branch: feature/CR-005-T-001-remove-samples
```

## Context pack

- Requirement: R-011
- 关键文件：`src/App.tsx`（SAMPLE_STL_NAMES/handleLoadSamples/samplesLoading/samplesError）、`src/features/workbench/TopToolbar.tsx`（Samples 按钮与 props）、`public/samples/stl/`（4 个 STL）、相关测试（App.test "loads built-in STL samples..."、App.workbench 若引用）
- 禁止：改文件导入管线（T-003 契约）；删 public/samples/dicom/

## Objective

移除"加载内置样本"功能与 4 个 STL 样本文件；STL 仅经文件选择导入。

## Scope

- 删除 App 的样本状态/handler 与 TopToolbar 样本按钮及相关 props/图标
- 删除 `public/samples/stl/`（aorta/CB/LA/LVOT）
- 适配测试：移除/改写样本加载用例（改为直接文件导入断言）
- `scripts\verify.ps1` 全绿

## Out of scope

- DICOM 样本（保留）；导入管线逻辑

## Acceptance criteria

- [ ] 顶栏无样本按钮；grep 无 handleLoadSamples/SAMPLE_STL_NAMES 残留
- [ ] public/samples/stl/ 已删除；README 若提及"加载内置样本"需同步（放 T-002/T-003 亦可，本任务优先代码）
- [ ] 246 测试存量适配后全绿（净变化在报告中说明）

## Test requirements

- [ ] Unit: `scripts\verify.ps1`

## Definition of done

- [x] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- 实现摘要：移除 App 内置样本导入（SAMPLE_STL_NAMES/handleLoadSamples/samplesLoading/samplesError）与 TopToolbar 样本按钮/Icon.Samples/importing prop（导入按钮高亮由 importActive 承担，行为不变）；删除 public/samples/stl/ 4 个 STL（git 历史可恢复）；App.test 样本用例改写为"直接文件导入 STL → 打开 3D 查看器"，并断言顶栏无样本按钮；README 三处提及"内置样本/样本按钮"同步移除并注明 CR-005/R-011。
- 文件清单：src/App.tsx、src/features/workbench/TopToolbar.tsx、src/App.test.tsx、README.md、public/samples/stl/（4 文件删除）、本任务卡。
- 验证：verify.ps1 全绿 —— test 28 files / 246 passed（测试总数不变，用例内容重构）；build（tsc + vite）通过。
- commit：76955bd；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/23
- 已知限制：src 内仍有个别注释/测试 label 提及"样本"（buildStlFile.ts 注释、Model3DViewer.test 的 asset source: '内置样本' 字符串），不影响功能与验收 grep（handleLoadSamples/SAMPLE_STL_NAMES 无残留）；DICOM 样本按 Out of scope 保留。
- 需 Reviewer 关注：TopToolbar 对外 props 契约变化（移除 importing/samplesLoading/onLoadSamples）为新契约删除，符合 R-011；App.workbench.test 无需修改（未引用样本按钮）。