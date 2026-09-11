> ## 概要
>
>本项目从开发开始使用零代码方式完全由 AI Coding Agent开发。本人没有让一个 Agent 从需求一直写到代码，而是根据实际开发中的问题，把工作拆成了需求规划、UI 设计、代码实现和独立 Review几个环节。
>以下为项目基本概要，略读概要可得知本项目95%的结果，正文部分展示的主要是推导和思考过程等。
>
> 我的基本分工是：
>
> * **Human**：负责产品方向、重要需求和架构决策，以及最终合并。
> * **Codex / Planner**：分析需求、讨论技术方案、拆分 CR 和 Task，不直接负责业务代码；一般由deepseek v4 pro max担任。
> * **UI/UX Agent**：负责页面结构、交互和视觉设计，确认后的结果进入 Design 文档；一般由figma/stitch担任。
> * **OpenCode / Builder**：按照 Task 在独立分支中实现、测试并提交 PR；一般由GLM 5.3 flash担任。
> * **OpenCode / Reviewer**：独立检查 PR 的代码、需求符合度和测试结果；一般由deepseek pro 担任。
>
>注：*CR (Change request)可以理解为一个完整的需求变更单。它描述一次相对完整的功能或产品变化，再进一步拆成一个或多个 Task 交给 Agent 实现。
>	对应关系相当于：
>	CR = “这次要做什么变化”
>	Task = “具体怎么把它做出来”
>
> 项目的基本开发流程：
>
> ```text
> 需求 → 规划 → Task → Branch → Builder → PR → Reviewer → Human → main
> ```
>
> 默认情况下一个 Task 对应一个 Branch 和一个 PR；复杂需求可以由一个 CR 拆成多个 Task。高不确定性的技术问题不会直接交给 Builder，而是先做 Spike 验证方案。
>
>
> 开发过程中遇到的一个比较实际的问题是 **AI 上下文和任务规模会直接影响成本和稳定性**。因此后来增加了 Task 上下文裁剪、步数检查点和 Spike，并根据任务的不确定性选择不同能力的模型。
>
> 另一个经验是，**AI 能把功能做出来，并不代表产品设计就是合理的**。例如 DICOM 评审栏目曾经被实现成需要先打开详情、再关闭详情才能进行 Review，技术上功能存在，但用户操作流程并不合理。这个问题促使我把 UI/UX 和 User Flow 从代码实现中进一步独立出来。
>
> 在质量方面，Builder 负责实现后的测试，Reviewer 再从独立视角检查 PR，并结合 CI 做验证。
>
> 截至当前版本，项目累计 **15 个 CR、60+ 个 PR**。这些数据对我来说更重要的意义不是“AI 写了多少代码”，而是验证了一件事：**在大量使用 AI 的情况下，仍然需要通过清晰的任务边界、上下文管理、代码 Review 和 Git 流程，让 AI 的修改保持可理解、可验证和可追踪。**


以下为正文（正文由deepseek总结后人工少量精修）:


# AI 辅助开发实践

这个项目从开发开始就大量使用 AI Coding Agent。

我没有把 AI 当成单纯的代码生成工具，而是尝试把不同模型放到不同的开发环节中：一个模型负责分析和拆分需求，一个负责实现，一个负责独立检查，UI 则单独进行设计。

这个过程不是一开始就设计好的。随着项目变复杂，我根据实际遇到的问题逐步调整了任务拆分、上下文、Git 和 Review 流程。

---

## 1. 我是怎么使用 AI 的

目前主要分成几个角色：

| 角色 | 主要工作 |
|---|---|
| Human | 产品方向、重要需求和架构决策、最终合并 |
| Codex / Planner | 分析需求、讨论方案、拆分任务、处理架构问题 |
| UI/UX Agent | 页面结构、交互和视觉方案 |
| Devin / Builder | 按 Task 编写代码、测试和提交 PR |
| OpenCode / Reviewer | 独立检查代码、需求和测试结果 |

这里最重要的一点是：**不同 Agent 不负责同一件事情。**

例如我不会让 Builder 在实现过程中自行修改产品需求，也不会让 Reviewer 为了修复发现的问题直接修改 Builder 的代码。

