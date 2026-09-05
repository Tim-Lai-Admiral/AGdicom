# Task T-008: Mock AI 能力

## Metadata

```yaml
id: T-008
cr: CR-002
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 20
depends_on: [T-007]
branch: feature/CR-002-T-008-mock-ai
```

## Context pack

- Requirement: R-006（CR-001 REQUIREMENTS.md）；流程 P-001~P-003（CR-002）
- 关键文件：`src/domain/types.ts`（Tag/Asset/AppState）、`src/features/review/ReviewPanel.tsx`（标签合并与采纳/忽略交互参考）、`src/features/ai/`（新建：types.ts / mockProvider.ts / AiPanel.tsx）
- 参考模式：ReviewPanel 的按钮交互与 role 语义
- 禁止：不接真实 AI API；不改 domain 契约；不改 `.opencode/`、`ENVIRONMENT.md`

## Objective

实现 Mock AI 建议面板（命名/标签/摘要，确定性规则）与采纳/忽略交互，产出 `AI_USAGE.md`（仓库根）。

## Scope

- `src/features/ai/types.ts`：AIProvider 接口（suggest(asset) → AiSuggestion）
- `src/features/ai/mockProvider.ts`：确定性规则（DICOM→序列+切片数命名；STL→文件名规范化；图片→类型+序号；标签按类型/元数据；摘要一句话）
- `src/features/ai/AiPanel.tsx`：建议展示（明示"Mock 生成"）、采纳（命名填入、标签合并）、忽略
- `AI_USAGE.md`：AI 参与环节、Mock 说明、验证/修改/拒绝方式、未来接真实 AI 的接口边界
- 单测：mockProvider 确定性 + 三类素材建议结构 + 面板交互

## Out of scope

- 真实 AI API、流式输出、自动改名（仅建议）。

## Acceptance criteria

- [ ] 三类建议对 image/dicom/model 各至少一个样例可用；同输入两次结果一致
- [ ] 采纳/忽略行为正确（命名填入、标签合并、忽略无副作用）
- [ ] 建议生成异常时显示空建议不崩溃
- [ ] AI_USAGE.md 与界面均明示 Mock 模式及验证/修改/拒绝方式
- [ ] `scripts\verify.ps1` 全绿（现有 213 测试不回归）

## Test requirements

- [ ] Unit: mockProvider 确定性、建议结构、面板交互
- [ ] Manual: 面板采纳/忽略链路

## Definition of done

- [ ] 验收通过；测试全绿；填 Builder result；Reviewer 审查