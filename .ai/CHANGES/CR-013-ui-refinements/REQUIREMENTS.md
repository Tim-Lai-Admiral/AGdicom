# Requirements Delta: CR-013

## R-031: 左栏箭头旋转指示展开态

**Behavior**

```text
Given 患者分组头或系列行处于收起态
When 展开
Then 行首 chevron 箭头旋转（收起 -90° / 展开 0°，0.15s 过渡，rec 样式）
```

**Acceptance criteria**

- [ ] 分组头/系列行箭头随展开态旋转（CSS transition 断言或类名）
- [ ] aria-expanded 语义保留

## R-032: 左栏布局重排（患者分组/序列库在上）

**Behavior**

```text
Given 左栏存在 DICOM 素材
When 渲染左栏
Then 顶部为"患者分组 / 序列库"（PatientGroupPanel），下方为全素材库列表（AssetGrid）
And 空库/无 DICOM 时布局不异常（分组面板隐藏，仅素材库）
```

**Acceptance criteria**

- [ ] DOM 顺序：分组面板在素材列表之前（测试断言）
- [ ] 空/无 DICOM 场景不回归

## R-033: DICOM 系列级比较选择

**Behavior**

```text
Given 比较模式激活
When 用户查看患者分组面板
Then 系列行可直接选择（点选加入比较选择，再点选第二个系列）
And 选择两个系列 → 自动进入 DICOM 双系列比较（无需逐文件选素材行）
And 素材行选择（image/dicom 行）仍可用（两种入口并存）
```

**Acceptance criteria**

- [ ] 分组面板 series 行在比较模式下可点选（选中态标记），选满两个系列自动比较
- [ ] 与素材行选择互斥语义清晰（同类型约束；系列选择与素材选择不混合，或混合拒绝有提示）
- [ ] 退出比较清理系列选择

## 非目标

- 元数据/评审契约；STL 系列概念。