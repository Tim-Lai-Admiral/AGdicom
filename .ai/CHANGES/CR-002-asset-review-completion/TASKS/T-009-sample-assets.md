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

## Builder result

- **实现摘要**：
  - `scripts/generate_sample_dicom.py`（pydicom 3.0.2）：程序化合成 3 个 series × 每系列 6 切片（18 个 `.dcm`，128×128 8-bit 灰度 phantom，Explicit VR Little Endian 无压缩，含 Modality / SeriesInstanceUID / InstanceNumber / PixelSpacing / SliceThickness / ImagePositionPatient 等标签）；UID 为固定合成根、图案确定性（无随机/无时间戳），重复运行输出字节级一致（已验证幂等）；去标识化：(0012,0062)=YES、(0012,0063)=AGDICOM-SYNTHETIC-PHANTOM、PatientName/ID 置空；脚本内置写后回读断言。
  - `public/samples/dicom/`：`phantom-ct-01..06`（CT，1.0mm）、`phantom-mr-01..06`（MR，0.8mm）、`phantom-ct2-01..06`（CT 薄层，0.5mm），共约 303KB。
  - `README.md` 新增「素材样本」章节：STL 来源（`../DEMO SET/stl/`，4 个心脏模型）/格式/使用范围；DICOM 生成方式（pip install pydicom + 脚本）、格式/内容、去标识化声明、TCIA 公开样本获取指引（许可与注意事项）——覆盖来源/格式/获取方式/使用范围四项。
- **文件清单**：`scripts/generate_sample_dicom.py`（新增）、`public/samples/dicom/*.dcm` ×18（新增）、`README.md`（新增素材章节）、本任务卡。
- **验证结果**：
  - 幂等：两次运行 SHA256 全部一致；
  - 应用解析栈自动验证（临时 vitest + 应用自身 `parseDicomFile`/`decodeDicomFrame`/`sliceCountByAsset`，验证后已删除）：18 文件 → 3 series × 6 切片、InstanceNumber 递增、去标识化证据三项齐全、首帧像素解码成功（128×128）；
  - `scripts\verify.ps1` 全绿（233 tests passed + build 成功）；
  - 环境：Python 3.11.9 + `pip install pydicom`（3.0.2）。
- **commit / PR**：实现 commit `fe6a9f5`；分支 `feature/CR-002-T-009-samples`；PR 见 Reviewer 记录。
- **已知限制**：
  - 验收第 2 条以应用自身解析栈自动验证替代浏览器手动 E2E（dicom-parser 与 UI 共用同一解析/解码层）；建议 Reviewer 按测试要求做一次手动 E2E（`npm run dev` → 导入 `public/samples/dicom/`）复核切片切换 UI。
  - `python -m pip install pydicom` 为本机一次性环境依赖，未进入 package.json（脚本注释与 README 已写明）。
- **需 Reviewer 关注点**：DICOM 产物无真实患者信息（纯数学 phantom + 空患者字段 + 去标识化标签）；README 素材章节是否覆盖 R-007 四项；其余章节保持不动（T-010 收尾）。