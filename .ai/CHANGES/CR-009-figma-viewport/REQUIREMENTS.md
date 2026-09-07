# Requirements Delta: CR-009

## R-023: DICOM 视口四角元数据（中央表格下线）

**Status**: approved

**Behavior**

```text
Given DICOM 素材在中央视口查看
Then 中央视口叠加四角元数据（JetBrains Mono，半透明，图一格式）：
     左上：患者名 / PatientID / 日期 时间
     右上：Modal 类型 · 厂商 / series 描述 / Inst #N / Total
     左下：C: X  W: Y / Slice thickness: X mm / PixelSpacing
     右下：Zoom: X% / Rot: X° / 平面（AXIAL/CORONAL/SAGITTAL 或对应中文）
And 中央不再显示元数据表格（原 DicomViewer 元数据区块移除）
And 右栏 MetadataPanel（分组折叠）为元数据唯一来源（Patient/Study/Series/Image/Acquisition/Equipment 分组；缺失字段显示"已置空"或隐藏行）
```

**Acceptance criteria**

- [ ] 四角覆盖层显示且值正确（合成样本核验 C/W 随窗宽窗位实时更新）
- [ ] 中央无元数据表格（grep/单测）；右栏分组折叠可用且为唯一元数据源
- [ ] 覆盖层可读（半透明、mono、不遮挡交互）

## R-024: 顶部工具栏工具（含测量迁移）+ 平移/旋转/缩放

**Status**: approved

**Behavior**

```text
Given DICOM 或图片素材在中央查看
When 激活 top toolbar 工具组
Then 工具按钮：pan（拖拽平移）/ zoom（拖拽或滚轮缩放）/ window（拖拽调节 C/W，仅 DICOM）/ rotate（拖拽旋转）/ measure（拖拽绘制测量线，仅 DICOM）
And 测量入口迁移至工具组（移除查看器内"测量(模拟)"与"清空测量"按钮；清空测量置于工具/视口右上角小控件）
And 图片查看器支持 pan/zoom/rotate（无 window/measure）
```

**Acceptance criteria**

- [ ] 工具按钮存在且可切换（aria-pressed/aria-label）；状态与视口行为一致
- [ ] 测量：拖拽绘制 + 明示 Mock + 清空；PixelSpacing 确定性/px 降级（既有 R-010 单测沿用）
- [ ] 图片 pan/zoom/rotate 可用（拖拽/滚轮/按钮）
- [ ] 移除的内置按钮无测试残留（grep）

## R-025: 滚轮滚动切片与滑动条双向同步

**Status**: approved

**Behavior**

```text
Given DICOM 视口聚焦
When 用户滚轮（非 Ctrl）
Then 切片 +1/-1（上下边界不溢出），底部滑条与计数同步
Given 用户拖动底部滑动条
When 值变化
Then 中央切片切换且视口四角 Inst 数值同步
```

**Acceptance criteria**

- [ ] 滚轮/滑条双向同步（单测+集成）
- [ ] Ctrl+滚轮 = 缩放（不冲突）

## R-026: 左右侧栏抽屉滑动

**Status**: approved

**Behavior**

```text
Given 左/右栏打开或关闭
When 用户切换（顶栏开关）
Then 面板宽度过渡（0.2s ease，图一 rec 风格 slide），内容不溢出
```

**Acceptance criteria**

- [ ] 切换有滑动动画；窄屏折叠正确

## 非目标

- MPR/真实测量精度；3D 视口改造；诊断暗示。