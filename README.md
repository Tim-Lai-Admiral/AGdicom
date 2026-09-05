# 素材评审工作台 (Asset Review Workbench)

纯前端素材评审工作台（Vite + React + TypeScript）：支持图片 / DICOM / 3D 模型素材的导入、查看、评审与 AI 建议占位。

## 环境要求

- Node.js LTS（>= 20）
- npm（随 Node.js 附带）

## 安装与启动

```bash
npm install     # 安装依赖
npm run dev     # 启动本地开发服务器
npm run build   # 类型检查并构建产物到 dist/
npm run preview # 本地预览构建产物
npm test        # 运行单元测试 (vitest)
```

> 说明：以上为脚手架阶段占位命令，详细使用说明将在功能任务完成后补充。

## 技术栈

- Vite + React 19 + TypeScript（strict 模式）
- three.js（3D 模型查看，后续任务接入）
- dicom-parser（DICOM 元数据解析，后续任务接入）
- vitest + jsdom + @testing-library/react（单元测试）

## 素材样本（public/samples/）

### STL 3D 模型（public/samples/stl/）

- **来源**：`../DEMO SET/stl/`（本作业自带素材，随仓库分发）：`aorta.stl`、`CB.stl`、`LA.stl`、`LVOT.stl`，共 4 个心脏二进制 STL 模型。
- **格式**：二进制 STL（无纹理/颜色）。
- **使用范围**：仅用于本工作台的功能演示与评审流程验证（加载、预览、评审记录）；不得用于临床用途或对外再分发。

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
- 本工作台为纯前端本地评审工具，导入的素材仅存在于浏览器本地（localStorage），不会上传；真实样本同样只应用于评审流程演示，不得用于临床用途。
