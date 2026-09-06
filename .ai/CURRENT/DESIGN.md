# Current Design

> 已接受 UX/UI 事实（CR-001 基础 + CR-003 Figma 工作台重构，2026-09-05 合并）。

## Experience principles

- 关键流程保证可见状态与可撤销性：导入/保存/导出均有反馈；采纳 AI 建议明示来源；导入为备份还原语义（冲突需确认）。
- 医疗相关界面只做工程素材整理与验证文案：测量工具明示"模拟测量，非临床"，不出现诊断/治疗暗示。
- 所有降级路径（DICOM 仅元数据、3D 加载失败、AI 异常）显示明确中文提示且不崩溃。

## Primary user flows

1. 打开应用 → 全屏工作台：顶栏筛选/搜索/导入/导出；左栏素材列表；中央查看区；右栏元数据/评审面板。
2. 顶栏筛选/搜索 → 左栏素材列表更新 → 点击素材 → 中央渲染对应查看器 → 右栏自动切换（DICOM 显示元数据+W/L，其余显示评审面板）。
3. DICOM：左栏按患者组展开（姓名+ID 分组 → series → 切片缩略图，点击切换）；切片导航为**滑动条**（rec 样式，含计数读数）；右栏窗宽窗位滑杆（C:-1000..1000 / W:1..4000）与 6 预设（Lung/Mediastinum/Bone/Brain/Liver/S.Tissue）实时调窗；测量工具拖拽绘制（Mock，PixelSpacing 可用时确定性 mm，否则 px 模拟值）。
4. 图片：预览与双图并排比较（选中两张 → 比较态 → Esc 退出）；3D：旋转/缩放/平移（WebGL 降级提示）。
5. 评审面板（右栏）：状态 + 评审意见（追加历史）、标签/备注、AI 建议（Mock 明示，采纳/忽略）。
6. 导出 JSON（review-export-YYYYMMDD-HHmmss.json）→ 导入恢复（非法拒绝）。

## Design system and accessibility

- 中文界面；**Tailwind v4**（`@tailwindcss/vite`）+ 深色设计令牌（`--bg #060810 / --panel / --surface / --accent #00c4d8 / --text-*`，源自 Figma Make 原型 rec/）；手写 CSS 变量层（index.css）。
- 字体本地化：Inter + JetBrains Mono woff2（public/fonts/，@font-face），零外部 CDN（离线可用）；CJK 回退系统字体。
- 布局：顶部工具栏 + 左侧素材/序列栏（可折叠）+ 中央查看区 + 右侧面板（可折叠）；窄屏 64rem 收窄，顶栏开关折叠。
- **视觉对齐 rec/（CR-004）**：左栏为紧凑行式列表（38px 方形缩略图 + 名称行 + `类型 · 状态点` mono 元信息行，选中 accent 左边框+底色）；**无卡片容器、无卡片评审按钮、无徽标式状态按钮**；顶栏 44px + tool-btn 16px 线性图标 + 分隔线 + mono 读数；状态经"选中 → 右栏评审面板"修改（StatusDot 仅展示）。
- 组件类：.tool-btn / .range-input / .preset-btn / .sidebar-thumb / .meta-row / .viewport-overlay 等；4px 细滚动条。
- 可访问性：状态徽标颜色+文字双通道；反馈 role="status"、错误/降级 role="alert"；DICOM 面板焦点圈定；Esc 关闭查看/比较；查看器为内嵌视图（非模态，已去除 aria-modal）。
- 大文件（≥10MB）异步并提示；3D 加载进度条。

## Known UI debt (TODO 登记)

- TD-003：Esc 同时关闭中央 DICOM 查看器与右栏评审页签（既有行为）。
- TD-004：视口角标覆盖层 `.viewport-overlay` 迁移后未接线。
- TD-005：切片无滚轮切换（左栏缩略图点击可用）。
- 真机手动清单 11 项（WALKTHROUGH.md 第五节）：WebGL/W/L 手感/导出下载等。

## Last updated

- Date: 2026-09-05
- Source: CR-001 + CR-002 + CR-003
- Approved by: Human