# Task T-005: 走查与文档收尾

## Metadata

```yaml
id: T-005
cr: CR-003
type: docs
status: implemented
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 15
depends_on: [T-004]
branch: feature/CR-003-T-005-walkthrough
```

## Context pack

- Requirement: UI-001/UI-002/R-010 验收收口；参考素材 `rec/`（对照走查）
- 关键文件：`.ai/CHANGES/CR-003-ui-redesign/DESIGN.md`（规范）、`README.md`（已知问题）、`.ai/CURRENT/DESIGN.md`（合并后更新）
- 禁止：功能改动（仅走查与文档）；UI/UX Agent 不启用（Human 决定，走查由协调者/Reviewer 执行）

## Objective

对照 Figma 参考走查实现符合性（布局/主题/交互），浏览器手动验证核心链路，更新文档（DESIGN/CURRENT/README/CHANGE.md Result）。

## Scope

- 走查清单：四区布局、深色主题一致性、W/L 与测量交互、三类素材链路、窄屏折叠、离线字体
- 浏览器手动验证（`npm run dev`），发现问题登记（阻塞→修，非阻塞→README 已知问题/TODO）
- 文档：CR-003 DESIGN.md 校对、CURRENT/DESIGN.md 更新（合并后由协调者）、README 已知问题、CHANGE.md Result

## Out of scope

- 新功能；UI/UX Agent；视觉逐像素复刻

## Acceptance criteria

- [ ] 走查清单逐项执行并有结论记录（走查记录随 PR 提交）
- [ ] 发现项均有处置（修复或登记）
- [ ] 文档与实现一致

## Test requirements

- [ ] Manual: 浏览器全链路走查（含 4 个 STL、合成 DICOM、图片导入）

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

**走查方法**（按派发增量事实）：代码审查 + 自动化测试为主；真机浏览器项列入手动清单（WALKTHROUGH.md 第五节），本轮未操作浏览器。

**走查结论**（详见 `.ai/CHANGES/CR-003-ui-redesign/WALKTHROUGH.md`）：

1. **符合项**：四区布局（顶栏/左栏 17.5rem+series 展开/中央统一查看区/右栏 20rem 页签联动）、
   深色主题（index.css 令牌与 rec 逐变量一致，组件类逐行一致）、W/L 交互（滑杆+6 预设+自动复位，
   App 持有状态+切换复位）、测量 Mock（SVG 覆盖层拖拽+mm/Mock 口径+非临床明示+切换清空）、
   三类素材链路（图片/比较、DICOM series+切片导航+降级、3D lazy+降级）、窄屏折叠（64rem 收窄+
   顶栏左右栏开关）、离线字体（4 woff2 @font-face，全库无 CDN 引用）、医疗约束（「模拟测量，非临床」
   常驻+无诊断/治疗暗示文案）、可访问性（role=alert/status、DICOM Tab 圈定+焦点还原、Esc 关闭、
   双通道状态）。
2. **发现项（全部非阻塞，均已处置）**：
   - F1 Esc 同时关闭 DICOM 查看器与右栏评审页签 → **TD-003** 登记 .ai/TODO.md（派发指令指定）；
   - F2 视口角标覆盖层未实现（.viewport-overlay 迁移后无 TSX 使用）→ **TD-004** 登记 + README 已知问题 #8；
   - F3 DICOM 切片无滚轮切换（DESIGN 交互流程提及）→ **TD-005** 登记 + README 已知问题 #8；
   - F4 侧栏缩略图类名差异（.sidebar-thumb 未用，dicom-expand__thumb 功能等价）、
     F5 「状态筛选并入类型筛选」实现为同组并列（功能等价）、F6 顶栏比较按钮未在 DESIGN 映射表中列出、
     O1 窄屏无自动折叠 → 走查注记，不改动。
   - 无阻塞发现 → 按卡片「禁止功能改动」约束，本 PR 仅文档与登记。
3. **DESIGN.md 校对**：无事实性错误，正文未修改；实现偏差（F2/F3）按协议登记而非改规范。
   CURRENT/DESIGN.md 更新按卡片约定合并后由协调者执行，不在本任务范围。

**文档更新**：新增 WALKTHROUGH.md；TODO.md +TD-003/004/005；README（功能一览补工作台布局/W-L/测量、
已知问题截至 T-005 + #8、技术栈补 Tailwind v4、项目文档补 CR-003 与走查记录链接）；CHANGE.md Result 填写；
本任务卡 status→implemented + 本 result。

**验证结果**：`scripts\verify.ps1` 全绿 —— 28 个测试文件 / 274 测试通过，`tsc -b && vite build` 成功
（Model3DViewer chunk 警告为既有状态）。

**文件清单**：`.ai/CHANGES/CR-003-ui-redesign/WALKTHROUGH.md`（新增）、`CHANGE.md`、
`TASKS/T-005-walkthrough.md`、`.ai/TODO.md`、`README.md`。

**已知限制 / Reviewer 关注点**：
- 真机手动清单（WALKTHROUGH.md 第五节 11 项，含 TD-003 现象复现指引）待人工执行；
  自动化仅覆盖 jsdom 可验证部分。
- TD-003/004/005 为非阻塞技术债，均已给出建议方向，供 Planner 排期。
- 本分支 stack 于 feature/CR-003-T-004-integration（PR #16），PR diff 会包含 T-002~T-004 链的
  提交，请按 #14 → #15 → #16 → 本 PR 顺序审阅/合并。