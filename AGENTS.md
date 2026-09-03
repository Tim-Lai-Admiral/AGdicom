# Agent Entry Point

All agents working in this repository must read and follow the collaboration
protocol in [`.ai/AGENTS.md`](.ai/AGENTS.md) before planning, coding, reviewing,
or merging a change.

Use the smallest relevant context:

- Builders: assigned task, its parent CR, and only the relevant `CURRENT` files.
- Reviewers: assigned task, parent CR, relevant `CURRENT` files, and the Git diff.
- Planners: `CURRENT`, active CRs, and `TODO.md`.

The documents under `.ai/CURRENT/` and approved records under `.ai/CHANGES/`
are the project documentation source of truth. Unmerged branch work is not.
