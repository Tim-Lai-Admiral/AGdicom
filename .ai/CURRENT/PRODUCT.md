# Current Product

## Product statement

面向医疗 AI 研发团队的**素材整理与评审工作台**（Web 端）：浏览、筛选、比较、标注并整理图片、DICOM 与 3D 素材，形成可追溯的评审结论（含 JSON 导出）。定位为工程素材整理工具，不是临床阅片器。

## Target users

- 医疗 AI 研发团队中负责素材整理的工程师 / 研究员 / QA（算法研发前的数据准备环节）。
- 使用场景：素材入库 → 快速浏览筛选 → 逐项核验（图片质量、DICOM 元数据与去标识化、3D 模型可加载性）→ 打标签写备注 → 给出评审结论 → 导出可追溯评审记录。

## Product goals

- 三类素材（图片/DICOM/3D）统一导入、分类、浏览、筛选、状态标记。
- DICOM 素材展示可验证信息（元数据、series/切片数、去标识化标记、无压缩切片预览）。
- 3D 模型（STL）旋转/缩放/平移浏览。
- 标签、备注、评审历史持久化，评审结论 JSON 导出/导入（可追溯）。
- Mock AI 提供命名/标签/摘要建议（确定性、可验证、可拒绝）。

## Non-goals

- 完整 DICOM 阅片（窗宽窗位交互、MPR、测量）、压缩传输语法像素解码。
- 多人协同、权限体系、真实患者数据接入、任何临床结论生成。
- 后端服务与数据库（纯前端 + localStorage + JSON 备份）。

## Current scope

已进入主线（CR-001 + CR-002，v0.1.0）：

- 素材导入与分类（拖拽/文件选择，扩展名→image/dicom/model，去重，未知类型拒绝）
- 素材库网格、组合筛选（类型/状态/标签/搜索）、状态徽标、双图并排比较
- DICOM 识别：dicom-parser 元数据、series 分组切片数、去标识化检测、无压缩 Canvas 灰度预览、压缩/损坏降级"仅元数据"
- 3D 查看器：three.js STLLoader + OrbitControls（旋转/缩放/平移）、加载进度/错误重试/WebGL 降级、内置样本加载（4 个心脏 STL，lazy 加载按需拆包）
- 评审面板：状态/评审意见（追加式历史）、标签（自建+复用）、备注；JSON 导出/导入（schema v1，非法拒绝）
- Mock AI：AIProvider 接口 + 确定性规则建议 + AI_USAGE.md
- 内置样本：4 个心脏 STL（DEMO SET）+ pydicom 合成 DICOM 3 series×6 切片（去标识化）
- 协作与工程：CI（test/lint/build）、oxlint、Git 15 条规则、PR 工作流

## Last updated

- Date: 2026-09-05
- Source: CR-001 + CR-002
- Approved by: Human