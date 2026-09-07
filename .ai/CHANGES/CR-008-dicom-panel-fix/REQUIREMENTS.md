# Requirements Delta: CR-008

## R-021: 左栏独立"患者分组"面板

**Status**: approved

**Behavior**

```text
Given 素材库存在 DICOM 素材
When 左栏展示
Then 素材库列表下方（或指定区域）渲染独立"DICOM 患者分组"面板：
     一次渲染全部患者组（按 R-012 排序），分组头可折叠，组内 series（含未知系列）→ 切片缩略图
And 素材行不挂载任何"展开切片"控件（renderExtras 对 dicom 返回 null）
Given 用户点击分组面板中的切片
Then 仅切换中央查看器与左栏高亮（面板位置与展开状态不变）；不移动面板到其他行
```

**Acceptance criteria**

- [ ] 素材行无"展开切片"控件（grep/单测）；分组面板仅渲染一次
- [ ] 点击切片后：中央打开该切片、左栏高亮更新、分组面板停留原位
- [ ] 分组头/系列行折叠交互可用；无元数据时显示占位不崩溃

## R-022: 中央切片切换实时更新左栏高亮

**Status**: approved

**Behavior**

```text
Given 中央 DICOM 查看器处于打开状态
When 用户通过滑动条/步进/其他方式切换切片
Then DicomViewer 调用 onSelectedSliceChange(当前切片 assetId)
And 左栏分组面板对应切片缩略图高亮实时更新（与中央一致）
```

**Acceptance criteria**

- [ ] 滑动条拖动 → 左栏高亮跟随（单测/集成断言）
- [ ] 点击左栏切片 → 中央切换且高亮正确（现有路径不回归）
- [ ] 关闭查看器 → 高亮状态合理清理

## 非目标

- 分组语义/排序变更；缩略图生成变化；3D。