# Task T-003: 场景矩阵与手动清单更新

## Metadata

```yaml
id: T-003
cr: CR-008
type: test
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 10
depends_on: [T-002]
branch: feature/CR-008-T-003-matrix-update
```

## Context pack

- Requirement: R-020（场景矩阵）+ R-021/R-022 断言
- 关键文件：`src/App.scenarioMatrix.test.tsx`（矩阵断言适配：左栏层级断言改为"独立面板"口径；新增"点击切片面板不搬家"与"滑动条高亮跟随"用例）、`E2E-CHECKLIST.md`（§10 更新人工项）
- 禁止：产品行为改动（纯测试/文档）

## Objective

场景矩阵与手动清单按 R-021/R-022 更新：面板结构断言 + 高亮联动断言。

## Scope

- 矩阵用例更新：左栏"分组面板"层级断言（替代逐行展开口径）；新增：点击分组切片后面板位置不变（渲染位置断言）、滑动条切换 → 高亮跟随（mock 或事件驱动）
- E2E-CHECKLIST §10：面板交互与高亮人工项更新
- `scripts\verify.ps1` 全绿

## Out of scope

- 行为改动

## Acceptance criteria

- [ ] 矩阵相关用例全绿；新增两项断言存在
- [ ] 手动清单可执行

## Test requirements

- [ ] Unit/Integration: 矩阵
- [ ] Manual: 清单

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **实现摘要**：场景矩阵按 R-021/R-022 更新完成。矩阵文件在 T-001/T-002 增量（组头/系列行独立面板断言口径）基础上，新增 1 条同场景用例「面板交互与高亮联动」：点击分组面板切片 → 中央切换、高亮跟随、面板不搬家（R-021：`.dicom-panel` 在左栏直接子节点中的下标不变 + 组头集合/系列行/组头与系列行 `aria-expanded` 展开状态/切片缩略图集合不变）；滑动条切换 → 高亮实时跟随（R-022 同场景断言；滑动条/点击/关闭完整三路径已由 `App.workbench.test.tsx` 集成用例覆盖，按 P-005 不重复三份）。E2E-CHECKLIST §10 更新：标题标注 CR-008 增补，自动化矩阵计数 6→7 例，新增「面板交互（R-021）」「高亮联动（R-022）」两条人工项（含素材行无展开控件、折叠交互、关闭清理）。
- **文件清单**：`src/App.scenarioMatrix.test.tsx`（头注释 + 新 describe「面板交互与高亮联动」1 用例）、`E2E-CHECKLIST.md`（§10 标题/计数/两条人工项）、本任务卡（Builder result）
- **验证结果**：`scripts\verify.ps1` 全绿（36 文件 / 346 tests passed + build 通过；基线 345 + 1）
- **Commit / PR**：见下方 commit hash 与 PR 链接（base master；**按序合并：#37（T-001）→ #38（T-002）→ 本 PR**）
- **已知限制 / 技术债**：T-002 卡已登记的已知边界（滑动条切走后点击"当前已打开素材"的面板缩略图不触发查看器重挂载，中央停留原切片）不在本任务范围，未改动；本用例通过点击非当前素材的切片规避该边界，不影响断言有效性。
- **需 Reviewer 关注**：① "面板不搬家"断言口径（渲染位置下标 + 组头/系列/展开状态/缩略图快照）是否充分覆盖 R-021 语义；② 矩阵仅补 1 条同场景断言而非复制三路径，是否符合 P-005 精简预期；③ §10 两条人工项是否可执行、口径与 R-021/R-022 验收一致。