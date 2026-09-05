# Task T-010: 测试与文档收尾

## Metadata

```yaml
id: T-010
cr: CR-002
type: docs
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 20
depends_on: [T-008, T-009]
branch: feature/CR-002-T-010-finish
```

## Context pack

- Requirement: R-008（CR-001 REQUIREMENTS.md）；流程 P-001~P-003（CR-002）
- 关键文件：`README.md`（补全定位/功能/技术栈/安装/启动/已知问题）、`E2E-CHECKLIST.md`（新建或 README 章节）、`src/features/viewer/dicom/__fixtures__/buildDicomFile.ts` 与 `DicomViewer.tsx`（Minor 修复点）
- 附带处理（已登记）：
  - T-005 审查 Minor：① buildDicomFile NumberOfFrames tag 顺序（0028,0008 应在 0028,0002 之后按 tag 升序）② JPEG2000 UID 文案精确化 ③ DicomViewer dialog 焦点圈定/关闭后焦点还原
  - TD-002：Model3DViewer 改 `React.lazy` + dynamic import（three.js 主包 ~807KB 代码分割）
- 禁止：不改 `.opencode/`、`ENVIRONMENT.md`；不新增业务功能

## Objective

补齐测试与交付文档：README.md 完整（定位/功能/技术栈/安装/启动/素材来源/已知问题）、E2E 清单执行、T-005 Minor 项与 TD-002 修复、全量验证。

## Scope

- README.md 完成（含 T-009 素材章节整合）
- `E2E-CHECKLIST.md`：导入→浏览→DICOM→3D→标注→评审→导出→AI 建议 全链路清单（执行并勾选）
- T-005 Minor 项与 TD-002 修复（改动限上述文件）
- 测试补齐与 `scripts\verify.ps1` 全量验证

## Out of scope

- 新业务功能；TD-001（IndexedDB）等未分配技术债。

## Acceptance criteria

- [ ] `scripts\verify.ps1` 全绿；`npm run build` 通过
- [ ] E2E 清单逐项执行完成（含核心流程离线可用）
- [ ] README 与实现一致，已知问题如实记录
- [ ] Minor 项与 TD-002 修复完成且有测试覆盖（lazy 加载不回归）

## Test requirements

- [ ] Unit/Integration: `scripts\verify.ps1`
- [ ] Manual/E2E: 清单逐项勾选

## Definition of done

- [ ] 验收通过；填 Builder result；Reviewer 终审