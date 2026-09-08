# Task T-002: API 配置存储 + 真实 AI provider（回退 Mock）

## Metadata

```yaml
id: T-002
cr: CR-012
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 20
depends_on: [T-001]
branch: feature/CR-012-T-002-api-provider
```

## Context pack

- Requirement: R-027（持久化）/ R-028
- 关键文件：`src/features/ai/types.ts`（AIProvider 接口；现建议同步——若远程需异步，评估接口改造为 `suggest(asset): AiSuggestion | Promise<AiSuggestion>` 并兼容 AiPanel 与单测）、`src/features/ai/mockProvider.ts`、`src/features/ai/AiPanel.tsx`（来源明示：真实 API/Mock）、`src/features/settings/SettingsDialog.tsx`（T-001 骨架填实）、`src/store/`（新增 settings 存储：localStorage 独立 key `ag-review-workbench:settings`，不进入 io.ts 导出）
- 远程调用契约（自定）：POST `{baseURL}/suggest`（或兼容 OpenAI chat completions 的简化 POST），body {name, kind, meta}，响应 {name, tags, summary}；鉴权 header `Authorization: Bearer <key>`；超时（如 10s）；非 2xx/解析失败/超时 → 回退 mockProvider
- AI_USAGE.md：真实 API 接入说明、回退行为、密钥仅存本机 localStorage（安全提示：请勿提交密钥）
- 禁止：改 domain/store 素材契约；改导出 JSON

## Objective

设置弹窗填实（配置持久化）；远程 AIProvider 实现 + 自动回退 Mock；来源明示。

## Scope

- settings 存储：`src/features/settings/settingsStore.ts`（load/save/默认值；localStorage）
- 远程 provider：`src/features/ai/remoteProvider.ts`（fetch 封装、超时、错误分类；返回结果与 AiSuggestion 一致）；provider 选择逻辑（设置.enabled && baseURL && key → remote，否则 mock；remote 抛错/失败 → mock）
- AiPanel：来源徽标「真实 API」/「Mock」；加载态（异步建议时）
- AI_USAGE.md 更新
- 测试：settings 往返/默认值；remote 成功/超时/非2xx/解析失败→mock 回退；AiPanel 来源切换与加载态
- `scripts\verify.ps1` 全绿

## Out of scope

- 并发/重试策略；流式输出

## Acceptance criteria

- [ ] 设置保存/恢复；导出 JSON 不含设置
- [ ] 启用+配置完整 → 远程调用（mock fetch 单测）；任何失败/未配置 → 回退 Mock 且明示
- [ ] AiPanel 加载态/来源明示；无密钥泄露（日志/导出）
- [ ] 存量全绿

## Test requirements

- [ ] Unit: settings/remote/回退/AiPanel
- [ ] Manual: 配置假 API 观察回退

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **实现摘要**：设置弹窗填实（受控四字段 + 保存持久化）；`settingsStore`（独立 key
  `ag-review-workbench:settings`，load/save/损坏容错，不进 io.ts 导出）；`remoteProvider`
  （POST `{baseURL}/suggest`，Bearer 鉴权，body 仅名称/类型/元数据/文件描述，无二进制；
  10s AbortController 超时；非 2xx/超时/网络/JSON/结构解析失败抛错）；`selectAiProvider`
  纯函数选择（enabled && baseURL && apiKey → remote，否则 Mock；fallbackToMock 决定是否附带
  mock 兜底）；AiPanel 异步化（`suggest(): AiSuggestion | Promise<AiSuggestion>`）+ 加载态 +
  来源徽标（真实 API / Mock 生成）+ 失败回退 Mock 且明示；AI_USAGE.md 更新（接入/契约/回退/
  密钥安全）。
- **接口决策**：接口改为 `AiSuggestion | Promise<AiSuggestion>`（fetch 本质异步，同步接口
  不可行）；AiPanel 对同步 provider 行为不变（effect 内同步落定），存量测试仅更新 1 处徽标
  断言（THROWING_PROVIDER 现按 provider label 明示来源）。回退放 AiPanel 层（`fallbackProvider`
  可选 prop），保证徽标如实反映本次来源；未提供兜底时保持既有「暂无建议」降级语义。
- **默认值**：`enabled: false`（默认关闭）；`fallbackToMock: true`（失败默认安全回退，
  仅影响已启用且配置完整的场景；关闭时远程失败不悄悄换源，显示「暂无建议」）。
- **文件清单**：新增 `src/features/settings/settingsStore.ts`(+test)、
  `src/features/ai/remoteProvider.ts`(+test)；修改 `src/features/ai/types.ts`、`AiPanel.tsx`(+test)、
  `mockProvider.test.ts`（类型适配）、`src/features/settings/SettingsDialog.tsx`(+test)、
  `src/features/review/ReviewPanel.tsx`（透传 props）、`src/App.tsx`（设置状态/选择/接线）、
  `AI_USAGE.md`、本任务卡。
- **验证结果**：`scripts/verify.ps1` 全绿（41 文件 416 测试通过；`tsc -b && vite build` 成功）。
  覆盖：settings 往返/默认值/损坏容错/保存失败/导出不含设置与 Key；remote 成功/部分响应/
  非 2xx/超时/网络/解析失败（mock fetch）；selectAiProvider 三态；AiPanel 远程成功/回退明示/
  无兜底降级/加载态。Manual（配置假 API 观察回退）留待 Reviewer 按任务卡执行。
- **commit**：分支 `feature/CR-012-T-002-api-provider`（含 T-001 提交链）；PR：见 Git 记录
  （PR body 注明按序合并 #52 → 本 PR）。
- **已知限制/技术债**：远程契约为本仓库自定义简化契约（非 OpenAI chat completions 兼容），
  如需兼容 OpenAI 协议需后续 Task；并发/重试策略按任务卡 Out of scope 未实现；
  `settingsSaveError` 复用 App 既有 saveError 提示区（与评审保存同模式）。
- **需 Reviewer 关注**：① 回退明示语义（回退时徽标为「Mock 生成」+ 回退文案）；
  ② fallbackToMock 关闭时远程失败显示「暂无建议」是否符合产品预期（本实现按「不悄悄换源」处理）；
  ③ 远程请求仅发送元数据不含二进制的隐私边界（AI_USAGE.md §4.2/4.4）。