如果实现过程中发现需求本身有问题，应该回到需求层解决，而不是让实现方自己“调整需求直到代码能跑”。

---

## 2. 为什么要把 Planner 和 Builder 分开

一开始很容易产生这样的工作方式：

```text
一个 AI
  ↓
读需求
  ↓
自己决定方案
  ↓
自己写代码
  ↓
自己测试
```

这种方式对于小功能没有太大问题，但项目变大以后容易出现两个问题：

1. AI 会在实现过程中逐渐改变最初的需求。
2. 如果实现遇到困难，它可能通过修改设计或需求来绕开问题。

因此现在更倾向于：

```text
需求
 ↓
Planner
 ↓
确定方案和 Task
 ↓
Builder
 ↓
实现
 ↓
Reviewer
 ↓
Human
```

Planner 主要负责 `.ai/` 下的规划文档，而不是直接写业务代码。

Builder 拿到已经明确的 Task 后执行。

这样可以让“应该做什么”和“怎么把它实现出来”尽量分开。

---

## 3. CR 和 Task

项目中使用 CR（Change Request）记录比较完整的需求变化。

一个 CR 可以包含多个 Task。

例如：

```text
CR-005：增加 DICOM 支持

├── T-001：DICOM 文件识别
├── T-002：DICOM 元数据解析
├── T-003：DICOM UI 展示
└── T-004：错误处理
```

CR 更关注：

- 为什么要做
- 改变了什么
- 对现有产品有什么影响
- 是否需要修改架构或设计

Task 则关注：

- 具体要实现什么
- 哪些文件/模块会受到影响
- 什么内容不在范围内
- 如何验收
- 怎么测试

不是所有修改都需要 CR。

比较小的修改可以直接形成 Task；如果已经涉及完整功能、数据结构或架构变化，再建立 CR。

---

## 4. Task 尽量作为一个独立的交付单元

现在比较倾向于：

```text
1 Task
 ↓
1 Branch
 ↓
1 PR
 ↓
1 Review
 ↓
Merge
```

例如：

```text
T-003
 ↓
feature/CR-005-T-003
 ↓
Devin 实现
 ↓
PR
 ↓
OpenCode Review
 ↓
Human Merge
 ↓
main
```

默认一个 Task 一个 PR，是因为这样比较容易追踪问题。

如果以后发现某个问题，可以直接从：

```text
Requirement
 ↓
CR
 ↓
Task
 ↓
PR
 ↓
Commit
 ↓
代码
```

一路追溯。

但如果两个 Task 高度耦合、无法独立交付，也可以放在一个 PR 中，不为了形式上的“一 Task 一 PR”而增加不必要的管理成本。

---

## 5. Git 在这个流程中的作用

Git 主要负责保存代码历史，而 `.ai/` 负责保存需求和设计决策。

我目前采用比较简单的分支方式：

```text
main
├── feature/CR-001-T-001
├── feature/CR-001-T-002
└── fix/CR-002-T-003
```

基本流程：

```text
Task
 ↓
创建任务分支
 ↓
Builder 实现
 ↓
Commit
 ↓
创建 PR
 ↓
Reviewer Review
 ↓
Human 决定是否 Merge
 ↓
main
```

`main` 尽量保持在一个可以接受的状态。

Agent 不直接向 `main` push。

Reviewer 的职责是判断 PR 是否符合需求和质量要求，但 Review 通过不等于自动 Merge，最终合并仍由我决定。

---

## 6. 需求、设计和代码分别保存在哪里

为了避免不同 AI 会话之间反复解释同样的背景，目前使用：

```text
.ai/
├── CURRENT/
│   ├── PRODUCT.md
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   └── DESIGN.md
│
├── CHANGES/
│   └── CR-XXX/
│       ├── CHANGE.md
│       ├── REQUIREMENTS.md
│       ├── ARCHITECTURE.md
│       ├── DESIGN.md
│       └── TASKS/
│
├── AGENTS/
│   ├── AGENTS.md
│   ├── CODEX.md
│   ├── DEVIN.md
│   └── OPENCODE.md
│
├── SPIKES/
└── TODO.md
```

