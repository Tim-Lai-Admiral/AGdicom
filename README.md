# 素材评审工作台 (Asset Review Workbench)

纯前端素材评审工作台（Vite + React + TypeScript）：支持图片 / DICOM / 3D 模型素材的导入、查看、评审与 AI 建议占位。

## 项目定位

面向素材整理与评审场景的**本地单机工作台**：导入素材 → 浏览筛选 → 查看（图片预览与并排比较 / DICOM 视口切片与四角元数据 / 3D 模型）→ 打标与状态评审 → 导出 JSON 备份。全部数据保存在浏览器本地（localStorage + IndexedDB），**无后端、无账号、不上传任何素材**。

## 功能一览

- **工作台布局（CR-003 / CR-009）**：全屏四区工作台——顶栏（视口工具组 / 筛选 / 搜索 / 导入 / 比较 / 导出 / 面板开关，其中「导入」「比较」为汉字文字按钮，CR-011）+ 左栏素材列表（DICOM 卡片可展开 series 切片缩略图）+ 中央统一查看区 + 右栏信息面板（DICOM 显示元数据分组与 W/L 调节，其余素材显示评审面板；左右栏抽屉式开合，0.2s 宽度过渡动画，窄屏侧栏收窄，R-026）。
- **导入**：拖拽或选择文件；支持图片（png/jpg/jpeg/gif/webp/bmp）、DICOM（dcm）、3D 模型（stl/obj/glb/gltf）；按文件名 + 大小 + 类型去重；未知类型明确提示；大文件导入有进度提示。
- **素材库**：单列卡片列表（名称 / 类型 / 大小 / 状态）；类型 / 状态 / 标签 / 关键字搜索组合筛选（顶栏筛选组）；标签（内置 + 自建）。
- **删除素材（CR-006）**：选中行（比较选中或工作台当前素材）显示行内「删除」按钮，内联二次确认后删除；级联清理素材记录、评审历史与本地二进制库（R-015）。
- **本地预览持久化（CR-006）**：≤20MB 的图片 / DICOM / 3D 模型文件字节存入 IndexedDB，刷新后自动恢复预览（无需重新导入）；>20MB 文件不入库（导入时提示），刷新后可重新导入（自动水合恢复预览）或删除该素材。
- **视口工具组（CR-009 / R-024）**：顶栏图标按钮 pan（拖拽平移）/ zoom（拖拽或 Ctrl+滚轮缩放）/ window（拖拽调 C/W，仅 DICOM）/ rotate（拖拽旋转）/ measure（拖拽绘制测量线，仅 DICOM）；中央为 DICOM 或图片素材时显示，图片素材不支持 window/measure（禁用态）；激活工具与视口行为一致（aria-pressed）。
- **图片预览与比较（CR-011 / R-002）**：单张图片预览支持视口工具 pan/zoom/rotate（CR-009 / R-024）；比较为显式模式——普通模式点击图片行 = 中央查看；顶栏「比较」汉字按钮进入比较模式后，素材库先筛选出可比较的图片（非图片素材隐藏）并提示选择，显式点选两张（上限两张，先选在左）自动并排比较；退出比较模式（「退出比较」/ Esc / 顶栏「完成」）清空选择并恢复普通列表与查看交互。
- **DICOM 查看器（CR-009）**：视口四角元数据覆盖层（左上患者/ID/文件名、右上模态·传输语法与 Inst #N/M、左下 C/W 与像素间距、右下缩放/旋转/平面；半透明等宽字体，随切片与窗宽窗位实时更新，R-023）；中央元数据表格已下线，右栏「DICOM 元数据」分组面板（患者/序列/图像/去标识化，可折叠）为唯一元数据来源（R-023）；按 SeriesInstanceUID 聚合并按 InstanceNumber 排序的多切片切换（底部滑条 + 视口滚轮双向同步、首末片钳制；Ctrl+滚轮为缩放，R-025）；Canvas 灰度预览（默认自动 min-max 归一化，右栏可调窗宽窗位：滑杆 + 6 预设 + 自动复位，R-003 修改）；测量工具 Mock（拖拽绘制 + 距离标注，明示「模拟测量，非临床」，不持久化，R-010；入口在顶栏工具组、清空在视口右上小控件）；压缩语法 / 损坏文件 / 刷新后等多种降级路径不崩溃；工作台中央查看区内嵌（非模态），打开时聚焦、关闭后焦点还原。
- **3D 模型查看器**：STL 解析（分块读取 + 进度）；three.js 渲染（相机自动 fit 包围盒）；OrbitControls 默认映射（左键旋转 / 滚轮缩放 / 右键平移）；WebGL 不可用与损坏文件降级；查看器代码按需加载（React.lazy，TD-002）。
- **评审**：状态流转（待评审 → 通过 / 驳回）+ 评审历史留痕 + 备注；标签标注；全部持久化（刷新后保留）。
- **导出 / 导入备份**：JSON 全量备份导出下载；导入前深度校验与冲突确认，损坏 / 不兼容备份拒绝并提示。
- **AI 建议（占位）**：本地 mock 生成命名建议等，仅用户点击"采纳"才生效，绝不自动修改。
- **内置样本**（已随 CR-005 / R-011 移除）：一键加载 4 个 STL 心脏模型的功能已删除；合成 DICOM 样本见下方素材章节。

