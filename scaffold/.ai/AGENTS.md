# AI Agent Collaboration Protocol

## 1. 角色与权限

| 角色 | 主要职责 | 不得擅自决定 |
|---|---|---|
| Human | 产品方向、重大需求/架构/重构批准、最终合并 | — |
| Codex / Planner | 需求分析、方案、CR、任务拆分、架构建议与协调 | 未批准的产品和架构事实 |
| Builder（Devin 等） | 在任务边界内实现、测试、提交 | 产品方向、需求、重大架构和重构 |
| Reviewer（OpenCode 等） | 检查 diff、需求、架构、测试和风险 | 绕过 Builder 直接重写实现（除非明确授权） |
| UI/UX Agent（Stitch 等） | 页面、交互、视觉与设计提案 | 核心业务逻辑、数据模型和后端架构 |

AI 具有低风险实现细节的自主权；Human 保留最终否决权。

## 2. 事实层级

冲突时按以下优先级处理：

1. Human 的明确决定
2. `.ai/CURRENT/`
3. 已批准的 `.ai/CHANGES/` 文档和 ADR
4. `main` / 默认分支中的代码
5. Agent 分支中的代码
6. Agent 的推测

Agent 不得为迎合实现方便而修改更高层事实。未合并分支不能当作 CURRENT。

## 3. Change Level

| 级别 | 适用范围 | 最小流程 |
|---|---|---|
| L0 微调 | 文案、样式、小 bug、局部参数 | 直接 Task |
| L1 小功能 | 单一字段、按钮、简单交互 | Task；必要时简短需求说明 |
| L2 功能 | 可独立描述的完整能力 | CR → Requirements → Tasks → Review |
| L3 架构变化 | 模块职责、数据流、数据库、公共 API、框架或大规模重构 | CR → Architecture → Human approval → Tasks |
| L4 产品方向 | 产品定位、核心用户流程、核心交互模式 | Product proposal → Human decision → CR |

CR 是产品意义上的变化，不等于 Git commit；Task 是最小可执行、可 review 的工作单元。

## 4. Task 边界

每个 Task 必须明确目标、范围、非范围、依赖、验收标准与测试要求。Builder 只实现获指派的 Task；不要借机解决无关问题。

若完成 Task 必须触及 `Out of Scope`、不明确的接口/数据契约、或另一个 Agent 正在修改的核心区域，停止扩大改动并按“阻塞格式”报告。

建议每个 Task 只涵盖一个可验证能力，通常影响 3–8 个文件；明显更大时优先拆分。Task 依赖按工程依赖而非产品页面顺序排序：基础设施 → 领域模型/契约 → 核心能力 → 业务功能 → AI 能力 → 优化。

## 5. 架构与重构

允许 Task 范围内、保持外部行为与模块职责不变的局部整理。

以下必须获得 Human 批准：新增/删除架构层、模块职责改变、核心数据模型或公共 API 改动、数据库迁移、框架迁移、大范围重构、删除核心功能。

当现有架构阻碍任务时，提交 Architecture Change Proposal；不要偷偷绕过或重写架构。

## 6. 并行与 Git

多个 Agent 可以并行规划、实现和 review，但每个修改型 Agent 必须使用独立 Git branch/worktree。禁止多个 Agent 同时写同一个 working tree。

Git 规则（基线 P-004；"main"指默认分支，默认分支名以仓库实际为准，本模板示例为 `master`）：

1. main 永远代表可接受的项目状态。
2. Agent 禁止直接向 main push。
3. 每个 Task 默认拥有独立 branch。
4. Branch 名称包含 CR 和 Task ID（如 `feature/CR-XXX-T-001-short-title`）。
5. Builder 可以创建多个 commit。
6. Builder 完成 Task 后创建 PR（push 分支 + `gh pr create --base master`）。
7. Reviewer 审查 PR，而不是直接审查 working tree（`gh pr checkout <num>` 后验证，diff 以 PR 为准）。
8. CI 自动执行测试 / lint / build（`.github/workflows/ci.yml`）。
9. Reviewer 负责独立验证（复跑测试与构建，不以 Builder 声明为准）。
10. Human 拥有最终 Merge 权限。
11. Merge 后删除 Task branch。
12. 重大版本使用 Tag。
13. Requirement / Architecture 的历史由 CR 保存；代码历史由 Git 保存。
14. 不允许为了"让代码能跑"而修改 Requirement。
15. Conflict 必须显式解决，不允许 Agent 静默覆盖其他 Agent 的修改。

新任务若依赖未合并工作，必须在 Task 中写明 `depends_on`；不能假设代码已经存在。Review 只检查明确提交的 commit/PR，而不是另一个 Agent 正在变化的目录。

## 7. 标准流转

```text
Human intent → Planner proposal → approval (when required) → Task
→ Builder branch/commit → Reviewer report → Human merge
→ CURRENT update
```

Reviewer 先报告问题，Builder 负责修正，之后重新 review。审查通过不自动授权合并，除非 Human 已另行授权。

## 8. CR Revision 与技术债

CR 内的小实现修正通常新增 Task。若 CR 的目标、需求或基本解决方案发生变化，创建 `REVISION-N.md`，保留历史而非静默改写。

不阻塞当前任务的技术债记录到 `.ai/TODO.md`，不得顺手进行大规模修复。

## 9. 停止条件与报告格式

出现以下任一情形立即停止猜测：需求与 CURRENT 冲突；架构无法支撑；需要重大重构；存在无法自行选择的产品方案；接口/数据契约不清楚；验收条件冲突；目标文件正被其他 Agent 修改。

```text
BLOCKED

Task: <ID>
Reason: <事实>
Current understanding: <已确认内容>
Options:
1. <选项与影响>
2. <选项与影响>
Recommendation: <建议>
Decision required from: Human / Planner
```

## 10. 禁止行为

- 以通过测试为由修改 Requirement。
- 为了易于实现而改变 Architecture 或产品方向。
- 删除用户未要求删除的能力。
- 把临时或未合并实现登记为 CURRENT。
- 修改其他 Agent 的任务或无关区域。
- 以不确定为由自行做重大产品决策。
