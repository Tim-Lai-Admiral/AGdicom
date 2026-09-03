# Requirements Delta: CR-001

> 仅描述本 CR 新增的需求；`CURRENT/REQUIREMENTS.md` 目前为空模板，合并后由 Coordinator 同步。

## R-001: 素材导入与分类

**Status**: approved

**User / context**

素材评审人员将图片 / DICOM / 3D 文件放入工作台，系统按类型组织，便于统一浏览。

**Behavior**

```text
Given 用户拖拽或通过文件选择器提交一个或多个文件
When 文件扩展名属于 png/jpg/jpeg/gif/webp/bmp
Then 注册为 image 类型素材并出现在素材库

Given 提交 .dcm 文件
When 扩展名匹配
Then 注册为 dicom 类型素材

Given 提交 .stl/.obj/.glb/.gltf 文件
When 扩展名匹配
Then 注册为 model 类型素材

Given 提交未知扩展名
When 无法识别
Then 拒绝并提示支持的类型

Given 重复导入同一文件（同名称与大小）
When 注册
Then 提示已存在，不重复注册
```

**Acceptance criteria**

- [ ] 三种类型各至少一个样例可导入并正确分类。
- [ ] 未知扩展名有明确错误提示。
- [ ] 重复导入被识别并去重。

**Compatibility / constraints**

- 全部为浏览器端 File API，无需后端。

## R-002: 图片浏览、筛选、状态标记与简单比较

**Status**: approved

**User / context**

评审人员需要快速浏览图片素材、按条件过滤、标记状态，并并排比较两张图片以判断质量或内容差异。

**Behavior**

```text
Given 素材库中存在图片
When 按类型 / 状态 / 标签筛选或按名称搜索
Then 网格视图实时更新且保留其余筛选条件

Given 任一素材
When 用户设置状态（待评审 / 通过 / 驳回）
Then 状态徽标立即更新并持久化

Given 用户选中两张图片
When 点击"比较"
Then 进入并排比较视图，两张图片等尺寸并排显示，可退出
```

**Acceptance criteria**

- [ ] 每种筛选条件与组合均正确生效。
- [ ] 状态变更刷新后仍保留（持久化）。
- [ ] 比较视图可进入、可退出，双图同时可见。

**Compatibility / constraints**

- 无外部依赖。

## R-003: DICOM 基本识别与可验证信息展示

**Status**: approved

**User / context**

评审人员需要确认 DICOM 素材的来源、序列信息与去标识化状态，不要求完整阅片。

**Behavior**

```text
Given 导入一个或多个 .dcm 文件
When 用户打开 DICOM 详情
Then 展示：Modality、SOP Class、Transfer Syntax、Rows/Columns、PixelSpacing、
     SeriesInstanceUID、PatientName/PatientID（或"已置空"提示）
And 按 SeriesInstanceUID 分组统计切片数
And 检测并展示去标识化标记：PatientIdentityRemoved(0012,0062)、
     DeidentificationMethod(0012,0063)、患者字段为空

Given 像素数据为无压缩传输语法（Explicit/Implicit VR Little Endian）
When 用户请求预览
Then Canvas 以 min-max 灰度渲染所选切片

Given 传输语法为压缩编码或文件无法解析
When 用户请求预览
Then 显示"仅元数据"提示，不崩溃，其余元数据仍可展示
```

**Acceptance criteria**

- [ ] 合成样本系列正确显示切片数（≥2 切片）与去标识化标记。
- [ ] 无压缩文件可渲染单切片灰度预览。
- [ ] 损坏/压缩文件优雅降级，应用不崩溃。

**Compatibility / constraints**

- 使用 dicom-parser 纯 JS 解析；仅支持浏览器内可解析的传输语法。

## R-004: 3D 模型加载与交互

**Status**: approved

**User / context**

评审人员需要确认 3D 模型可正常加载、结构完整可观察。

**Behavior**

```text
Given 导入或选择 .stl 文件（含 14MB 级大文件）
When 用户打开 3D 查看器
Then 模型渲染显示，加载期间显示进度

Given 模型已渲染
When 用户拖拽 / 滚轮 / 右键拖拽
Then 支持旋转、缩放、平移（OrbitControls）

Given 文件损坏或格式不支持
When 加载
Then 显示明确错误提示并可重试
```

**Acceptance criteria**

- [ ] 4 个内置 STL 均可在 3D 查看器中渲染。
- [ ] 旋转 / 缩放 / 平移三项交互可用。
- [ ] 损坏文件有错误提示且不崩溃。

**Compatibility / constraints**

- three.js + STLLoader；GLTF/OBJ 为可选扩展，不阻塞核心交付。

## R-005: 标注与评审结论的持久化与导出

**Status**: approved

**User / context**

评审人员需要给素材打标签、写备注、给出结论，并导出可追溯的评审记录。

**Behavior**

