# Requirements Delta: CR-005

## R-011: 移除"加载内置样本"功能

**Status**: approved

**Behavior**

```text
Given 用户需要导入 STL/图片/DICOM
When 使用应用
Then 仅通过文件选择/拖拽导入（T-003 既有管线）
And 顶栏不再有"加载样本"按钮；handleLoadSamples 等代码移除；public/samples/stl/ 删除
```

**Acceptance criteria**

- [ ] 顶栏无样本按钮；grep 无 handleLoadSamples/SAMPLE_STL_NAMES 残留
- [ ] `public/samples/stl/` 4 个文件删除（git 历史可恢复）
- [ ] 测试无"加载内置样本"链路（相关用例移除或改直连导入）

## R-012: DICOM 患者分组索引与排序

**Status**: approved

**Behavior**

```text
Given 左栏展示 DICOM 素材
When 展开
Then 按 PatientName + PatientID 分组：两者完全相同者同组
And 组间排序：按（PatientName, PatientID）升序；组内 series 按 SeriesInstanceUID 升序；切片按 InstanceNumber 升序
And 患者字段缺失者单独成组（"未知患者"），置于末尾
```

**Acceptance criteria**

- [ ] seriesUtils（或新模块）提供 `groupDicomByPatient` 纯函数，单测覆盖排序与缺失字段
- [ ] 左栏展开层级：患者组 → series → 切片；默认患者组折叠
- [ ] 既有按 series 的分组/切片预览逻辑（DicomViewer 内）不回归

## R-013: 切片切换改滑动条（rec 样式）

**Status**: approved

**Behavior**

```text
Given DICOM 查看器切片导航
When 用户操作
Then 使用范围滑动条（min=1, max=N）选择切片，实时切换并重绘
And 移除"‹ 上一张 / 下一张 ›"文本按钮与切片下拉
And 保留位置读数（"切片 X / N（按 InstanceNumber 排序）"）
```

**Acceptance criteria**

- [ ] 滑动条可拖动切换切片（aria-label="选择切片"）
- [ ] 无上一张/下一张按钮与下拉残留（grep 确认）
- [ ] 测量/降级路径不回归

## 非目标

- 患者合并策略、真实患者数据、public/samples/dicom/ 保留。