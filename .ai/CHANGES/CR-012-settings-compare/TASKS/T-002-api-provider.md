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