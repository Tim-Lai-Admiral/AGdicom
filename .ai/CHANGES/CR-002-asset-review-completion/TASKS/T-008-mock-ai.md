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

## Builder result

> Builder fills this before requesting review.

- 分支：`feature/CR-002-T-008-mock-ai`；commit：`140fa9b`（`feat: Mock AI 建议面板（命名/标签/摘要，采纳/忽略）`）+ 卡片填写 commit。
- 实现摘要：
  - `src/features/ai/types.ts`（新建）：`AIProvider` 接口（`id`/`label`/`suggest(asset) → AiSuggestion`）与 `AiSuggestion`（`name: string | null` / `tags: string[]` / `summary: string`）；面板与上层只依赖该抽象，便于未来替换真实 AI。
  - `src/features/ai/mockProvider.ts`（新建）：确定性规则（无网络/无随机/无时间依赖）——DICOM：`Modality-序列{UID 前 8 位}-{切片数}切片`，标签含 Modality/已去标识化/多切片序列；3D 模型：文件名规范化（去扩展名、空白/下划线转连字符、去非法字符，空则回退 `模型-{id 前 8 位}`），标签含扩展名；图片：`图片-{序号}`（优先文件名数字，否则 asset.id 的 FNV-1a 稳定哈希 3 位序号），标签含 MIME 子类型；摘要一句话；元数据缺失逐项降级。
  - `src/features/ai/AiPanel.tsx`（新建）：建议展示区，标题旁常驻"Mock 生成"标注 + 提示文案（Mock、非真实 AI、验证/修改/拒绝方式）；采纳命名（`onAcceptName`，仅用户点击触发，绝不自动改名；名称已符合建议时禁用）、采纳标签（仅合并素材上不存在的标签，复用 `onAddTag` 链路，已存在标注"（已存在）"）、忽略（无任何数据变更，可"重新查看建议"）、重新生成（确定性结果一致）；provider 抛错时降级为"暂无建议"不崩溃；反馈 `role="status"` 3s 自动消失，与 ReviewPanel 交互模式一致。
  - `src/domain/review.ts`：新增 `updateAssetName` 纯函数（重命名 + 刷新 updatedAt，空白/同名/素材不存在为 no-op）。**说明**：任务卡禁止项为"不改 domain 契约"——`domain/types.ts` 契约未动，此处为遵循既有领域模式（App 只经领域纯函数落库）的最小新增，非契约修改，请 Reviewer 关注。
  - `src/features/review/ReviewPanel.tsx`：新增可选 prop `onAcceptAiName` 并在标签区与备注区之间内嵌 `<AiPanel>`（"评审"按钮打开面板即可达 AI 建议；可选 prop 向后兼容，既有调用方不受影响）。
  - `src/App.tsx`：接线 `handleRenameAsset`（`updateAssetName` + `commit` 持久化路径）并传入 `onAcceptAiName`。
  - `src/styles.css`：`ai-panel__*` 样式（复用既有 CSS 变量与 review-panel 按钮/标签样式）。
  - `AI_USAGE.md`（仓库根）：AI 参与环节、Mock 说明（含三类素材规则概要与确定性说明）、验证/修改/拒绝方式、未来接真实 AI 的接口边界（`AIProvider` 注入点与明示来源要求）。
- 文件清单：`AI_USAGE.md`、`src/features/ai/{types.ts, mockProvider.ts, AiPanel.tsx, mockProvider.test.ts, AiPanel.test.tsx}`、`src/domain/{review.ts, review.test.ts}`、`src/features/review/{ReviewPanel.tsx, ReviewPanel.test.tsx}`、`src/App.tsx`、`src/styles.css`。
- 测试：`mockProvider.test.ts`（10：三类素材确定性、image/dicom/model 建议结构与降级）；`AiPanel.test.tsx`（7：Mock 标注与建议展示、采纳命名/仅合并新标签、忽略无副作用、重新生成结果一致、同名禁用、provider 抛错降级）；`review.test.ts` 增补 updateAssetName（3）；`ReviewPanel.test.tsx` 增补 AI 区集成断言（1）。
- 验证：`powershell -ExecutionPolicy Bypass -File scripts\verify.ps1` 全绿（23 文件 233 测试通过：既有 213 无回归 + 新增 20；`tsc -b` + `vite build` 成功）。
- 已知限制：
  - 摘要建议仅展示、无采纳动作（Scope 未定义摘要去向，如"采纳到备注"）；如需可在后续任务扩展。
  - 图片命名序号在文件名无数字时来自 asset.id 稳定哈希：同素材跨会话确定，但非导入顺序序号。
  - 建议面板随评审面板打开（无独立入口）；三类素材建议结构一致、均可用。
- 建议 Reviewer 关注：`domain/review.ts` 新增 `updateAssetName` 与禁止项"不改 domain 契约"的边界；`ReviewPanel` 可选 prop 扩展的向后兼容性；AiPanel 内嵌于评审面板（而非独立抽屉）的集成点选择。