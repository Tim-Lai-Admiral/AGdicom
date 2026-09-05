# Current Requirements

> 已批准并进入主线（CR-001 + CR-002，2026-09-05 合并）。需求正文与验收细节见 CR-001 / CR-002 的 REQUIREMENTS.md，此处为索引与状态。

## Requirement index

| ID | Requirement | Status | Source |
|---|---|---|---|
| R-001 | 素材导入与分类 | active | CR-001 |
| R-002 | 图片浏览、筛选、状态标记与简单比较 | active | CR-001 |
| R-003 | DICOM 基本识别与可验证信息展示 | active | CR-001 |
| R-004 | 3D 模型加载与交互 | active | CR-001 |
| R-005 | 标注与评审结论的持久化与导出 | active | CR-001 |
| R-006 | Mock AI 建议能力 | active | CR-001（CR-002 承接） |
| R-007 | 样本素材与来源记录 | active | CR-001（CR-002 承接） |
| R-008 | 交付文档（README.md / AI_USAGE.md） | active | CR-001（CR-002 承接） |
| R-009 | 纯前端可运行性与 Mock 边界 | active | CR-001 |
| P-001 | 任务卡 Context pack 与预期步数规范 | active | CR-002 |
| P-002 | 极简派发 prompt（≤300 字符，只载增量） | active | CR-002 |
| P-003 | Builder 信息不足时 BLOCKED-信息不足 上报 | active | CR-002 |
| P-004 | Git 规则 15 条（全文见 .ai/AGENTS.md §6） | active | CR-002 |

## Requirements

### R-001: 素材导入与分类

**Behavior**: 拖拽/文件选择导入；扩展名映射（png/jpg/jpeg/gif/webp/bmp→image；dcm→dicom；stl/obj/glb/gltf→model）；去重（名称+大小+类型）；未知类型拒绝；大文件异步。

### R-002: 图片浏览、筛选、状态标记与简单比较

**Behavior**: 网格视图；类型/状态/标签/搜索组合筛选（AND，即时生效）；状态徽标（待评审/通过/驳回，颜色+文字）；双图并排比较（Esc 退出）；空态引导。

### R-003: DICOM 基本识别与可验证信息展示

**Behavior**: 元数据面板（Modality/SOP/传输语法/Rows/Columns/PixelSpacing/SeriesInstanceUID/患者字段）；按 series 分组切片数；去标识化检测（0012,0062/0063 + 患者字段空）；无压缩像素 min-max 灰度切片预览；压缩/损坏降级"仅元数据"不崩溃。

### R-004: 3D 模型加载与交互

**Behavior**: STL 加载（含 14MB 级）；旋转/缩放/平移（OrbitControls）；加载进度/错误重试/WebGL 降级；卸载释放；内置样本加载入口。

### R-005: 标注与评审结论的持久化与导出

**Behavior**: 标签（自建+复用）、备注、评审状态与意见；追加式历史（时间戳留痕）；JSON 导出（schema v1，含 exportedAt）/导入（非法拒绝、冲突确认）；刷新保留。

### R-006: Mock AI 建议能力

**Behavior**: 命名/标签/摘要建议（确定性规则）；采纳（填名/合并标签）/忽略（零副作用）；Mock 明示；异常降级；AI_USAGE.md 说明验证/修改/拒绝方式。

### R-007: 样本素材与来源记录

**Behavior**: 内置 4 个心脏 STL（DEMO SET，来源/使用范围见 README）与 pydicom 合成 DICOM 3 series×6 切片（去标识化标记齐全）；README 素材章节记录来源/格式/获取方式/使用范围 + TCIA 指引。

### R-008: 交付文档（README.md / AI_USAGE.md）

**Behavior**: README（定位/功能/技术栈/安装/启动/素材来源/已知问题，与实现一致）；AI_USAGE.md（AI 参与环节、Mock 说明、验证/修改/拒绝）。

### R-009: 纯前端可运行性与 Mock 边界

**Behavior**: 无后端、无外部 API Key、离线可运行；核心流程（导入→浏览→核验→标注→评审→导出）全可用；新外部依赖须经 Human 批准并补 Mock 与文档。

### P-001: 任务卡 Context pack 与预期步数规范

**Behavior**: 任务卡含 Context pack 段（R-ID、关键契约路径、参考模式、禁止项指针）；Metadata 含 expected_steps。

### P-002: 极简派发 prompt

**Behavior**: 派发 prompt ≤300 字符（任务ID + 分支 + 卡片外增量事实），不复述卡片/ENVIRONMENT/agent 提示词内容。

### P-003: Builder 信息不足兜底

**Behavior**: 信息不足时按 BLOCKED-信息不足 报告所需清单，不得猜测。

### P-004: Git 规则（15 条）

**Behavior**: 全文见 `.ai/AGENTS.md` §6：main 为可接受状态；禁直接 push main；每 Task 独立分支；分支名含 CR+Task ID；Builder 可多 commit；完成后建 PR（body 含概要）；Reviewer 审 PR；CI 自动 test/lint/build；Reviewer 独立验证；Human 最终 Merge；合并后删分支；重大版本 Tag；需求/架构历史归 CR 而代码历史归 Git；禁为跑通改 Requirement；Conflict 显式解决。

**Source**: CR-001 / CR-002  
**Last updated**: 2026-09-05