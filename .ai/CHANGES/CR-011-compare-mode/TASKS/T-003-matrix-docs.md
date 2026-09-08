# Task T-003: 测试适配 + 矩阵更新 + 文档

## Metadata

```yaml
id: T-003
cr: CR-011
type: test
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 12
depends_on: [T-002]
branch: feature/CR-011-T-003-matrix-docs
```

## Context pack

- Requirement: R-002 实现细化 + R-020（矩阵）；关键文件：`src/App.test.tsx`、`src/App.workbench.test.tsx`、`src/App.scenarioMatrix.test.tsx`（比较相关用例语义改显式模式）、`src/features/library/AssetGrid.test.tsx`（行 aria-label 模式化）、`E2E-CHECKLIST.md`、`README.md`
- 禁止：产品行为改动（纯测试/文档）

## Objective

比较显式模式的测试语义全面适配（P-005：语义适配说明）；矩阵补充比较模式场景；E2E/README 同步。

## Scope

- 存量测试适配：原"点击图片=选中/比较"用例 → 显式模式（进入比较模式→选择→比较；普通模式点击=查看）
- 矩阵：新增比较模式场景（进入模式筛选断言、选择满2比较、退出恢复）
- E2E-CHECKLIST：比较相关人工项更新
- README：功能说明更新（比较显式模式、汉字按钮）
- `scripts\verify.ps1` 全绿

## Out of scope

- 行为改动

## Acceptance criteria

- [ ] 存量/矩阵全绿；新断言存在（比较模式筛选/退出）
- [ ] E2E/README 与实现一致

## Test requirements

- [ ] Unit/Integration: verify.ps1
- [ ] Manual: 清单

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- 实现摘要（纯测试/文档，无产品行为改动）：
  - `src/App.scenarioMatrix.test.tsx`：新增 describe「场景矩阵——比较显式模式（CR-011 T-003 / R-002）」，混合素材（2 image + 1 DICOM + 1 STL）App 级集成一条：普通模式基准（DICOM 行/STL 行/患者分组面板可见）→ 顶栏「比较」进入模式（提示条 + 仅剩 image 行断言、非 image 行与 `.dicom-panel` 隐藏）→ 显式选择第一张（仅计数 1/2，不进比较）→ 选满两张自动比较（`.compare-pane__name` DOM 顺序断言先选在左）→「退出比较」清空选择并恢复完整列表/分组面板/普通模式行点击查看语义/顶栏回「比较」。文件头注释同步登记该场景覆盖口径。
  - `E2E-CHECKLIST.md`：全链路头加入「比较」；§2 增补 4 条自动化已验证项（进入模式筛选、满 2 自动比较、退出恢复、无 image 时入口禁用，标注 CR-011 T-003 依据）；新增 §12「图片比较走查 · 人工清单（CR-011 / R-002）」4 条人工项（汉字按钮文字态/禁用说明、提示条与选中标记、双图并排与窗格独立变换、退出三路径恢复）。
  - `README.md`：工作台布局条注明「导入」「比较」为汉字文字按钮（CR-011）；「图片预览与比较」条由旧「勾选两张并排比较」改写为显式模式语义（普通模式行点击=中央查看；比较模式先筛选可比较图片再显式选择，满 2 自动比较；退出恢复）。
  - 存量比较用例（App.test / App.workbench / AssetGrid.test 行 aria-label 模式化）已由 T-002 适配（P-005 语义适配说明见 T-002 卡），本任务未改动。
- 文件清单：`src/App.scenarioMatrix.test.tsx`、`E2E-CHECKLIST.md`、`README.md`。
- 验证结果：`scripts\verify.ps1` 全绿（38 个测试文件 / 386 用例通过 + tsc -b + vite build OK；其中矩阵文件 11 例含新增 1 例）。
- commit：9c8b671（分支 feature/CR-011-T-003-matrix-docs，含 T-001/T-002 提交，按序合并 #48 → #49 → 本 PR）。
- 已知限制：E2E-CHECKLIST §10 导语中「合成 fixture，7 例全绿」计数在更早 CR 已过时（当前矩阵不止 7 例），非本任务比较口径范围，未顺手修改（可记 TODO）。
- 需 Reviewer 关注点：① 矩阵新场景断言 `.dicom-panel` 在比较模式隐藏/退出恢复（T-002 语义：比较模式 DICOM 分组面板随列表筛选一并隐藏）；② 比较视图左右顺序经 `.compare-pane__name` DOM 顺序断言（先选在左，R-002）；③ E2E §12 人工项与 §2 自动化项的验证方式标注是否与实际测试名一致。