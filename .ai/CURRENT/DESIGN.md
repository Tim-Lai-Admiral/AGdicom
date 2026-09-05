# Current Design

> 已接受 UX/UI 事实（CR-001 DESIGN.md 落地，2026-09-05 合并）。

## Experience principles

- 关键流程保证可见状态与可撤销性：导入/保存/导出均有反馈；采纳 AI 建议明示来源；导入为备份还原语义（冲突需确认）。
- 医疗相关界面只做工程素材整理与验证文案，不出现诊断/治疗暗示。
- 所有降级路径（DICOM 仅元数据、3D 加载失败、AI 异常）显示明确中文提示且不崩溃。

## Primary user flows

1. 打开应用 → 素材库空态引导（拖拽/选择文件，或"加载内置样本"）。
2. 导入素材（拖拽或选择）→ 按类型分类入网格 → 组合筛选/搜索。
3. 点击素材 → 对应查看器：图片预览（双图比较）、DICOM 元数据面板 + 切片预览、3D 查看器（旋转/缩放/平移）。
4. 评审面板（右侧抽屉）：状态 + 评审意见（追加历史）→ 标签/备注 → 保存。
5. AI 建议（Mock，明示来源）：采纳命名/标签或忽略。
6. 导出 JSON（review-export-YYYYMMDD-HHmmss.json）→ 导入恢复（非法拒绝）。

## Design system and accessibility

- 中文界面；手写 CSS + `:root` CSS 变量，不引入 UI 框架；单视图 SPA，弹层式查看器，无路由库。
- 布局：素材库网格 + 右侧评审抽屉；窄屏下抽屉全宽；查看器为 dialog 弹层（Esc/关闭按钮）。
- 状态徽标颜色+文字双通道（待评审灰、通过绿、驳回红）；反馈用 `role="status"`，错误/降级用 `role="alert"`。
- DICOM 查看器含焦点圈定与关闭后焦点还原（T-010 修复）；其余弹层无 focus trap（README 已知问题）。
- 大文件（≥10MB）异步处理并提示；3D 加载显示进度条；WebGL 不可用显示降级提示。

## Last updated

- Date: 2026-09-05
- Source: CR-001 + CR-002
- Approved by: Human