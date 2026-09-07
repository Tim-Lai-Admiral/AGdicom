# Requirements Delta: CR-007

## R-017: DICOM 真实缩略图

**Status**: approved

**Behavior**

```text
Given DICOM 素材已解析（dicomMeta 存在且像素可解码）
When 左栏展示素材行或切片缩略图
Then 使用真实首帧像素缩略图（decodeDicomFrame → canvas → dataURL，会话级）
Given 未解析 / 压缩 / 无法解码
When 展示
Then 使用 SVG 占位（现状不变），不崩溃
Given image 素材
When 展示行缩略图
Then 维持 objectUrl 缩略图（现状）
Given model 素材
When 展示行缩略图
Then 维持类型图标（非目标）
```

**Acceptance criteria**

- [ ] DICOM 行缩略图与 series 展开的切片缩略图显示真实像素（合成样本可辨认）
- [ ] 未解析/压缩/降级路径仍占位不崩溃
- [ ] 缩略图 dataURL 会话级（不持久化、不入导出 JSON）

## R-018: DicomViewer 解析范围 = 所属 series

**Status**: approved

**Behavior**

```text
Given 打开任一 DICOM 素材
When 触发解析
Then 只解析该素材所属 series 的全部切片文件（按 SeriesInstanceUID 匹配；UID 缺失时按聚合后的"未知系列"）
And 不再解析素材库中其他 series 的文件
```

**Acceptance criteria**

- [ ] 打开一个 series 的文件不解析其他 series（单测断言 parse 调用集合）
- [ ] 既有"聚合切片数回写"行为保持在所属 series 内
- [ ] 跨 series 素材解析互不污染

## R-019: 未知系列聚合

**Status**: approved

**Behavior**

```text
Given 同患者（姓名+ID 相同）的多个文件
When SeriesInstanceUID 缺失
Then 聚合为单个"未知系列"（key = 患者键 + 'unknown-series' 标记），切片按 InstanceNumber 升序、缺失按文件名序
Given 文件有 SeriesInstanceUID
When 分组
Then 保持各自 series（现状不变）
```

**Acceptance criteria**

- [ ] 同患者 10 个无 UID 文件 → 1 患者组 + 1 未知系列 + 10 切片（不再 10 系列）
- [ ] 有 UID 文件不受影响；未知系列与已知系列可共存于同一患者组
- [ ] 单测覆盖聚合键/排序/混合场景

## R-020（流程）: 场景矩阵测试要求

**Status**: approved

**Behavior**

```text
Given 任务卡涉及"批量导入/多文件数据流"（导入、分组、series、缩略图、批量解析等）
When 编写 Test requirements
Then 必须包含场景矩阵：导入组合（同系列多文件 / 跨系列 / 无 UID / 混合患者 / 空批次）逐项断言（左栏层级、解析范围、无崩溃）
And 包含浏览器手动清单（真实文件批量导入核对）
```

**Acceptance criteria**

- [ ] CR-007 各任务卡含场景矩阵；T-003 落地矩阵测试
- [ ] 模板/规范中 R-020 可检索（任务卡 Context pack 引用）

## 非目标

- 3D 预览缩略图；缩略图持久化；测量。