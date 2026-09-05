# AI 协作项目脚手架（scaffold/）

给新项目使用的纯净版协作工程模板。源自 AGdicom 项目实战沉淀（CR-001~CR-003），已去除全部项目特定内容。

## 包含内容

```text
scaffold/
├── .ai/                        # 协作协议与文档体系
│   ├── AGENTS.md               # 全体 Agent 共同协议（含 Git 15 条规则 §6）
│   ├── README.md               # .ai 目录说明
│   ├── CURRENT/                # 事实源模板（PRODUCT/REQUIREMENTS/ARCHITECTURE/DESIGN）
│   │                           # REQUIREMENTS 已含基线流程规则 P-001~P-004
│   ├── CHANGES/                # CR 历史（README + 空 INBOX）
│   ├── AGENTS/                 # 角色操作规范（BUILDER/CODEX/REVIEWER/UI_UX）
│   ├── TEMPLATES/              # CR/ TASK / REVIEW / ADR 模板
│   └── TODO.md                 # 技术债登记
├── .opencode/agent/            # opencode 子 agent 配置
│   ├── planner.md              # 规划角色（edit 仅限 .ai/**）
│   ├── builder.md              # 复杂任务（模型自选；软步数+检查点）
│   ├── builder-flash.md        # 简单任务（便宜模型）
│   └── reviewer.md             # 审查（审 PR，edit deny）
├── ENVIRONMENT.md              # 环境事实模板（替换 <<占位符>>）
├── .gitignore / .gitattributes # 通用忽略与行尾规范
├── scripts/verify.ps1          # 统一验证（test + build）
└── .github/workflows/ci.yml    # CI（lint + test + build）
```

## 使用步骤

1. 把 `scaffold/` 下全部文件复制到新项目根目录（不要带 `scaffold/` 这层）。
2. 编辑 `ENVIRONMENT.md`：替换 `<<占位符>>`（OS/Node 版本/技术栈/项目名）。
3. 按需调整 `.opencode/agent/*.md` 的模型（`model:` 字段）与步数预算。
4. 创建 git 仓库并推送远端；配置 GitHub（gh 登录、分支保护可选）。
5. 阅读 `.ai/AGENTS.md` 与 `.ai/README.md`，按流程启动：Human 意图 → Planner 提案 → CR → Task → Builder → Reviewer → Human Merge。

## 流程要点（默认启用）

- 变更分级 L0~L4；L2+ 建 CR，L3/L4 需 Human 批准。
- 任务卡规范（P-001）：Context pack 段 + Metadata.expected_steps。
- 派发 prompt 极简（P-002）：任务ID + 分支 + 卡片外增量事实，其余指向卡片与 ENVIRONMENT。
- 信息不足 BLOCKED-信息不足 上报（P-003），不猜测。
- Git 15 条规则（P-004）：分支/PR/CI/Reviewer 审 PR/Human 合并/删分支/Tag。
- 软步数监控：超过预期步数自评健康（5 问），达硬阈值写 `T-XXX-CHECKPOINT.md` 交接新会话。
- 高不确定性任务先规划 Spike，但 Spike 需先向 Human 汇报方向获批。

## 来源

AGdicom（AI 图片、DICOM 与 3D 素材评审工作台）实战沉淀，2026-09-05 提取。