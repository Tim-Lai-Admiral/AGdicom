# Requirements Delta: CR-004

## UI-003: 全部 UI 视觉与结构对齐 rec/（Figma Make 原型）

**Status**: approved

**Behavior**

```text
Given 任何界面元素
When 呈现于工作台
Then 遵循 rec/src/App.tsx + rec/src/index.css 的设计语言：
     44px 顶栏（tool-btn 图标、分隔线、preset chips、mono 读数）、
     左栏紧凑行（方形缩略图 + 两行文本 + 选中 accent 高亮）、
     右栏 section-header/meta-row
And 不使用旧设计的卡片容器、卡片评审按钮、徽标式状态按钮
```

**Acceptance criteria**

- [ ] 左栏素材为行式列表；无卡片容器/卡片评审按钮（grep 确认）
- [ ] 状态经"选中 → 右栏评审面板"修改，数据契约不变

## P-005: 测试分层要求（Human 2026-09-06，方案 A）

**Status**: approved

**Behavior**

```text
Given 任何任务
When 规划测试要求
Then 按层配置：
     核心层（domain/store/解析/解码/确定性规则）：全量测试保留，改动须配套测试
     UI 组件层：每组件 3~5 个关键交互测试；不新增纯文案存在性断言
     UI 视觉类任务（布局/样式重构）：只要求存量测试不回归 + 冒烟链路，不要求新增大量 UI 断言
And 存量同质化断言（文本存在性、跨层重复、实现细节）可裁剪，裁剪须在任务卡说明理由
```

**Acceptance criteria**

- [x] CR-004 T-002 完成同质化测试裁剪：实际基线 274（T-001 后 270）→ 裁 24 → **246**（2026-09-06 修正，原估 270→~246 有 -4 基线偏差，见 CHANGE.md Result）
- [x] 未来任务卡按此规则编写 Test requirements