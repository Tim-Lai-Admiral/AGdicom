# Task T-002: 同质化测试裁剪（P-005 落地）

## Metadata

```yaml
id: T-002
cr: CR-004
type: refactor
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 12
depends_on: [T-001]
branch: feature/CR-004-T-002-test-trim
```

## Context pack

- Requirement: P-005（CR-004 REQUIREMENTS.md）
- 关键文件：下述各 *.test.tsx（裁剪对象）；`scripts/verify.ps1`（验证）
- 裁剪原则：仅删"文本存在性 / 跨层重复 / 实现细节"断言；核心层（domain/store/parse/decode/mock/measure/windowLevel）测试**一律不动**；每组件保留 ≥3 个关键交互测试

## Objective

按 P-005 裁剪同质化 UI 测试断言（270 → ~246），并记录裁剪理由。

## Scope

按"文件 → 删除的测试标题"执行（标题为 `it('...')` 文案）：

1. `ImportZone.test.tsx`（删 3）：`ignores drops while an import is in progress`；`ignores drops with an empty file list`；`does nothing when the picker change carries no files`
2. `AssetGrid.test.tsx`（删 3）：`shows a placeholder with hint when the image has no objectUrl (post-refresh)`；`shows the type glyph placeholder for dicom and model rows`；`keeps dicom rows non-interactive when no onOpenDicom handler is provided`
3. `DicomViewer.test.tsx`（删 2）：`supports stepping through slices with prev/next buttons`；`shows an explicit unavailable state when neither bytes nor metadata exist`
4. `useImport.test.tsx`（删 3）：`is a no-op for an empty file list`；`imports a >=10MB file asynchronously and completes`；`clears feedback on demand`
5. `ExportImport.test.tsx`（删 2）：`rejects structurally invalid state with a validation summary`；`does nothing when the file picker change carries no file`
6. `AiPanel.test.tsx`（删 2）：`regenerating after ignoring shows the same deterministic suggestion`；`disables name acceptance when the suggestion equals the current name`
7. `Filters.test.tsx`（删 2）：`renders the four parallel controls with the tag list and a disabled clear button by default`；`preserves the other conditions when a single control changes (AND)`
8. `CompareView.test.tsx`（删 2）：`removes the Escape listener on unmount`；`shows placeholders when objectUrl is missing (post-refresh session)`
9. `ReviewPanel.test.tsx`（删 5）：`keeps the comment empty when submitting without typing one`；`closes via the close button and Esc`；`collapses to the header and expands again`；`renders every status option once for selection`；`renders the embedded AI suggestion section with the Mock notice (T-008)`

保留全部：核心层测试、App.test、App.workbench、StatusDot、WindowLevelPanel、ReviewHistory、Model3DViewer。

## Out of scope

- 核心层任何测试改动；被测代码行为改动；P-005 其他条目

## Acceptance criteria

- [ ] 上述 24 个测试标题删除，其余全部保留
- [ ] `scripts\verify.ps1` 全绿（预期 246 测试）
- [ ] 无 unused import 残留（tsc 通过即验证）
- [ ] 裁剪理由记录于 Builder result

## Test requirements

- [ ] Unit: `scripts\verify.ps1`
- [ ] 无新增测试（本任务为裁剪）

## Definition of done

- [ ] 验收通过；PR（body 写概要，列出裁剪统计）；Reviewer 审查

## Builder result

- 实现摘要：按卡内清单逐条精确删除 9 个 UI 组件测试文件中的 24 个 `it()` 块；核心层测试、App.test、App.workbench、StatusBadge（卡中写作 StatusDot）、WindowLevelPanel、ReviewHistory、Model3DViewer 均未触碰。同步清理 2 处仅被删用例引用的 import（`useImport.test.tsx` 的 `LARGE_FILE_THRESHOLD`、`ReviewPanel.test.tsx` 的 `AssetStatus` 类型）。
- 文件清单（9）：`ImportZone.test.tsx`（-3）、`AssetGrid.test.tsx`（-3）、`DicomViewer.test.tsx`（-2）、`useImport.test.tsx`（-3）、`ExportImport.test.tsx`（-2）、`AiPanel.test.tsx`（-2）、`Filters.test.tsx`（-2）、`CompareView.test.tsx`（-2）、`ReviewPanel.test.tsx`（-5）
- 裁剪理由（对应 P-005 三类同质化断言）：① 文本存在性断言——ImportZone 空列表/无文件 no-op、AssetGrid 无 objectUrl 占位与 glyph 占位、CompareView 刷新后占位、DicomViewer 双缺降级文案、Filters 默认控件渲染、ReviewPanel 状态选项渲染与 AI 区 Mock 标注；② 跨层重复——useImport 空列表/大文件异步/清除反馈、ExportImport 空文件/结构校验摘要（io/repository 层已覆盖）、AiPanel 确定性重建与同名禁用（mockProvider 层已覆盖）、DicomViewer prev/next 步进（select 切换用例已覆盖同路径）、ReviewPanel 关闭/Esc、收起/展开（DicomViewer/CompareView 弹层交互用例同构）；③ 实现细节——CompareView unmount 移除监听、AssetGrid 无 handler 时 dicom 卡不可交互、ReviewPanel 无意见提交默认空评论。每组件均保留 ≥3 个关键交互测试。
- 验证结果：`scripts\verify.ps1` 全绿（28 个测试文件，250 测试通过；tsc -b + vite build 通过，无 unused import 残留）。
- 与预期偏差：verify 实际 250 测试，非卡上预期 246。经 `git grep` 核实裁剪前基线为 274（CR 估算 270 偏差 -4），本次净删除恰为 24，删除清单 100% 落实、其余全部保留。属 CR 文档基线估算误差，不影响验收意图。
- 已知限制：无。任务卡 Metadata.branch 上提交，未触碰其他区域。
- 需 Reviewer 关注点：① 确认 250 vs 246 的偏差处理方式（是否需 REVISION 更正 P-005 目标数字）；② 抽查删除边界（如 DicomViewer `切片切换与预览` describe 删后仍保留 select 切换路径用例）。