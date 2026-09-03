# Technical Debt and Non-blocking TODO

不在当前 Task 范围内、且不阻塞交付的问题记录在这里。每条应足够清楚，以便未来独立建 Task；不要把它当作无优先级的愿望清单。

| ID | Problem | Impact | Priority | Suggested direction | Source | Status |
|---|---|---|---|---|---|---|
| TD-001 | 刷新页面后图片素材的 objectUrl 无法重建（T-003 未保留 File 引用，重复导入又被去重），当前无用户路径恢复刷新后的图片预览 | 刷新后图片网格显示占位+提示，需重新导入；影响体验但不影响评审结论持久化 | medium | 方案 A：T-003 useImport 对重复导入重建 objectUrl（低风险）；方案 B：IndexedDB 存 blob（需 Human 决策） | review 2026-09-04 (T-001~T-004 里程碑) | open |