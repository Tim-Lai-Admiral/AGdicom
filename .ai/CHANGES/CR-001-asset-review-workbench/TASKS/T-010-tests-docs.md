# Task T-010: 测试与文档收尾

## Metadata

```yaml
id: T-010
cr: CR-001
type: docs
status: planned
owner: Builder
reviewer: Reviewer
priority: medium
depends_on: [T-004, T-005, T-006, T-007, T-008, T-009]
branch: feature/CR-001-T-010-finish
```

## Objective

补齐测试与交付文档：vitest 全量单测跑通、手动 E2E 清单执行、`README.md` 完成（定位/功能/技术栈/安装/启动/素材来源/已知问题）、已知问题登记。

## Context and inputs

- Requirement(s): R-008, R-009
- Current architecture/design references: CR-001 全部文档
- Dependency output: T-004~T-009 完成的功能与素材

## Scope

Allowed changes:

- 测试：补齐 T-002~T-008 单测缺口，`npm test` 全绿。
- `E2E-CHECKLIST.md`（或 README 章节）：手动验证清单（导入→浏览→DICOM→3D→标注→评审→导出→AI 建议）。
- `README.md`：产品定位、核心功能、技术栈、安装方式、启动命令、DICOM 素材来源与使用方式、已知问题。
- `.ai/TODO.md`：登记非阻塞技术债。

## Out of scope

- 新增业务功能。
- 修复阻塞性 bug 之外的问题（登记 TODO 即可）。

## Expected behavior

1. `npm test` 全部通过；`npm run build` 无类型错误。
2. 按 E2E 清单手工验证核心流程全部可用（含离线/无 API Key）。
3. README 按题目要求完整可交付。

## Acceptance criteria

### Functional

- [ ] `npm test` 全绿。
- [ ] `npm run build` 通过。
- [ ] 核心流程离线可用（R-009）。

### Error handling and compatibility

- [ ] README 已知问题章节如实记录限制（压缩 DICOM 仅元数据、localStorage 容量、大 STL 内存等）。

### UI (if applicable)

- 不涉及。

## Technical constraints

- README 与实现一致，不虚构功能。

## Implementation notes

- README 章节：项目定位 / 核心功能 / 技术栈 / 安装与启动 / 素材来源与使用（STL + DICOM + TCIA 指引）/ 已知问题。
- E2E 清单可执行后勾选并附结果。

## Test requirements

- [ ] Unit: `npm test` 全绿。
- [ ] Manual/E2E: 清单逐项勾选完成。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] README.md / AI_USAGE.md / E2E 清单齐全且与实现一致。
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

## Reviewer result

> Reviewer fills this using the Review template.