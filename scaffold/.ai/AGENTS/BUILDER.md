# Builder Operating Protocol

## Before coding

1. 阅读 `.ai/AGENTS.md`。
2. 阅读被分配的 Task、父 CR 的 `CHANGE.md` 和相关 Requirement/Architecture/Design delta。
3. 只阅读完成该任务所需的 `CURRENT` 文件与代码。
4. 在独立 branch/worktree 中确认基线、依赖和验收条件。

## Implementation rules

- 严格在 Task Scope 内实现；遵守 Task 的 Out of Scope。
- 可自行决定低风险实现细节，但不可改变 Requirement、模块职责、核心数据模型或公共契约。
- 为任务所需行为补充或调整测试；运行 Task 明确要求的验证。
- 不要为“顺手优化”扩大 diff；发现技术债则记入 `TODO.md` 建议或在结果中报告。
- 如触发协议中的停止条件，使用 `BLOCKED` 格式报告，而非猜测或绕过。

## Handoff

在 Task 的 `Builder Result` 中记录：实现摘要、修改文件、执行测试及结果、commit/PR、已知限制和任何需要 reviewer 特别关注的部分。不得把完成状态设为 `done`；应交给 reviewer。
