# Requirements Delta: CR-003

## R-003 修改：DICOM 切片预览支持窗宽窗位调节

**Status**: approved（Human 2026-09-05）

**Behavior**

```text
Given 无压缩 DICOM 切片预览
When 用户调节 Center(C) / Width(W) 或选择预设（Lung/Mediastinum/Bone/Brain/Liver/S. Tissue）
Then 预览按 WC/WW 重新渲染（默认进入时自动 min-max，等价于当前行为）
Given 压缩/损坏传输语法
When 请求预览
Then 仍降级"仅元数据"（不回归）
```

**Acceptance criteria**

- [ ] `decodeDicomFrame(dataset, frameIndex, wc?, ww?)` 支持可选窗宽窗位，缺省自动 min-max（现有测试不回归）
- [ ] 面板滑杆（C:-1000..1000 / W:1..4000）与 6 预设按钮生效
- [ ] 压缩/损坏文件降级路径不变

## R-010 新增：测量工具（Mock 模式）

**Status**: approved（Human 2026-09-05）

**Behavior**

```text
Given 视口内启用"测量"工具
When 用户拖拽
Then 绘制测量线（两端点 + 距离标注），明示"模拟测量，非临床"
And 距离值：PixelSpacing 可用时按像素间距确定性计算；否则用与画布比例相关的 Mock 值
Given 再次拖拽
When 完成
Then 绘制第二条测量线（可多条，随切片/素材切换清空）
```

**Acceptance criteria**

- [ ] 测量线可绘制、可标注距离；界面与文档明示 Mock 性质
- [ ] PixelSpacing 存在时距离确定性计算（单测覆盖）
- [ ] 切换素材/切片清空测量（不泄漏到其他视图）

## UI-001: 全屏工作台布局

**Status**: approved

**Behavior**

```text
Given 打开应用
Then 呈现工作台布局：
     顶栏（类型筛选/搜索/导入/加载样本/导出/状态与 AI 入口）
     左栏（素材列表：图片/3D 资产卡片；DICOM 展开 series + 切片缩略图）
     中央（统一查看区：图片预览/双图比较、DICOM 切片预览、3D 查看器）
     右栏（DICOM 元数据分组面板 + W/L + 评审面板（状态/标签/备注/历史/AI 建议））
```

**Acceptance criteria**

- [ ] 现有功能全部可经新布局访问（导入/筛选/状态/比较/评审/AI/导出）
- [ ] 左栏 DICOM 素材可展开 series/切片缩略图并切换切片
- [ ] 窄屏下侧栏可折叠，不溢出

## UI-002: Tailwind v4 与深色设计令牌

**Status**: approved

**Behavior**

- 引入 `tailwindcss@4` + `@tailwindcss/vite`；主题令牌（`--bg/--panel/--surface/--accent/--text-*` 等）沿用 `rec/src/index.css`。
- 字体：Inter / JetBrains Mono **本地化**（woff2 入 `public/fonts/` + @font-face），不依赖 Google Fonts CDN（离线可用，R-009）。

**Acceptance criteria**

- [ ] `npm run build` 通过；离线启动字体正常（无外部请求）
- [ ] 现有 `styles.css` 样式迁移或按组件拆分，无死代码残留（抽查）

## 非目标（明确不做）

- 真实 MPR / 多平面重建、真实旋转重建、空间校准。
- 测量结果持久化、导出或临床结论生成。
- Figma 视觉 demo 的逐像素复刻（实现可用交互子集即可）。