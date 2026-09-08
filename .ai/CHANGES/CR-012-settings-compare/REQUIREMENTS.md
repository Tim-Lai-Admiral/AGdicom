# Requirements Delta: CR-012

## R-027: 设置弹窗与 API 配置

**Status**: approved

**Behavior**

```text
Given 顶栏「设置」按钮
When 用户点击
Then 弹出设置弹窗（Esc/关闭按钮可关）：
     API 配置：Base URL（文本）、API Key（密码框）、启用开关、失败回退 Mock 开关
     「保存」→ localStorage 持久化（独立 key，如 ag-review-workbench:settings，不随素材导出）
Given 已保存配置
When 应用刷新
Then 设置恢复
```

**Acceptance criteria**

- [ ] 设置弹窗可用、Esc/关闭可关；保存持久化；刷新恢复
- [ ] 配置不进入导出 JSON（io.ts 不动）

## R-028: AI 真实 API 接入（回退 Mock）

**Status**: approved

**Behavior**

```text
Given 启用真实 API 且配置完整
When AiPanel 请求建议
Then 远程 provider 调用 HTTP（baseURL + key 鉴权），成功 → 展示真实建议并明示来源「真实 API」
Given 未启用 / 配置缺失 / 请求失败或超时
When 请求建议
Then 自动回退 MockProvider（明示「Mock」），不崩溃
```

**Acceptance criteria**

- [ ] 远程 provider 实现 AIProvider 接口；请求超时/非 2xx/解析失败 → 回退
- [ ] 配置为空的「启用」不生效（提示）
- [ ] 界面明示建议来源（真实 API / Mock）；单测覆盖回退

## R-029: DICOM 双系列比较

**Status**: approved

**Behavior**

```text
Given 比较模式选择两个 DICOM 素材（各属一个系列，可同患者不同系列）
When 用户选择两个 dicom 素材
Then 进入双窗口比较：左=系列 A，右=系列 B，各窗口渲染所属系列切片（四角/工具/W-L 沿用现有查看器）
And 切片切换（滑动条/滚轮）双向同步：左窗滚动 → 右窗同步同序号切片（按 InstanceNumber 对齐）
And 每窗 W/L 独立（可同步，默认独立）；平移/缩放/旋转同步
```

**Acceptance criteria**

- [ ] 选择两个 dicom 素材可进入比较（比较模式筛选扩展：image+dicom+model）
- [ ] 双窗切片按 InstanceNumber 对齐同步（滚轮/滑条任一侧驱动两侧）
- [ ] W/L 独立可调；pan/zoom/rotate 同步
- [ ] 降级（压缩/损坏）不崩溃；退出清理

## R-030: STL 双模型比较

**Status**: approved

**Behavior**

```text
Given 比较模式选择两个 model（STL）素材
When 用户选择两个模型
Then 双窗口并排渲染两模型（three.js，各自 fit）
And 旋转/平移/缩放（OrbitControls 或共享变换）同步作用于两窗口
```

**Acceptance criteria**

- [ ] 两 STL 并行渲染（含 14MB 大文件懒加载/进度）
- [ ] 任一侧拖拽旋转/平移/滚轮缩放 → 另一侧同步
- [ ] 加载失败/降级不崩溃；退出清理（dispose）

## 非目标

- 图片比较改造；测量 API；MPR。