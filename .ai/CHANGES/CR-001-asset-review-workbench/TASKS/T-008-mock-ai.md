# Task T-008: Mock AI 能力

## Metadata

```yaml
id: T-008
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: medium
depends_on: [T-007]
branch: feature/CR-001-T-008-mock-ai
```

## Objective

实现 Mock AI 建议面板（命名/标签/摘要，确定性规则），采纳/忽略交互，并产出 `AI_USAGE.md`。

## Context and inputs

- Requirement(s): R-006
- Current architecture/design references: CR-001 ARCHITECTURE.md（features/ai，AIProvider 接口）
- Dependency output: T-007 评审面板（标签合并入口）

## Scope

Allowed changes:

- `src/features/ai/types.ts`：`AIProvider` 接口（`suggest(asset): AiSuggestion`）。
- `src/features/ai/mockProvider.ts`：确定性规则实现：
  - 命名建议：DICOM → 序列号+切片数；STL → 规范化文件名；图片 → 类型+序号；
  - 标签建议：按类型/元数据（如 DICOM 去标识化、STL 文件名关键词）规则生成；
  - 摘要：素材关键信息一句话（名称/类型/切片数或面数/状态）。
- `src/features/ai/AiPanel.tsx`：建议展示（明示"Mock 生成"）、采纳（命名填入、标签合并）、忽略。
- `src/features/ai/mockProvider.test.ts`：确定性单测。
- `AI_USAGE.md`：AI 参与环节、Mock 说明、如何验证/修改/拒绝输出、未来接入真实 AI 的接口边界。

## Out of scope

- 真实 AI API 接入。
- 异步流式输出。

## Expected behavior

1. 素材详情打开"AI 建议"面板 → 显示命名/标签/摘要三类建议，标注 Mock。
2. 同素材重复生成结果一致（确定性）。
3. 采纳：命名建议更新名称、标签建议合并入标签；忽略/编辑：无副作用。
4. AI_USAGE.md 与界面均说明 Mock 模式与验证/修改/拒绝方式。

## Acceptance criteria

### Functional

- [ ] 三类建议对 image/dicom/model 各至少一个样例可用。
- [ ] 确定性：同输入两次生成结果相同（单测覆盖）。
- [ ] 采纳/忽略行为正确。

### Error handling and compatibility

- [ ] 建议生成失败（异常输入）时显示空建议而非崩溃。

### UI (if applicable)

- [ ] 面板明示"Mock 生成"，采纳/忽略按钮可用且反馈明确。

## Technical constraints

- 纯规则、无网络调用、无 API Key；必须通过 `AIProvider` 接口实现。

## Implementation notes

- 命名建议落地为"建议"而非自动改名；改名操作明确显示。
- AI_USAGE.md 同时作为题目要求的独立交付文档（R-008）。

## Test requirements

- [ ] Unit: mockProvider 确定性 + 三类素材建议结构完整。
- [ ] Manual/E2E: 面板采纳/忽略链路。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Relevant documentation updated（AI_USAGE.md）。
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

## Reviewer result

> Reviewer fills this using the Review template.