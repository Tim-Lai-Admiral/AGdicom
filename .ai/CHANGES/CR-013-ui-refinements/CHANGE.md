# CR-013: DICOM 元数据随切片同步 + 左栏箭头旋转/布局重排 + 系列级比较

## Metadata

```yaml
id: CR-013
title: "滑动切换 DICOM 时右栏元数据同步更新；左栏箭头旋转指示展开态；左栏先显示患者分组/序列库再显示全素材库；比较可直接选择两个系列"
change_level: L2
status: approved
parent: null
created_by: Planner
created_at: 2026-09-08
```

## Why

Human 反馈（2026-09-08）：
1. 滑动切换 DICOM 切片时，右侧元数据要同步更新（当前右栏元数据停留在最初选中素材，不随切片切换）。
2. 左栏箭头应旋转指示展开/收起状态。
3. 左栏应先显示患者分组与序列库，再显示全素材库（当前素材列表在上、分组面板在下）。
4. 比较功能应能直接选择两个系列（series）进行比较（当前只能选素材行，DICOM 需逐文件选）。

## Goal

- DICOM 元数据面板随当前切片同步（实例号/文件名等按切片更新；评审面板仍绑定选中素材）。
- 左栏分组头/系列行箭头旋转动画指示展开态。
- 左栏布局：患者分组+序列库在上，素材库在下。
- 比较模式支持直接选择两个 series 进入 DICOM 双系列比较。

## Non-goals

- 元数据/评审契约变更；STL 系列概念（无）；图片比较改造。

## Requirement changes

### Modified

- R-022 扩展：切片切换同步右栏元数据（metaAsset = 当前切片素材）。
- R-029 细化：比较支持 series 级选择（两个系列直接比较）。

### Added

- R-031: 左栏箭头旋转指示展开态（chevron rotate，rec 样式）。
- R-032: 左栏布局重排：患者分组/序列库在上，全素材库在下。
- R-033: DICOM 系列级比较选择：患者分组面板内可直接选择两个系列（不逐文件选）。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | minor | 元数据同步 + 系列比较 |
| UX/UI | minor | 左栏布局/箭头 |
| Architecture | none | 组件与状态 |
| Data / API | none | schema 不变 |
| Testing | minor | 相关用例适配 + 新增 |

## Tasks

- [ ] T-001: 右栏元数据随切片同步（metaAsset 逻辑）+ 左栏箭头旋转 + 左栏布局重排
- [ ] T-002: 系列级比较（series 直接选择进入 DICOM 比较）+ 测试/矩阵/文档

## Dependencies

- CR-012（DICOM 双系列比较）、CR-008（activeSliceAssetId）、CR-009（左栏抽屉）

## Approval

- [x] Human approved（2026-09-08 指示）

## Result

<!-- 合并后填写 -->