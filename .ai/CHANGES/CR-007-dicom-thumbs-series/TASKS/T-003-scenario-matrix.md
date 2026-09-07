# Task T-003: 场景矩阵测试与规范落地

## Metadata

```yaml
id: T-003
cr: CR-007
type: test
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 15
depends_on: [T-002]
branch: feature/CR-007-T-003-scenario-matrix
```

## Context pack

- Requirement: R-020（流程：批量导入任务必须含场景矩阵测试）
- 关键文件：`src/App.test.tsx`/`App.workbench.test.tsx`（集成测试扩展）、`src/features/viewer/dicom/seriesUtils.test.ts`、`.ai/TEMPLATES/TASK.md`（Test requirements 规范：加"场景矩阵"提示行）
- 场景矩阵（导入组合 → 左栏层级断言）：① 同系列 10 文件（同 UID 不同 InstanceNumber）→ 1 组 1 系列 10 切片；② 跨系列 10 文件（不同 UID）→ 1 组 10 系列（各自切片正确）；③ 同患者无 UID 10 文件 → 1 组 1 未知系列 10 切片（T-001 断言）；④ 混合患者 → 多组按 R-012 排序；⑤ 空批次/失败文件 → 不崩溃
- 禁止：改产品行为（纯测试与文档）

## Objective

落地场景矩阵集成测试 + 浏览器手动清单；把"批量导入场景矩阵"要求固化进任务卡模板。

## Scope

- 集成测试：导入矩阵（fixture 用 buildDicomFile 构造：同 UID 多 InstanceNumber / 不同 UID / 无 UID / 不同患者），断言左栏患者组/系列/切片数与解析范围（T-001）+ 缩略图占位→像素（T-002）
- `E2E-CHECKLIST.md` 或 README 章节：批量导入手动清单（真实文件组合核对）
- `.ai/TEMPLATES/TASK.md`：Test requirements 增加"场景矩阵（若涉及批量导入/多文件数据流）"提示行
- `scripts\verify.ps1` 全绿

## Out of scope

- 产品行为改动；性能基准

## Acceptance criteria

- [ ] 矩阵 ①~⑤ 集成测试通过（含解析范围与缩略图断言）
- [ ] 手动清单可执行（写入文档）
- [ ] 模板含场景矩阵提示（grep 可检索）
- [ ] 存量全绿

## Test requirements

- [x] Unit/Integration: 矩阵用例（`src/App.scenarioMatrix.test.tsx`：①~⑤ 共 6 例，全绿）
- [x] Manual: 清单（`E2E-CHECKLIST.md` §10 批量导入场景矩阵，待人工执行）

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- 实现摘要：
  - `src/App.scenarioMatrix.test.tsx`（新增，6 例）：批量导入场景矩阵 App 级集成测试——真实导入管线（drop → useImport → objectUrl → 查看/解析 → 元数据回写 → 患者分组）下按任务卡矩阵逐场景断言：① 同系列 10 文件 → 1 组 1 系列 10 切片（#1..#10 按 InstanceNumber 升序）+ 缩略图占位 SVG/图标 → 真实像素切换（mock 挂起/放行）+ 聚合切片数回写持久化；② 跨系列 10 UID → 1 组 10 系列（UID 码点升序、各 1 张、各自切片正确），关闭后再打开另一系列仅 fetch 该系列 1 文件（R-018 收敛）；③ 同患者无 UID 10 文件 → 1 组 1「未知系列（10 个文件）」· 10 切片；④ 混合患者（2 名患者 + 混合 UID + 去标识化）→ 组间隔离计数、组内已知系列在前未知系列在后、持久化元数据经产品同一 `groupDicomByPatient` 断言 R-012 组间排序（ADAMS^J < BROWN^ANN，未知患者末尾）、跨患者解析隔离（二开乙仅 fetch 乙系列 2 文件）；⑤ 空批次无副作用 + 损坏文件混入 → 降级提示不崩溃、分组/持久化只含可解析切片、缩略图降级保持占位。
  - 解析范围断言口径：stub `URL.createObjectURL`（File 名 → 稳定 blob URL 映射）+ mock fetch 按 URL 供 fixture 字节，`fetch.mock.calls` 还原为文件名集合后排序比较（不耦合解析顺序）；sliceThumb 模块 mock（T-002 同款）隔离缩略图请求，使 fetch 调用集合恰为 DicomViewer 解析范围，同时由可控 mock 驱动占位↔像素切换（jsdom 无 canvas）。
  - `.ai/TEMPLATES/TASK.md`：Test requirements 新增「Scenario matrix（场景矩阵，R-020）」提示行（可 grep 检索）。
  - `E2E-CHECKLIST.md`：新增 §10「批量导入场景矩阵 · 手动清单」（真实文件组合人工核对 6 条，标注人工项）。
- 文件清单：`src/App.scenarioMatrix.test.tsx`（新）/ `.ai/TEMPLATES/TASK.md` / `E2E-CHECKLIST.md` / 本任务卡（Builder result）。无产品代码改动（纯测试与文档）。
- 验证结果：`scripts/verify.ps1` 全绿（36 文件 / 339 用例通过、tsc 构建通过）；矩阵文件单独复跑 3 次稳定通过（时序竞态已用 waitFor 收敛）。
- commit：见 PR（feat: 场景矩阵集成测试（R-020）：批量导入 ①~⑤ + 手动清单 + 任务卡模板规范）
- PR：填于合并请求（分支基于 T-002，含 T-001/T-002 提交，按序合并 #33 → #34 → 本 PR）
- 已知限制 / 需 Reviewer 关注：
  - 首次打开（全部文件尚无元数据）解析范围为全批文件——这是 DicomViewer「打开即解析未归类文件」的既有行为（T-001 引入的收敛语义），矩阵用例将其作为基线断言并在注释中说明；真正的 R-018 收敛断言在「关闭后二次打开另一系列」场景（②④）。
  - 组间患者排序的 UI 一次只展示当前素材所属组，故 R-012 组间排序经持久化元数据 + 产品同一 `groupDicomByPatient` 在真实导入数据上断言（④），纯函数排序另有 seriesUtils 单测覆盖。
  - 缩略图像素切换以 sliceThumb 模块 mock 驱动（jsdom 无 canvas，真实生成路径由 sliceThumb.test.ts 覆盖），不属产品行为改动。