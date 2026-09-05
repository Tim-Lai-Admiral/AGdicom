# Design Delta: CR-003（Figma Make 工作台范式）

> 参考素材：`rec/`（Figma Make 生成的 DICOM 阅片器原型，gitignore 不追踪；任务只读参考，不提交）。

## 布局范式（替换现有"素材库网格 + 弹层查看器"）

```text
┌────────────────────────────────────────────────────────────┐
│ TopToolbar  类型筛选 | 搜索 | 导入 | 加载样本 | 导出 | 面板开关 │
├──────────┬────────────────────────────────┬─────────────────┤
│ 左栏      │ 中央查看区（Viewport）          │ 右栏             │
│ 素材列表  │ · 图片：预览/双图比较            │ · DICOM 元数据    │
│ · 图片卡片│ · DICOM：切片预览（W/L 可调）    │   分组折叠+W/L   │
│ · 3D 卡片 │ · 3D：three.js 查看器           │ · 评审面板        │
│ · DICOM  │ · 测量覆盖层（Mock）             │   状态/标签/备注  │
│   series │  视口角标覆盖层                  │   /历史/AI       │
│   切片缩略│                                  │                 │
└──────────┴────────────────────────────────┴─────────────────┘
  深色主题：--bg #060810 / --panel #0b0e16 / --accent #00c4d8
```

## 组件映射（Figma 组件 → 现有功能）

| Figma 组件 | 现功能迁移 | 说明 |
|---|---|---|
| TopToolbar | 导入/加载样本/筛选/导出/面板开关 | 新增搜索框；状态筛选并入类型筛选 |
| SeriesSidebar | 素材库（AssetGrid） | 卡片列表；DICOM 展开 series+切片缩略图（ThumbSVG 样式） |
| Viewport | ImageViewer/CompareView/DicomViewer 预览/Model3DViewer | 统一容器 + 角标覆盖层；测量覆盖层 |
| MetadataPanel | DicomViewer 元数据表 + ReviewPanel | 分组折叠（Patient/Study/Series/Image/…）；W/L 区块；评审区块 |
| 设计令牌/工具按钮/滑块/预设 | styles.css 全面替换 | Tailwind v4 + CSS 变量 |

## 交互流程

1. 顶栏筛选/搜索 → 左栏素材列表更新 → 点击素材 → 中央查看区渲染对应查看器 → 右栏自动切换（DICOM 显示元数据+W/L，其余显示评审面板）。
2. DICOM：左栏切片缩略图/滚轮/滑块切换切片；右栏 W/L 滑杆与预设调窗；测量工具拖拽绘制（Mock 明示）。
3. 双图比较：选中两张图片 → 中央进入并排比较（保留 Esc 退出）。
4. 评审/AI/导出：右栏面板 + 顶栏导出按钮（保留现契约）。

## 设计令牌与组件规范

- 令牌沿用 rec/src/index.css（--bg/--panel/--surface/--surface-raised/--border*/--accent*/--text-*/--warn/--danger/--success/--text-mono）。
- 工具按钮 .tool-btn（32×32，hover/active 态）、滑块 .range-input、预设 .preset-btn、侧栏缩略图 .sidebar-thumb、元数据行 .meta-row 等类迁移。
- 字体本地化：Inter + JetBrains Mono（woff2 → public/fonts/ + @font-face）；滚动条 4px 细样式。
- 可访问性保留：role=alert/status、焦点圈定（DICOM 面板已有）、Esc 关闭、颜色+文字双通道状态。

## 设计约束

- 医疗界面不出现诊断/治疗暗示文案；测量明示"模拟测量，非临床"。
- 离线可用（无外部字体/CDN）；现有测试语义（getByRole/getByText 中文文案）尽量保持，减少回归改动。