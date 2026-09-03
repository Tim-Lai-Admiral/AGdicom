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
