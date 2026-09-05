# Task T-005: 走查与文档收尾

## Metadata

```yaml
id: T-005
cr: CR-003
type: docs
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 15
depends_on: [T-004]
branch: feature/CR-003-T-005-walkthrough
```

## Context pack

- Requirement: UI-001/UI-002/R-010 验收收口；参考素材 `rec/`（对照走查）
- 关键文件：`.ai/CHANGES/CR-003-ui-redesign/DESIGN.md`（规范）、`README.md`（已知问题）、`.ai/CURRENT/DESIGN.md`（合并后更新）
- 禁止：功能改动（仅走查与文档）；UI/UX Agent 不启用（Human 决定，走查由协调者/Reviewer 执行）

## Objective

对照 Figma 参考走查实现符合性（布局/主题/交互），浏览器手动验证核心链路，更新文档（DESIGN/CURRENT/README/CHANGE.md Result）。

## Scope

- 走查清单：四区布局、深色主题一致性、W/L 与测量交互、三类素材链路、窄屏折叠、离线字体
- 浏览器手动验证（`npm run dev`），发现问题登记（阻塞→修，非阻塞→README 已知问题/TODO）
- 文档：CR-003 DESIGN.md 校对、CURRENT/DESIGN.md 更新（合并后由协调者）、README 已知问题、CHANGE.md Result

## Out of scope

- 新功能；UI/UX Agent；视觉逐像素复刻

## Acceptance criteria

- [ ] 走查清单逐项执行并有结论记录（走查记录随 PR 提交）
- [ ] 发现项均有处置（修复或登记）
- [ ] 文档与实现一致

## Test requirements

- [ ] Manual: 浏览器全链路走查（含 4 个 STL、合成 DICOM、图片导入）

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查