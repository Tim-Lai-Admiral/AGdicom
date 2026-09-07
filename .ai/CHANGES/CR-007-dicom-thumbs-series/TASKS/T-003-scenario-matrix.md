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

- [ ] Unit/Integration: 矩阵用例
- [ ] Manual: 清单

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查