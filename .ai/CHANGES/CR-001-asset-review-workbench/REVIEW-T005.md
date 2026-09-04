# Review: T-005

## Metadata

```yaml
task: T-005
cr: CR-001
reviewer: Reviewer
target_commit_or_pr: 407c7e7 (feat: dicom metadata parsing and slice preview) on feature/CR-001-T-005-dicom
date: 2026-09-04
result: PASS
```

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | parseDicom/decodePixel/seriesUtils/DicomViewer + fixture 完整实现 DICOM 元数据、series 分组、去标识化检测与单切片灰度预览 |
| Acceptance criteria | pass | R-003 全部命中：≥2 切片 series 聚合（3 张/本序列）、去标识化标记、无压缩预览、损坏/压缩降级不崩溃、异步解析、切片序号指示 |
| No out-of-scope changes | pass | 无 3D / 评审面板 / AI 内容；改动限定在 dicom 模块 + App/AssetGrid/types/io 接线 + 样式；io.ts 校验扩展为 DicomMeta 契约的必然配套，属 T-005 边界内 |
| CURRENT/architecture respected | pass | 遵循 ARCHITECTURE.md 的 `features/viewer/dicom/` 分层、dicom-parser 依赖与“压缩/损坏降级为仅元数据”契约；DicomMeta 扩展均为可选字段，向后兼容 T-002 契约 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| Required unit tests | pass | `scripts\verify.ps1` 复跑：167/167 tests passed（16 文件），含 parseDicom(14)/decodePixel(17)/seriesUtils(7)/DicomViewer(9) |
| Required integration/E2E/manual checks | pass | App.test.tsx 覆盖“点击 dicom 卡片→解析→回写持久化”与“损坏文件降级”两条端到端链路；真实样本依赖 T-009（已作为已知 follow-up 记录） |
| Regression risk checks | pass | `tsc -b` 无错误 + `vite build` 通过（verify OK） |

## Findings

### Blocker

- None

### Major

- None

### Minor / non-blocking

- `buildDicomFile.ts:231` — `NumberOfFrames (0028,0008)` 被写入在 `0028,0103` 之后、`0028,1052` 之前，违反 DICOM Part 5 数据元素 tag 升序要求。因 dicom-parser 顺序宽容故测试通过，仅测试 fixture，不影响产品；建议后续挪到 `0028,0002` 之前以保持 fixture 严格合规。
- `DicomViewer.tsx:63` — `uid.startsWith('1.2.840.10008.1.2.4')` 会把 JPEG2000（`.1.2.4.90/.91`）也标为 “JPEG 压缩（仅元数据）”。降级行为正确（仍走“仅元数据”），仅文案不精确；非阻塞。
- `DicomViewer.tsx` — dialog 实现了 Esc 关闭 + 打开聚焦关闭按钮，但未做焦点圈定（focus trap）与关闭后焦点还原，属无障碍改进项，不影响验收标准。
- 分支含协调者配置/文档提交（`c4cd5d1` config、`1292bd7` docs+config）混入 feature 分支；均为 `.opencode/`、`ENVIRONMENT.md`、`scripts/verify.ps1` 等协调产物，无产品代码影响，不阻塞。

## Recommendation

PASS。实现质量高、契约一致、降级路径完备、测试充分（含外部执行者代码的 min-max 归一化 / MONOCHROME1 反转 / partial 抢救 / 恒定图像 128 等关键分支均有覆盖）。上述 Minor 项建议在后续任务（如 T-010 收尾）顺手修正，不影响本任务合并。
