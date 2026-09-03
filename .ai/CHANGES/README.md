# Change Requests

每个 L2+ 变更使用一个独立目录：`CR-001-short-title/`。目录内文档记录相对于 `CURRENT` 的 delta；不要复制整份当前架构。

```text
CR-001-short-title/
├── CHANGE.md
├── REQUIREMENTS.md
├── ARCHITECTURE.md          # 仅当存在架构影响
├── DESIGN.md                # 仅当存在设计影响
├── REVISION-001.md          # 仅当改变 CR 根本方案
├── TASKS/
│   └── T-001-short-title.md
└── REVIEW.md
```

`INBOX/` 用于不需要完整 CR 的 L0/L1 独立 Task。在其获准并完成后，可归档或关联到后续 CR。