这里有一个比较重要的原则：

### CURRENT 表示现在是什么

例如：

```text
.ai/CURRENT/REQUIREMENTS.md
```

表示当前已经确认的需求。

### CHANGES 表示为什么变成现在这样

CR 保存需求变化和相关决策。

### Git 表示代码怎么变化

代码历史通过 Branch、Commit 和 PR 保留。

这样可以避免把 Git 和 `.ai/` 都变成两套版本管理系统。

---

## 7. 我实际遇到的问题：AI 上下文太大

这是这个项目中比较明显的一个问题。

最开始 Builder 会读取大量文档：

```text
AGENTS.md
Builder 说明
CHANGE
REQUIREMENTS
ARCHITECTURE
DESIGN
...
```

对于比较大的 Task，这会产生大量重复上下文。

尤其是 DICOM 相关任务，曾经出现过一个明显的成本热点：

- 单个 T-005 DICOM 任务约 49.5 万 input tokens
- 约 6.1 万 output tokens
- 约 70k reasoning
- 85 steps
- 107 次 tool calls
- 39 次 patches
- 成本约 $3.99

所以后来开始调整 Builder 的上下文。

现在更倾向于让 Task 自己说明：

```text
相关 Requirement
相关 Architecture
相关 Design
需要修改的模块
限制条件
验收标准
```

Builder 优先读取这些内容，而不是每次重新阅读整个项目。

这个变化对我来说比较重要：

> AI Coding 的问题不只是模型能力，也包括给模型什么上下文。

---

## 8. Prompt 也尽量变短

以前会把大量项目背景写进每一次 Agent 的启动 Prompt。

后来发现很多内容其实已经存在于项目文档里。

因此现在的思路是：

```text
Prompt
+
Task
+
项目中的权威文档
```

而不是：

```text
一个很长的 Prompt
+
重复一遍项目所有背景
```

Prompt 主要负责告诉 Agent：

- 当前 Task
- 当前 Branch
- 少量本次会话特有的信息

其他信息通过文档获取。

这样也减少了不同会话之间出现“Prompt 里说一套，文档里又是另一套”的情况。

---

## 9. 高不确定性的任务先做 Spike

并不是所有 Task 都适合直接让 Builder 开始写代码。

例如 DICOM 解析涉及：

- 第三方解析库
- 浏览器环境
- 测试数据
- 不同 DICOM 文件
- 解析结果和现有数据结构之间的关系

如果直接让 Builder 探索，很容易出现：

```text
尝试方案 A
 ↓
失败
 ↓
换方案 B
 ↓
又失败
 ↓
修改原来的架构
 ↓
继续尝试
```

这种任务很容易消耗大量模型上下文。

因此现在对于高不确定性的技术问题，会先做一个 Spike：

```text
Spike
 ↓
验证技术方案
 ↓
记录结论和限制
 ↓
Human 确认方向
 ↓
正式 Task
 ↓
Builder 实现
```

Spike 不是每个任务都需要。

简单的 CRUD、样式调整、普通页面修改，没有必要增加这个步骤。

---

## 10. 限制 AI 无限探索

另一个实际问题是，有些任务会出现 Agent 长时间尝试但没有明显进展的情况。

因此给 Task 增加一个预期步数。

例如：

```text
简单任务：10～25 steps
普通功能：25～45 steps
复杂任务：45～70 steps
```

这里的数字不是硬性限制，而是一个预警。

如果明显超过预期，就需要检查：

- Task 是否太大
- 需求是否不清楚
- 架构是否存在问题
- 是否需要 Spike
- 是否应该重新拆 Task
- Agent 是否陷入重复尝试

如果已经达到检查点，会记录：

```text
T-XXX-CHECKPOINT.md
```

记录：

```text
已经完成什么
当前方案
尝试过但失败的方案
剩余工作
当前阻塞
下一步建议
```

这样即使结束当前 AI 会话，也可以让新的会话继续，而不需要重新从头理解整个任务。

---

## 11. 遇到不明确的问题时，不让 Agent 自己猜

现在给 Agent 的一个重要规则是：

