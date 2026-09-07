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