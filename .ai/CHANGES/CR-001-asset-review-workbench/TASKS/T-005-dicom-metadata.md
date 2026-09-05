# Task T-005: DICOM 识别与元数据

## Metadata

```yaml
id: T-005
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-003]
branch: feature/CR-001-T-005-dicom
```

## Objective

用 dicom-parser 解析 DICOM 元数据：series/切片数分组、去标识化标记检测、基础元数据面板；无压缩像素用 Canvas 灰度渲染单切片预览，压缩/损坏优雅降级。

## Context and inputs

- Requirement(s): R-003
- Current architecture/design references: CR-001 ARCHITECTURE.md（DICOM 解析）
- Dependency output: T-003 导入

## Scope

Allowed changes:

- `src/features/viewer/dicom/parseDicom.ts`：dicom-parser 封装，输出 `DicomMeta`（Modality、SOP Class、TransferSyntax、Rows/Columns、PixelSpacing、SeriesInstanceUID、PatientName/ID、切片数按 series 分组、去标识化标记 0012,0062/0063、患者字段空检测）。
- `src/features/viewer/dicom/decodePixel.ts`：无压缩像素解码 + min-max 灰度 → ImageData。
- `src/features/viewer/dicom/DicomViewer.tsx`：元数据面板 + 切片选择 + Canvas 预览；压缩/解析失败显示"仅元数据/无法解析"降级文案。
- `src/features/viewer/dicom/*.test.ts`：单测（用 T-009 合成样本或内置最小 fixture）。
- `src/App.tsx`：点击 dicom 素材打开查看器。

## Out of scope

- 压缩传输语法解码（JPEG 等）——明确降级。
- 完整阅片能力（窗宽窗位交互、MPR）。

## Expected behavior

1. 打开 DICOM 详情显示元数据面板，按 SeriesInstanceUID 显示切片数。
2. 无压缩文件可渲染所选切片灰度预览。
3. 压缩/损坏文件显示降级提示，其余元数据仍展示，应用不崩溃。

## Acceptance criteria

### Functional

- [ ] 合成样本系列正确显示切片数（≥2）与去标识化标记（0012,0062=YES 或患者字段为空）。
- [ ] 无压缩文件切片预览可渲染且内容可辨认（非全黑/全白）。
- [ ] 损坏文件打开不崩溃并显示降级文案。

### Error handling and compatibility

- [ ] 解析异常统一走降级路径。
- [ ] 大 series 的解析在异步中完成，不阻塞界面。

### UI (if applicable)

- [ ] 元数据以可读表格展示；预览区有切片序号指示。

## Technical constraints

- 仅依赖 dicom-parser；像素解码仅支持无压缩（Explicit/Implicit VR Little Endian）。
- 不得在界面出现任何诊断/治疗暗示文案。

## Implementation notes

- 单测 fixture：若 T-009 样本未就绪，可在测试内用 dicom-parser 最小构造或内置小型 base64 fixture。

## Test requirements

- [ ] Unit: 元数据抽取、去标识化检测、像素 min-max 归一化、降级路径。
- [ ] Manual/E2E: 导入合成样本与损坏文件验证。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

- Implementation summary: T-005 实现主体由外部执行者（Codex，GPT-5.6-terra）在独立 worktree 完成并复制进本分支（9 个 DICOM 模块文件 + App/types/io/styles 接线）；协调者修复遗留问题后提交：
  - 修复 4 个 TS 类型错误（TS6 泛型 typed arrays）：`buildDicomFile.ts:197`（sopClassUID null 未防护）、`buildDicomFile.ts:243`（`.buffer` 返回 ArrayBufferLike 需断言）、`decodePixel.ts:62`（ImageData 构造要求 `Uint8ClampedArray<ArrayBuffer>`）、`seriesUtils.ts:59/65`（readonly slices 不可 push/赋值，改为不可变重建）
  - 修复 `DicomViewer.test.tsx:249` 时序竞态：降级文案在 previewPending 时 role='status'，断言改为 waitFor 等待 role='alert'
- Files changed: `src/features/viewer/dicom/`（parseDicom/decodePixel/seriesUtils/DicomViewer + 测试 + `__fixtures__/buildDicomFile.ts` 手工构造 DICOM Part 10 fixture）；`src/App.tsx`、`src/domain/types.ts`（DicomMeta 扩展）、`src/store/io.ts`、`src/features/library/AssetGrid.tsx`、`src/styles.css`
- Tests run and result: `npm test` 167/167 全绿（16 文件）；`npm run build` 通过（tsc -b 无错误）
- Commit / PR: `407c7e7` feat: dicom metadata parsing and slice preview（分支 feature/CR-001-T-005-dicom）
- Known limitations / follow-ups:
  1. fixture 为代码构造的最小 Part 10 文件（buildDicomFile.ts），仅测试使用
  2. 像素解码仅支持无压缩 Little Endian 8/16-bit 单采样灰度（压缩/其他 → 仅元数据降级，符合 R-003）
  3. 真实样本验证依赖 T-009 合成 DICOM（pydicom）
  4. 本任务实现含外部执行者代码，建议 Reviewer 重点审查（规范一致性、可维护性）
- 需 Reviewer 关注: parseDicom 的 partial 抢救逻辑、decodePixel 的 min-max 归一化（恒定图像输出 128）、seriesUtils 分组语义（无 UID 单独成组）、DicomViewer 降级路径与可访问性角色

## Reviewer result

> Reviewer fills this using the Review template.