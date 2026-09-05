# CR-003: UI 重构（Figma Make 设计对接 + W/L 调节 + 测量 Mock）

## Metadata

```yaml
id: CR-003
title: "UI 重构：Figma Make 工作台布局对接、窗宽窗位调节、测量 Mock 模式"
change_level: L4
status: approved
parent: null
created_by: Planner
created_at: 2026-09-05
```

## Why

Human 反馈现有 UI 的布局与信息架构、交互流程不合理。素材 `rec/`（Figma Make 生成的 DICOM 阅片器原型，不追踪 git）提供深色医学主题的全屏工作台范式。Human 决策：采用该布局范式重构；纳入窗宽窗位调节（原为 R-003 非目标）；测量功能以 Mock 模式纳入；引入 Tailwind v4。不启用 UI/UX Agent（Human 2026-09-05 决定）。

## Goal

- 以 Figma 全屏工作台范式重构 UI：顶部工具栏 + 左侧素材/序列栏 + 中央统一查看区 + 右侧元数据/评审面板。
- 引入 Tailwind v4 与深色设计令牌。
- DICOM 切片预览支持窗宽窗位调节（滑杆 + 6 预设）。
- 测量工具以 Mock 模式提供（拖拽绘制 + 确定性距离值，明示非临床）。

## Non-goals

- 真实 MPR / 多平面重建、真实旋转重建、空间校准、测量结果持久化与临床结论。
- 测量/MPR 视觉 demo 的完整迁移（仅实现可用的交互子集）。
- UI/UX Agent 角色（本轮不启用）。
- 外部字体 CDN 依赖（保持离线可用，字体本地化）。

## Requirement changes

### Modified

- R-003: DICOM 切片预览由"min-max 固定"扩展为"可调窗宽窗位（默认自动 min-max；压缩/损坏仍降级仅元数据）"。

### Added

- R-010: 测量工具（Mock 模式）：视口内拖拽绘制测量线，距离值由 PixelSpacing（可用时）确定性计算或 Mock 值，明示"模拟测量，非临床"。
- UI-001: 全屏工作台布局（顶栏/左栏/中央/右栏），现有功能（导入/筛选/状态/比较/评审/AI/导出）迁移至新布局。
- UI-002: Tailwind v4 接入与深色设计令牌（沿用 rec/src/index.css 主题变量）。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | major | 布局/交互模式整体重构（L4，Human 已批准方向） |
| UX/UI | major | 全屏工作台范式 + 深色主题 |
| Architecture | minor | 引入 Tailwind v4（样式基础设施）；组件层重组 |
| Data / API | minor | decodePixel 增加 wc/ww 参数（向后兼容默认值） |
| Testing | major | 现有 238 测试须不回归；新增 W/L 与测量 Mock 测试 |
| Existing behavior | major | UI 全面替换（功能保持） |

## Tasks

- [ ] T-001: 设计系统接入（Tailwind v4 + 深色令牌 + 字体本地化）
- [ ] T-002: 工作台布局重构（顶栏/左栏/中央/右栏）
- [ ] T-003: DICOM 增强（W/L 调节 + 测量 Mock）
- [ ] T-004: 功能集成迁移与回归（评审/AI/比较/导出）
- [ ] T-005: 走查与文档收尾（对照 rec/ 参考 + DESIGN/CURRENT/README 更新）

## Dependencies

- rec/（Figma Make 素材，gitignore 不追踪；任务可读但不可提交）
- Tailwind v4（npm，网络可用）

## Approval

- [x] Human approved scope（2026-09-05：布局/信息架构+交互重构、W/L 纳入、测量 Mock 纳入、Tailwind v4、走 CR 流程、不启用 UI/UX Agent）

## Result

> 本节由 T-005（走查收尾）于 2026-09-06 填写；合并状态以填写时刻为准，Human 合并后由协调者按需更新并同步 `.ai/CURRENT/`。

### 交付（T-001 → T-005）

| Task | 内容 | 状态 |
|---|---|---|
| T-001 | 设计系统接入（Tailwind v4 + 深色令牌 + 组件类迁移 + 字体本地化） | 已合并（PR #13） |
| T-002 | 工作台布局重构（顶栏 / 左栏 series 切片展开 / 中央统一查看区 / 右栏元数据·评审） | 已实现待合并（PR #14） |
| T-003 | DICOM 增强（W/L 滑杆 + 6 预设 + 测量 Mock：拖拽绘制 / 确定性 mm / 模拟标注 / 切换清空） | 已实现待合并（PR #15） |
| T-004 | 功能集成迁移与回归（评审 / AI / 比较 / 导出导入入口归位 + 旧布局死代码清理） | 已实现待合并（PR #16） |
| T-005 | 走查与文档收尾（对照 rec/ 与 DESIGN.md；WALKTHROUGH.md；TD-003/004/005 登记） | 随本 PR（stack 于 T-004 链） |

### 验证

- `scripts\verify.ps1` 全绿：28 个测试文件 / 274 测试通过；`tsc -b && vite build` 成功（Model3DViewer chunk 警告为既有状态，TD-002 已拆分按需加载）。

### 走查结论

- 对照 rec/ 参考与 DESIGN.md 逐项走查（四区布局 / 深色主题 / W-L 与测量交互 / 三类素材链路 / 窄屏折叠 / 离线字体 / 医疗约束 / 可访问性）：全部符合，无阻塞发现；记录见 `.ai/CHANGES/CR-003-ui-redesign/WALKTHROUGH.md`（含真机浏览器手动验证清单，待 Reviewer / Human 执行）。
- 非阻塞遗留登记 `.ai/TODO.md`：TD-003（Esc 同时关闭 DICOM 查看器与评审面板）、TD-004（视口角标覆盖层未接线）、TD-005（切片滚轮切换缺失）；README 已知问题 #8 同步。
- DESIGN.md 校对：无事实性错误，正文未修改；`.ai/CURRENT/DESIGN.md` 更新按约定合并后由协调者执行。

### 合并后动作（协调者）

1. 更新 `.ai/CURRENT/DESIGN.md`（R-003 修改 / R-010 / UI-001 / UI-002 生效）。
2. 合并后删除 T-002 ~ T-005 Task 分支。