> 如果需求、架构或外部条件不足以支持一个可靠的决定，就先报告问题。

例如：

```text
BLOCKED

事实：
xxx

当前理解：
xxx

存在的选择：
A
B

建议：
xxx
```

而不是：

```text
不知道应该怎么办
 ↓
AI 自己猜一个
 ↓
继续写代码
```

因为对于 AI Coding 来说，错误的决定如果在早期没有暴露，后面通常会变成更大的返工。

---

## 12. Builder 和 Reviewer 都测试，但目的不同

Builder 负责：

> “我实现了这个功能，并且验证它可以工作。”

因此 Builder 会：

- 编写相关测试
- 运行受影响的测试
- 必要时执行 build
- 提交 PR

Reviewer 则负责：

> “我不完全相信 Builder 的结论，我独立检查它。”

Reviewer 会检查：

- PR diff
- Task 的 Acceptance Criteria
- Requirements
- Architecture
- 关键测试
- 是否存在明显的回归

不会为了形式而每次重复执行所有测试。

目前采用风险分层：

```text
核心业务 / 数据解析
    ↓
更严格的测试

普通 UI
    ↓
关键交互测试

视觉调整
    ↓
冒烟 + 存量回归
```

---

## 13. 一个实际发现：Review 能发现 Builder 自己发现不了的问题

例如项目中曾出现过一个隐私问题：

DICOM 相关功能需要调用远程 AI API。

如果直接把 DICOM 元数据发送出去，就可能把患者姓名、患者 ID 等直接标识符一起发送。

后来在请求构造层增加了白名单过滤：

```text
DICOM
 ↓
toRemoteDicomMeta()
 ↓
只保留允许发送的字段
 ↓
Remote AI
```

并通过测试保证患者直接标识符不会进入远程请求。

这个问题如果只依赖 Builder 的自测，很可能不会被当成重点检查。

因此 Reviewer 的价值不只是“再跑一遍测试”，而是从另一个角度重新检查实现。

---

## 14. AI 使用中的安全边界

这个项目虽然涉及 DICOM，但并不是医疗诊断软件。

因此 AI 的职责只包括：

- 文件整理
- 元数据处理
- 素材分析
- 工程上的辅助信息

不允许 AI 生成诊断或治疗结论。

另外：

### API Key

API Key 只保存在本地配置中：

```text
localStorage
```

不进入：

```text
导出的 JSON
日志
Git
```

### Remote AI

发送到远程 AI 的 DICOM 信息经过过滤。

### Mock

真实 API 调用失败时，可以使用确定性的 Mock。

但界面会明确告诉用户：

```text
Real API
```

还是：

```text
Mock
```

不会让 Mock 结果伪装成真实 AI 结果。

---

## 15. UI 设计也和代码实现分开

UI 设计目前不让 Builder 自己决定。

比较理想的流程是：

```text
Codex
 ↓
确定页面需要解决什么问题
 ↓
UI/UX Agent
 ↓
页面结构 / 交互 / 视觉方案
 ↓
Human 确认
 ↓
DESIGN.md
 ↓
Devin 实现
```

这里 Codex 负责的是：

> 这个页面需要什么功能，用户怎么使用它。

UI/UX Agent 负责：

> 这些功能应该怎样组织和呈现。

Devin 最后负责：

> 把确定下来的设计实现出来。

这样可以减少“代码能跑，但是产品交互不合理”的情况。

例如 DICOM Review Workbench 的开发过程中就出现过一个设计问题：

最开始的实现把 Review Workbench 放在 DICOM 卡片之外。

用户点击 DICOM 后首先进入的是 DICOM Detail Popup。

如果要进行 Review，还需要先关闭这个 Popup。

从技术实现角度看功能存在，但从用户操作流程看并不合理。

这个问题让我意识到：

> UI 任务不能只描述“需要一个 Review Workbench”，还必须明确用户从素材浏览到 Review 的完整操作流程。

所以现在在设计 Task 时，会更加重视 User Flow，而不只是页面组件。

---

## 16. AI 模型并不是越强越好

不同 Task 使用不同模型。

目前更倾向于按照“不确定性”而不是“代码量”来选择模型。

