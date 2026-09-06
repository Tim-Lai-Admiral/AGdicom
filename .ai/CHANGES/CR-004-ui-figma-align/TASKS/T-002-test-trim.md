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