## 环境要求

- Node.js LTS（>= 20）
- npm（随 Node.js 附带）
- （可选）Python 3 + pydicom：仅重新生成合成 DICOM 样本时需要

## 安装与启动

```bash
npm install     # 安装依赖
npm run dev     # 启动本地开发服务器
npm run build   # 类型检查并构建产物到 dist/
npm run preview # 本地预览构建产物
npm test        # 运行单元测试 (vitest)
```

- 纯前端离线可用：构建 / 预览不依赖任何外部网络资源。
- 全量验证（测试 + 构建）一键执行：

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
  ```

- 端到端验收清单见根目录 [E2E-CHECKLIST.md](./E2E-CHECKLIST.md)。

## 技术栈

- Vite 8 + React 19 + TypeScript 6（strict 模式）
- Tailwind CSS v4（样式基础设施：深色设计令牌 + 基础组件类 + 字体本地化，CR-003 / UI-002）
- three.js（3D 模型查看；经 React.lazy + dynamic import 拆分为独立 chunk，按需加载）
- dicom-parser（DICOM 元数据解析）
- vitest 5（jsdom）+ @testing-library/react（单元 / 集成测试）
- 持久化：localStorage（素材记录 / 标签 / 评审历史）+ IndexedDB（≤20MB 文件字节，CR-006）

## 素材样本（public/samples/）

> 注：内置 STL 样本已随 CR-005（R-011）移除，STL 现仅经文件选择导入。

### 合成 DICOM（public/samples/dicom/）

- **来源 / 生成方式**：由 `scripts/generate_sample_dicom.py`（pydicom）程序化合成，非真实采集数据。重新生成：

  ```bash
  python -m pip install pydicom   # 首次需要
  python scripts/generate_sample_dicom.py
  ```

  脚本可重复运行且幂等（UID 固定、图案确定性，输出字节级一致）。
- **格式 / 内容**：3 个 series × 每系列 6 切片，共 18 个 `.dcm` 文件（128×128 8-bit 灰度 phantom，无压缩显式小端传输语法，含 Modality / SeriesInstanceUID / InstanceNumber / PixelSpacing 等标签）：
  - `phantom-ct-01..06.dcm`（CT，PixelSpacing 1.0mm）
  - `phantom-mr-01..06.dcm`（MR，PixelSpacing 0.8mm）
  - `phantom-ct2-01..06.dcm`（CT 薄层，PixelSpacing 0.5mm）
- **去标识化声明**：全部像素均为确定性数学 phantom，不含任何真实患者信息；每个文件均带 `(0012,0062) PatientIdentityRemoved = YES`、`(0012,0063) DeidentificationMethod`，且 `PatientName` / `PatientID` 置空。
- **使用范围**：仅用于本工作台的多切片 series 识别、切片切换与去标识化展示功能演示。

### 真实公开样本获取指引（TCIA）

如需用真实影像测试，可从 [TCIA（The Cancer Imaging Archive）](https://www.cancerimagingarchive.net/) 获取公开、已去标识化的数据集（如 NSCLC-Radiomics 等）。下载后导入本工作台前请注意：

- 遵守各数据集附带的许可条款（多数为 TCIA License / CC BY 类）；
- TCIA 数据已做去标识化处理，但使用时仍不应尝试再识别个人；
- 本工作台为纯前端本地评审工具，导入的素材仅存在于浏览器本地（localStorage + IndexedDB），不会上传；真实样本同样只应用于评审流程演示，不得用于临床用途。

## 已知问题

如实记录当前实现的限制（截至 CR-006 T-004）：

1. **大于 20MB 的文件字节不持久化**（TD-001 已随 CR-006 解决：≤20MB 文件字节入 IndexedDB，刷新自动恢复预览）：≤20MB 的图片 / DICOM / 3D 模型刷新后无需重新导入；>20MB 或 IndexedDB 不可用的素材刷新后仅剩持久化记录，需重新导入（重导入自动水合恢复预览）或删除该素材；DICOM 元数据已持久化，刷新后仍可在右栏元数据面板查看。
2. **DICOM 压缩传输语法不解码像素**：JPEG / JPEG 2000 / RLE Lossless / Explicit VR Big Endian 等仅展示元数据并提示"仅元数据"；无压缩（Explicit / Implicit VR Little Endian）可正常预览。
3. **3D 预览仅支持 STL**：obj / glb / gltf 可导入并归为 3D 模型类素材，但查看器解析会失败并显示可读错误（重试无济于事，属预期降级）。
4. **localStorage 容量有限**（通常约 5MB）：素材记录 / 评审历史过多时保存可能失败，界面会提示"刷新后可能无法保留"；文件字节不落库以缓解但不消除该限制。
5. **AI 建议为 mock 占位**：本地规则生成，无真实模型调用；仅命名建议可用。
6. **焦点圈定仅 DICOM 查看器实现**：CR-003 T-002 起查看器 / 比较视图为工作台中央查看区的内嵌视图（非模态，T-004 起不再声明 aria-modal）；仅 DICOM 查看器实现 Tab 焦点圈定与关闭后焦点还原，其余视图（3D 查看器 / 图片比较 / 评审面板）为"打开时聚焦 + Esc/按钮关闭"，尚无 Tab 循环圈定。
7. **WebGL 交互未自动化**：3D 查看器的旋转 / 缩放 / 平移交互依赖真机 WebGL，自动化测试仅覆盖降级路径（见 E2E-CHECKLIST.md 中的人工项）。
8. **CR-003 / CR-009 走查遗留（非阻塞，详见 `.ai/TODO.md` TD-003 / TD-008）**：① 一次 Esc 会同时关闭中央 DICOM 查看器与右栏评审面板（TD-003）；② 视口旋转（rotate 工具拖出角度）时测量落点换算失真，测量线端点可能偏离光标落点（TD-008，仅影响 rotate ≠ 0 时的绘制位置；距离计算与平移 / 缩放下的表现不受影响）。原 TD-004（视口角标覆盖层未接线）与 TD-005（切片切换无滚轮交互）已随 CR-009 T-001 解决（R-023 / R-025）。

## 项目文档

- 协作协议与架构决策：`.ai/`（CURRENT 为项目文档事实源）
- 需求 / 变更记录：`.ai/CHANGES/`（CR-001 ~ CR-009）
- CR-003 走查记录：[`.ai/CHANGES/CR-003-ui-redesign/WALKTHROUGH.md`](./.ai/CHANGES/CR-003-ui-redesign/WALKTHROUGH.md)（对照 rec/ 参考与 DESIGN.md 的逐项结论与遗留登记）
