# Task T-001: 移除内置样本导入

## Metadata

```yaml
id: T-001
cr: CR-005
type: feature
status: planned
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

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查