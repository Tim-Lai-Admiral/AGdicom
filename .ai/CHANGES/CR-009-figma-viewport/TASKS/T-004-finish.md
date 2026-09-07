# Task T-004: 矩阵与走查收尾

## Metadata

```yaml
id: T-004
cr: CR-009
type: test
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 12
depends_on: [T-003]
branch: feature/CR-009-T-004-finish
```

## Context pack

- Requirement: R-023~R-026 验收收口 + R-020（矩阵）
- 关键文件：`src/App.scenarioMatrix.test.tsx`（视口/工具/元数据断言适配）、`E2E-CHECKLIST.md`（新增视口/工具/抽屉人工项）、`README.md`（已知问题/功能说明更新）、`.ai/CURRENT/`（合并后更新）
- 禁止：行为改动（纯测试/文档）

## Objective

场景矩阵与文档按 R-023~R-026 更新：元数据唯一来源断言、工具/滚轮同步用例、抽屉动画、E2E 人工清单；全量回归。

## Scope

- 矩阵适配/新增：中央无元数据表格 + 右栏唯一（grep 断言）；滚轮↔滑条同步（矩阵内一条）；工具切换冒烟
- E2E-CHECKLIST：新增 §11 视口/工具/抽屉人工项（4~6 条）
- README 已知问题/功能说明同步
- `scripts\verify.ps1` 全绿

## Out of scope

- 行为改动

## Acceptance criteria

- [ ] 矩阵/存量全绿；新断言存在
- [ ] E2E 人工清单可执行；README 一致

## Test requirements

- [ ] Unit/Integration: verify
- [ ] Manual: 清单

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **分支**：`feature/CR-009-T-004-finish`（含 T-001~T-003 提交，PR 按序合并 #41→#42→#43→本 PR）
- **实现摘要**（纯测试 / 文档，无行为改动）：
  - 场景矩阵新增「视口收尾」describe（`src/App.scenarioMatrix.test.tsx`，App 级集成 3 例）：
    ① R-023 元数据唯一来源 grep 断言——中央 dialog 无 `<table>` / `.meta-panel` / 元数据行
    标签，`.meta-panel` 全文档唯一且位于右栏「信息面板」，`SeriesInstanceUID` 等行标签仅右栏
    出现；② R-025 滚轮 ↔ 底部滑条双向同步（滚轮切片 → 滑条值与「切片 N / M」与四角 Inst
    跟随、首末片边界钳制、滑条 → Inst 反向连续性）；③ R-024 顶栏工具组切换冒烟——5 个工具
    按钮 aria-pressed 与查看器 `data-tool` 跟随、测量 Mock 提示与清空入口随工具显隐（清空
    无测量时禁用）。工具行为细节沿用组件测试（TopToolbar 4 例 / DicomViewer 工具 5 例），
    不重复。
  - E2E-CHECKLIST：新增 §11「视口与交互走查 · 人工清单」（5 条：四角覆盖层 / 工具拖拽手感 /
    图片工具与禁用态 / 滚轮↔滑条 / 左右抽屉动画）；§3 两条失真项随 R-023/R-025 适配
    （「元数据表格」→「四角覆盖层 + 右栏唯一元数据源」、「下拉/上一张/下一张」→「滑条 +
    滚轮 + 左栏缩略图」）。
  - README：功能一览重写 DICOM 查看器（四角元数据 / 右栏唯一来源 / 工具组 / 滚轮同步）与
    新增视口工具组、图片预览条目；已知问题 #1「仍可查看表格」→「右栏元数据面板」、#8 走查
    遗留同步（TD-004/TD-005 已随 CR-009 T-001 解决，新增 rotate 测量失真 TD-008）。
  - `.ai/TODO.md`：TD-004 / TD-005 置 closed（CR-009 T-001，R-023 / R-025；TD-004 注明
    CompareView 未接入）；登记 TD-008（rotate ≠ 0 时测量落点换算失真，T-002 Builder 报告遗留）。
- **文件清单**：`src/App.scenarioMatrix.test.tsx`、`E2E-CHECKLIST.md`、`README.md`、`.ai/TODO.md`
- **验证结果**：`scripts\verify.ps1` 全绿（38 个测试文件 / 374 用例通过，tsc + vite build
  通过）；矩阵文件定向先行（7 存量 + 3 新增全绿）。stderr 中 IndexedDB 不可用告警为 jsdom
  既有降级路径，非新增。
- **commit**：`949462d`（test/docs）/ `16ecd1c`（docs）；PR：https://github.com/Tim-Lai-Admiral/AGdicom/pull/44（base master，按序合并 #41→#42→#43→#44）
- **已知限制 / 需 Reviewer 关注**：
  - §3 两条勾选项的文字已适配 CR-009 后的现实（自动化引用同步到现存用例名），请 Reviewer
    确认口径无遗漏。
  - TD-004/TD-005 关闭、TD-008 登记属事实性登记（T-002 已建议），未引入代码改动。
  - §11 人工清单 5 条留待浏览器人工复核（拖拽手感 / 视觉 / 动画，jsdom 不可覆盖）。