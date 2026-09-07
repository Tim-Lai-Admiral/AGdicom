# Task T-002: DICOM 真实缩略图

## Metadata

```yaml
id: T-002
cr: CR-007
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 20
depends_on: [T-001]
branch: feature/CR-007-T-002-real-thumbs
```

## Context pack

- Requirement: R-017
- 关键文件：`src/features/viewer/dicom/decodePixel.ts`（decodeDicomFrame 已有，用于生成像素）、`src/features/workbench/DicomSeriesExpansion.tsx`（SliceThumb SVG 占位 → 真实像素）、`src/features/library/AssetGrid.tsx`（RowThumb：dicom 行缩略图）、`src/features/viewer/dicom/parseDicom.ts`（解析触发时机）
- 限制：缩略图 dataURL 会话级；未解析/压缩/解码失败 → 占位不崩溃；解析范围已由 T-001 收敛
- 禁止：持久化缩略图；改导出 JSON；3D 缩略图

## Objective

DICOM 行缩略图与切片缩略图在解析后渲染真实首帧像素（dataURL），未解析保持 SVG 占位。

## Scope

- 缩略图生成工具：`src/features/viewer/dicom/sliceThumb.ts`（fetch objectUrl → parseDicomFile → decodeDicomFrame 首帧 → canvas.toDataURL；失败返回 null；会话级缓存 Map<assetId, dataURL>）
- `DicomSeriesExpansion.tsx`：切片缩略图 = 真实像素（有缓存）否则 SliceThumb 占位；解析后（dicomMeta 存在/打开过）自动生成
- `AssetGrid.tsx`：dicom 行缩略图 = 真实首帧（有缓存）否则 RowGlyph
- 触发：依赖 T-001 的解析范围——打开素材/series 时生成该 series 切片缩略图；行缩略图在该素材解析后生成
- 单测：生成器成功/失败/压缩降级/缓存；组件占位与像素切换
- `scripts\verify.ps1` 全绿

## Out of scope

- 3D 预览；缩略图持久化；超大 series 全量生成（按需懒生成）

## Acceptance criteria

- [ ] 合成样本打开后：行缩略图与切片缩略图为真实像素（可辨认非全黑）
- [ ] 未解析/压缩 → 占位不崩溃
- [ ] dataURL 会话级：刷新后随 blob 恢复重新生成（或占位）
- [ ] 场景矩阵（T-003）中的缩略图断言可用

## Test requirements

- [ ] Unit: 生成器 + 组件
- [ ] Manual: 合成样本缩略图目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- 实现摘要：
  - `sliceThumb.ts`（新增）：缩略图生成器——`fetch(objectUrl)` → `parseDicomFile` → `decodeDicomFrame` 首帧（自动 min-max，与中央预览同口径）→ `canvas.toDataURL('image/png')`；失败（未解析/压缩/解码失败/canvas 不可用）返回 null 不抛错；会话级缓存三层：`thumbCache`（assetId → dataURL，仅成功）、`failedThumbs`（确定性失败标记，会话内不重试）、进行中 Promise 去重（先登记 promise 再启动任务，修复同步完成任务在 finally 中残留 stale promise 的竞态）；无 objectUrl（blob 未水合）为暂态不标记失败，恢复后可重新生成；`resetSliceThumbs` 仅供测试。
  - `DicomSeriesExpansion.tsx`：series 行展开后对其中已解析（dicomMeta 存在）+ 有会话 objectUrl 的切片按需懒生成（effect 键编码 id+objectUrl，blob 水合/变化自动重触发）；会话缓存命中（如素材行已生成）直接复用；渲染真实像素 `<img class="dicom-expand__thumb-img">` 优先，否则保持 SliceThumb 占位。
  - `AssetGrid.tsx`：dicom 行解析后（dicomMeta + objectUrl）自动生成首帧，成功显示 `<img class="asset-row__img">`，否则保持 RowGlyph；image/model 行行为不变。
  - `styles.css`：新增 `.dicom-expand__thumb-img`（与占位 SVG 同铺满 38px 方格）。
- 文件清单：`sliceThumb.ts`（新）/ `DicomSeriesExpansion.tsx` / `AssetGrid.tsx` / `styles.css` + 测试 `sliceThumb.test.ts`（新，6 例）/ `DicomSeriesExpansion.thumbs.test.tsx`（新，5 例）/ `AssetGrid.thumbs.test.tsx`（新，5 例）。
- 验证结果：`scripts/verify.ps1` 全绿（35 文件 / 333 用例通过，存量无回归）；`tsc -b && vite build` 通过；oxlint 0 error（1 条与本改动无关的既有 warning）。
- commit：`0206046`（feat: DICOM 真实缩略图（R-017）：行/切片首帧 dataURL，会话级缓存与占位降级）
- PR：#34（https://github.com/Tim-Lai-Admiral/AGdicom/pull/34）——**分支基于 T-001（含其提交 279f199），按序合并 #33 → #34**
- 已知限制 / 需 Reviewer 关注：
  - 生成失败以 assetId 记入会话失败标记：同会话内同字节不会重试（压缩/损坏为确定性结果）；素材删除后缓存条目残留（无引用，会话结束即释放，未做失效挂钩）。
  - 缩略图为全尺寸首帧 dataURL（未做降采样，PNG）；超大分辨率切片的 dataURL 体积较大，卡片未要求降采样，按需懒生成限制生成量。
  - jsdom 无 canvas：单测以 `HTMLCanvasElement.prototype` spy 桩定（生成器）与模块 mock（组件），不破坏既有测试（原测试文件未改动）。
  - Manual 待办：浏览器导入合成样本核对行/切片缩略图真实像素 + 压缩样本降级占位（PR body 附清单）。