```text
Given 任一素材
When 用户添加/移除标签（支持自建）、填写备注、设置评审状态并填写评审意见
Then 记录保存，含操作时间戳与评审历史（多次评审保留）

Given 用户点击"导出"
When 生成 JSON
Then 包含：素材清单（名称/类型/来源信息）、每条素材的标签/备注/状态/评审历史/时间戳、导出时间与 schema 版本

Given 用户点击"导入"
When 选择此前导出的 JSON
Then 恢复素材与评审结论（名称冲突时提示）
```

**Acceptance criteria**

- [ ] 标签、备注、状态、评审历史全部持久化（刷新不丢）。
- [ ] 导出 JSON 可被重新导入并还原。
- [ ] 导出文件含 schema 版本与时间戳（可追溯）。

**Compatibility / constraints**

- localStorage 存储，容量限制内工作；导出 JSON 为权威备份手段。

## R-006: Mock AI 建议能力

**Status**: approved

**User / context**

题目要求 AI 辅助环节可验证、可修改、可拒绝；真实 AI 非必需。

**Behavior**

```text
Given 用户打开任一素材的"AI 建议"面板
When Mock 模式开启（默认开启）
Then 基于素材元数据生成确定性建议：
     - 命名建议（如 DICOM: 序列号+切片数；STL: 文件名规范）
     - 标签建议（基于类型/元数据规则）
     - 摘要（素材关键信息一句话概述）

Given 用户点击"采纳"
When 建议应用
Then 命名建议填入名称、标签建议合并入标签

Given 用户点击"忽略"或手动编辑
When 未采纳
Then 不产生任何变更，界面明示为 Mock 生成
```

**Acceptance criteria**

- [ ] Mock 建议确定性（同素材重复生成结果一致）。
- [ ] 采纳/忽略均可，忽略后无副作用。
- [ ] 界面与 AI_USAGE.md 均明确标注 Mock 模式及其验证/修改/拒绝方式。

**Compatibility / constraints**

- 纯规则实现，无网络调用、无 API Key；预留 `AIProvider` 接口便于未来接入真实服务。

## R-007: 样本素材与来源记录

**Status**: approved

**User / context**

题目要求使用 `../DEMO SET/stl/` 的 STL，并要求 DICOM 样本来源、格式、获取方式、使用范围记录在 README。

**Behavior**

```text
Given 交付仓库
When 用户查看 public/samples/stl/
Then 包含 4 个心脏 STL：aorta.stl、CB.stl、LA.stl、LVOT.stl（来源 ../DEMO SET/stl/，本作业自带素材）

Given 用户查看 public/samples/dicom/
Then 包含 pydicom 脚本生成的多切片 phantom 系列（≥2 个 series，带去标识化标记）

Given 用户阅读 README.md 素材章节
Then 可了解：STL 来源路径与使用范围；DICOM 样本生成方式、去标识化声明、
     以及 TCIA 等公开真实样本的获取指引（许可与使用注意事项）
```

**Acceptance criteria**

- [ ] 4 个 STL 在仓库中且可由应用直接加载。
- [ ] 合成 DICOM 系列可被应用识别为多切片 series 并显示去标识化标记。
- [ ] README 素材章节完整（来源/格式/获取方式/使用范围）。

**Compatibility / constraints**

- 合成 DICOM 为程序生成，不含任何真实患者信息；STL 仅用于本作业演示。

## R-008: 交付文档（README.md / AI_USAGE.md）

**Status**: approved

**User / context**

题目要求 README 说明定位、功能、技术栈、安装、启动、素材来源、已知问题；AI 参与环节单独说明。

**Behavior**

```text
Given 用户阅读 README.md
Then 可获取：产品定位、核心功能、技术栈、安装方式、启动命令、
     DICOM 素材来源与使用方式、已知问题

Given 用户阅读 AI_USAGE.md
Then 可获取：AI 参与环节（命名/标签/摘要）、Mock 模式说明、
     如何验证/修改/拒绝 AI 输出、未来接入真实 AI 的边界
```

**Acceptance criteria**

- [ ] 按 README 步骤（npm install + npm run dev）可在干净环境启动。
- [ ] 两个文档内容与实现一致，无虚构功能。

**Compatibility / constraints**

- 文档语言为中文。

## R-009: 纯前端可运行性与 Mock 边界

**Status**: approved

**User / context**

题目允许本地 JSON/浏览器存储，不要求后端；外部服务需 Mock 模式。

**Behavior**

```text
Given 完成构建的应用
When 无后端、无外部 API Key、离线运行
Then 核心流程（导入→浏览→核验→标注→评审→导出）全部可用
```

**Acceptance criteria**

- [ ] 核心流程不依赖任何外部服务。
- [ ] 若引入新外部依赖，须先补充 Mock 与文档，并经 Human 批准。

**Compatibility / constraints**

- 浏览器需支持 File API、Canvas、localStorage（现代浏览器即可）。