例如：

```text
简单 UI
简单测试
文档
小修改
    ↓
低成本模型

DICOM 解析
复杂数据处理
架构设计
第三方库研究
    ↓
更强模型
```

因为一个 500 行但非常明确的 UI Task，可能比一个 100 行但涉及未知第三方库的任务更容易。

所以模型选择主要看：

> **这个任务有多大的不确定性。**

---

## 17. 这套流程目前形成的基本协作方式

综合下来，目前比较稳定的流程是：

```text
                    Human
                      │
              产品方向 / 最终决定
                      │
                      ↓
                   Codex
            需求分析 / 方案 / Task
                      │
             ┌────────┴────────┐
             ↓                 ↓
          UI/UX             Spike
             │                 │
             └────────┬────────┘
                      ↓
                   DESIGN
                      │
                      ↓
                    Task
                      │
                      ↓
                   Branch
                      │
                      ↓
                   Devin
                 Builder
                      │
                    Commit
                      │
                      ↓
                     PR
                      │
                      ↓
                  OpenCode
                  Reviewer
                      │
                 PASS / CHANGES
                      │
                      ↓
                    Human
                      │
                    Merge
                      │
                      ↓
                    main
```

并不是所有任务都会经过全部步骤。

例如一个小的样式修改可以直接：

```text
Task → Devin → PR → Review → Merge
```

而一个涉及新技术、架构变化的功能可能是：

```text
CR
 ↓
Spike
 ↓
Human 决策
 ↓
Tasks
 ↓
多个 PR
 ↓
Review
 ↓
Merge
```

---

## 18. 目前的项目数据

截至当前版本：

- 15 个 CR 里程碑
- 60+ 个 PR
- 自动化测试 456 例
- 测试分布在 44 个文件中
- 批量导入等容易出问题的场景使用场景矩阵测试
- PR、Reviewer 和 CI 均参与代码合并前的检查

这些数据并不是为了证明“AI 自动完成了多少代码”，而是为了观察：

> 在使用大量 AI 的情况下，项目是否仍然可以保持可测试、可追踪和可维护。

---

## 19. 目前我对 AI Coding 的理解

这个项目让我比较明显地感受到，AI Coding 真正困难的地方并不只是：

> “AI 会不会写代码。”

更重要的是：

> **如何让 AI 在一个不断变化的项目里做正确的事情。**

因此目前我更关注几个问题：

1. 需求是不是足够明确？
2. Task 有没有拆到合适的粒度？
3. Agent 有没有拿到正确的上下文？
4. Agent 有没有权限修改它不应该修改的东西？
5. 实现者和检查者是不是相互独立？
6. 一个错误决定能不能尽早暴露？
7. 出问题以后能不能找到原因？
8. AI 消耗的 token 和时间是否值得？

这也是为什么这个项目最后形成了现在的：

```text
Human
  ↓
Product / Requirement
  ↓
Planning
  ↓
Task
  ↓
Implementation
  ↓
Review
  ↓
Merge
```

我并不认为这是一套固定的“标准流程”。

它更像是我在实际使用 AI Coding 的过程中，根据遇到的问题逐步调整出来的一套开发方式。

后续如果项目规模继续增加，我更希望继续减少不必要的流程，而不是不断增加新的 Agent 和文档。

---

## 20. 相关目录

主要相关文件：

```text
.ai/
├── CURRENT/              # 当前确认的产品、需求、架构和设计
├── CHANGES/              # CR 及需求变更记录
├── AGENTS/               # 不同 Agent 的职责和工作方式
├── SPIKES/               # 高不确定性技术问题的验证
└── TODO.md               # 暂不影响当前任务的技术债

.opencode/
└── agent/                # OpenCode Agent 配置
```

代码本身的历史则通过 Git：

```text
main
 ↓
feature branch
 ↓
commit
 ↓
PR
 ↓
review
 ↓
merge
```

这样需求为什么变化、代码什么时候变化，以及最终是谁决定合并，分别都有对应的记录。

以上为我和ai沟通中提炼的思考过程；展示**遇到了什么工程问题，以及是怎么解决这些问题的**。

