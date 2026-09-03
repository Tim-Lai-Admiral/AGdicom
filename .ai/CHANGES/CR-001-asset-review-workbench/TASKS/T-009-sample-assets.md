# Task T-009: 样本素材

## Metadata

```yaml
id: T-009
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-001]
branch: feature/CR-001-T-009-samples
```

## Objective

内置演示素材：4 个心脏 STL 复制入仓库；pydicom 脚本生成合成 DICOM phantom 系列并提交产物；README 素材来源章节（来源/格式/获取方式/使用范围 + TCIA 指引）。

## Context and inputs

- Requirement(s): R-007
- Current architecture/design references: 题目 `../DEMO SET/stl/`（aorta/CB/LA/LVOT.stl）
- Dependency output: T-001（目录结构就绪）

## Scope

Allowed changes:

- `public/samples/stl/`：复制 4 个 STL（约 30MB，Human 已批准入库）。
- `scripts/generate_sample_dicom.py`：pydicom 生成 3 个 series × ≥5 切片（128×128 8-bit phantom，含 Modality/SeriesInstanceUID/PixelSpacing；设置 PatientIdentityRemoved(0012,0062)=YES、DeidentificationMethod(0012,0063)，PatientName/ID 置空）。
- `public/samples/dicom/`：脚本产物（提交，体积小）。
- `README.md` 素材章节：STL 来源路径与使用范围（仅本作业演示）；DICOM 生成方式、去标识化声明、TCIA 公开样本获取指引与许可注意事项。

## Out of scope

- 应用功能代码（本任务纯素材与文档）。

## Expected behavior

1. `public/samples/stl/` 含 4 个 STL，应用可直接加载。
2. `scripts/generate_sample_dicom.py` 可重复运行并幂等产出样本；产物含去标识化标记。
3. README 素材章节满足题目"来源、格式、获取方式、使用范围"四项要求。

## Acceptance criteria

### Functional

- [ ] 4 个 STL 存在且可被 T-006 查看器加载（文件头为二进制 STL）。
- [ ] DICOM 产物 ≥2 个 series，切片数 ≥5，被应用识别为多切片并显示去标识化标记。

### Error handling and compatibility

- [ ] 生成脚本在无网络环境可运行（pydicom 已安装）。

### UI (if applicable)

- 不涉及。

## Technical constraints

- DICOM 产物仅含合成数据，不含任何真实患者信息。
- STL 仅用于本作业演示；README 注明版权归属与使用范围以题目素材为准。

## Implementation notes

- 生成 phantom：简单几何（如圆形/渐变灰度）即可，便于肉眼验证预览渲染。
- 若 pydicom 不可安装，改用手工构造 DICOM 字节的备选方案并在任务结果中说明。

## Test requirements

- [ ] Unit: 无（脚本验证为主）。
- [ ] Manual/E2E: 启动应用 → 加载内置样本 → DICOM 系列识别 + STL 渲染。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] No unrelated changes.
- [ ] README 素材章节完成。
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

## Reviewer result

> Reviewer fills this using the Review template.