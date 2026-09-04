# Task T-009: 样本素材（合成 DICOM + README 素材章节）

## Metadata

```yaml
id: T-009
cr: CR-002
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 20
depends_on: [T-008]
branch: feature/CR-002-T-009-samples
```

## Context pack

- Requirement: R-007（CR-001 REQUIREMENTS.md）；流程 P-001~P-003（CR-002）
- 关键文件：`scripts/generate_sample_dicom.py`（新建，pydicom，需 `pip install pydicom`）、`public/samples/dicom/`（产物提交）、`README.md`（素材章节——README 主体由 T-010 收尾，本任务只写素材来源章节或提供草案）
- 已知：STL 样本已入库（`public/samples/stl/`，commit dee49f8，本任务不重复）
- 禁止：不改 `.opencode/`、`ENVIRONMENT.md`；DICOM 产物不得含任何真实患者信息

## Objective

生成并提交合成 DICOM 样本（pydicom 脚本 + 产物），在 README 记录素材来源/格式/获取方式/使用范围 + TCIA 指引。

## Scope

- `scripts/generate_sample_dicom.py`：3 个 series × ≥5 切片（128×128 8-bit phantom，含 Modality/SeriesInstanceUID/PixelSpacing；0012,0062=YES、0012,0063、PatientName/ID 置空）
- `public/samples/dicom/`：脚本产物（幂等、体积小）
- `README.md` 素材章节：STL 来源路径与使用范围；DICOM 生成方式、去标识化声明、TCIA 公开样本获取指引

## Out of scope

- README 其他章节（T-010）；应用功能代码。

## Acceptance criteria

- [ ] 脚本可重复运行且幂等；产物 ≥2 series、切片数 ≥5、含去标识化标记
- [ ] 产物被应用识别为多切片 series（可经手动 E2E 验证）
- [ ] README 素材章节覆盖来源/格式/获取方式/使用范围四项
- [ ] `scripts\verify.ps1` 全绿（现有测试不回归）

## Test requirements

- [ ] Manual: 启动应用 → 导入 `public/samples/dicom/` → DICOM 系列识别 + 切片预览

## Definition of done

- [ ] 验收通过；填 Builder result；Reviewer 审查