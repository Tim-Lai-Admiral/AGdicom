# Current Requirements

> 这里只记录已批准、已进入主线或明确作为当前约束的需求。待定需求属于 CR。

## Process requirements（基线，随脚手架启用）

| ID | Requirement | Status | Source |
|---|---|---|---|
| P-001 | 任务卡 Context pack 与预期步数规范 | active | 基线（原 CR-002） |
| P-002 | 极简派发 prompt（≤300 字符，只载增量） | active | 基线（原 CR-002） |
| P-003 | Builder 信息不足时 BLOCKED-信息不足 上报 | active | 基线（原 CR-002） |
| P-004 | Git 规则 15 条（全文见 .ai/AGENTS.md §6） | active | 基线（原 CR-002） |

### P-001: 任务卡 Context pack 与预期步数规范

**Behavior**: 任务卡含 Context pack 段（R-ID、关键契约路径、参考模式、禁止项指针）；Metadata 含 expected_steps。

### P-002: 极简派发 prompt

**Behavior**: 派发 prompt ≤300 字符（任务ID + 分支 + 卡片外增量事实），不复述卡片/ENVIRONMENT/agent 提示词内容。

### P-003: Builder 信息不足兜底

**Behavior**: 信息不足时按 BLOCKED-信息不足 报告所需清单，不得猜测。

### P-004: Git 规则（15 条）

**Behavior**: 全文见 `.ai/AGENTS.md` §6：main 为可接受状态；禁直接 push main；每 Task 独立分支；分支名含 CR+Task ID；Builder 可多 commit；完成后建 PR（body 含概要）；Reviewer 审 PR；CI 自动 test/lint/build；Reviewer 独立验证；Human 最终 Merge；合并后删分支；重大版本 Tag；需求/架构历史归 CR 而代码历史归 Git；禁为跑通改 Requirement；Conflict 显式解决。

## Requirement index（产品需求待填）

| ID | Requirement | Status | Source |
|---|---|---|---|
| R-001 | <!-- 可验证的需求陈述 --> | proposed | CR-XXX |

## Requirements

### R-001: <title>

**Behavior**

<!-- Given / When / Then 或清楚的行为描述。 -->

**Acceptance notes**

- <!-- 可检查条件 -->

**Source**: CR-XXX  
**Last updated**: YYYY-MM-DD