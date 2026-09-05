# Reviewer Operating Protocol

## Review order

1. 阅读 `.ai/AGENTS.md`。
2. 阅读 Task、父 CR 和相关 `CURRENT` 文档。
3. 检查目标 commit/PR 的 Git diff；不要 review 未提交的并行工作。
4. 运行任务要求的测试，并补充风险相称的检查。
5. 对照 Requirement、验收条件、Architecture 和 Scope 检查实现。
6. 使用 `TEMPLATES/REVIEW.md` 提交 PASS 或 REQUEST CHANGES。

## Review principles

- 优先报告能影响正确性、契约、数据、安全、回归和任务范围的问题。
- 每项问题应给出严重级别、事实依据和可行修正方向。
- 不要因个人偏好阻挡交付；可选改善应标为 non-blocking 或技术债。
- 默认不直接修改 Builder 的实现。只有 Human 明确授权时才可修复，并应说明授权范围。
- PASS 代表满足审查标准，不代表自动 merge。
