# AI 协作工程模板

本目录保存产品、架构和协作事实；Git 保存代码事实。

## 目录

```text
.ai/
├── AGENTS.md                 # 全体 Agent 的共同协议
├── CURRENT/                  # 已批准且进入主线的当前事实
├── CHANGES/                  # CR 历史与进行中的变更
├── AGENTS/                   # 各角色的操作规范
├── TEMPLATES/                # 可复制的 CR、Task、Review、ADR 模板
└── TODO.md                   # 技术债与非阻塞待办
```

## 使用流程

1. Human 提出意图；Planner 按 Change Level 分类并给出方案。
2. L0/L1 建立独立 Task；L2+ 创建 CR，再建立 Requirements、Architecture/Design delta 和 Tasks。
3. Human 批准需要批准的 CR、架构变更或重构。
4. Builder 在独立 Git branch/worktree 实现一个 Task，提交结果。
5. Reviewer 基于 Task、CURRENT 和 diff 产出 PASS / REQUEST CHANGES。
6. Human 合并。合并后由 Coordinator 更新 `CURRENT/`，将 CR 标为完成。

## 新建变更

- 从 `TEMPLATES/CR/` 复制一个目录到 `CHANGES/CR-001-<slug>/`。
- 每个可执行任务从 `TEMPLATES/TASK.md` 复制到该 CR 的 `TASKS/` 目录。
- L0/L1 无 CR 时，放到 `CHANGES/INBOX/T-XXX-<slug>.md`，并在任务中标明 `cr: null`。
- 未合并的分支、草稿和 Agent 推测不得写入 `CURRENT/`。

## 命名与状态

- CR：`CR-001-short-title`；Task：`T-001-short-title`；ADR：`ADR-001-short-title`。
- CR 状态：`proposed` → `approved` → `in_progress` → `in_review` → `completed`；也可为 `rejected` / `superseded`。
- Task 状态：`planned` → `ready` → `in_progress` → `in_review` → `done`；也可为 `blocked` / `cancelled`。

## CURRENT 更新规则

只有当变更已经合并、且 Human 接受其产品或架构结果后，才更新对应的 `CURRENT` 文档。更新时写明关联 CR 和日期，避免把文档当作计划草稿。
