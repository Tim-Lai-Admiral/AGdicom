# Requirements Delta: CR-002

> 仅描述本 CR 新增（流程）与承接（产品）的需求；产品需求正文在 CR-001 `REQUIREMENTS.md`（R-006/R-007/R-008），此处仅登记承接关系与验收要点。

## P-001: 任务卡 Context pack 与预期步数规范

**Status**: approved

**Behavior**

```text
Given 规划任何新任务
When 创建任务卡
Then 卡片必须包含 Context pack 段（本任务适用 R-ID、关键契约/文件路径、参考模式、禁止项指针）
And Metadata 中记录 expected_steps（预期步数）
```

**Acceptance criteria**

- [ ] CR-002 的 T-008~T-010 卡片均含 Context pack 段与 expected_steps。
- [ ] 模板 `TEMPLATES/TASK.md` 已含相应字段（已有 Context pack 行；补 expected_steps 说明）。

## P-002: 极简派发 prompt

**Status**: approved

**Behavior**

```text
Given 协调者派发任务
When 编写派发 prompt
Then 只包含：任务ID、分支、卡片外增量事实（≤300 字符）
And 不重复任务卡/ENVIRONMENT.md/agent prompt 中已有的内容（交付物清单、验收、禁止项、报告格式）
```

**Acceptance criteria**

- [ ] T-008 派发 prompt ≤300 字符，且 builder 完成质量不低于 T-007（无信息缺失导致的返工）。

## P-003: Builder 信息不足兜底

**Status**: approved

**Behavior**

```text
Given Builder 阅读任务卡与 ENVIRONMENT.md 后仍信息不足
When 无法确定实现路径
Then 按 BLOCKED-信息不足 报告所需清单（缺什么、影响什么），不得猜测
```

**Acceptance criteria**

- [ ] builder.md / builder-flash.md 提示词含此兜底条款。

## P-004: Git 规则（Human 2026-09-04）

**Status**: approved

**Behavior**

```text
Given 任何 Agent 进行 Git 操作
When 涉及提交、分支、PR、合并
Then 遵守 15 条规则（全文见 .ai/AGENTS.md §6）：
     1 main 代表可接受状态；2 Agent 禁止直接 push main；3 每 Task 独立分支；
     4 分支名含 CR+Task ID；5 Builder 可多 commit；6 Builder 完成后建 PR；
     7 Reviewer 审 PR 而非 working tree；8 CI 自动 test/lint/build；
     9 Reviewer 独立验证；10 Human 拥有最终 Merge 权；11 Merge 后删分支；
     12 重大版本用 Tag；13 需求/架构历史归 CR、代码历史归 Git；
     14 禁止为让代码能跑而改 Requirement；15 Conflict 显式解决
```

**Acceptance criteria**

- [ ] `.ai/AGENTS.md` §6 含 15 条全文（T-011 验收）
- [ ] `.github/workflows/ci.yml` 存在（test/lint/build）
- [ ] Builder/Reviewer 提示词含 PR 工作流

## Carried requirements（承接 CR-001）

| ID | 内容 | 验收要点（正文见 CR-001 REQUIREMENTS.md） |
|---|---|---|
| R-006 | Mock AI 建议（命名/标签/摘要，确定性规则，AIProvider 接口，AI_USAGE.md） | 三类建议可用、确定性、采纳/忽略、Mock 明示 |
| R-007 | 样本素材与来源记录 | 合成 DICOM 系列（≥2 series，≥5 切片，去标识化标记）；README 素材章节（来源/格式/获取方式/使用范围 + TCIA 指引）；STL 已入库 |
| R-008 | 交付文档（README.md / AI_USAGE.md） | 按 README 可启动；文档与实现一致；已知问题如实记录 |