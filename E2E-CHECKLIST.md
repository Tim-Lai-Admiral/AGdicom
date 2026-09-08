# E2E 验收清单 — AGdicom 素材评审工作台

> 全链路：导入 → 浏览 → 比较 → DICOM → 3D → 标注 → 评审 → 导出 → AI 建议。
>
> **执行说明（CR-002 T-010）**：本清单随 T-010 执行。核心流程由自动化测试覆盖
> （`scripts\verify.ps1`：vitest 5 全量 + TypeScript 构建，本轮全绿），另加 `npm run preview`
> 构建产物冒烟。条目标注验证方式；**标注「人工」的条目**（真机 WebGL 交互、视觉观感）
> 自动化无法覆盖，留待浏览器人工复核，其余均已验证。
>
> 图例：`[x]` 已验证（附验证方式）｜`[ ]` 待人工浏览器复核

## 1. 导入

- [x] 拖拽三类文件（图片 / DICOM / STL）全部注册并显示「成功导入」提示 —— App.test.tsx「imports dropped files of all three kinds…」
- [x] 重复导入同一文件：提示「已存在，跳过」，不重复注册 —— 同上
- [x] 未知扩展名：明确报错且不注册 —— 同上
- [x] 一键加载内置 STL 样本（4 个心脏模型）→ 成功导入并可去重 —— App.test.tsx「loads built-in STL samples…」
- [x] 内置样本文件经本地服务可访问（`public/samples/stl/` × 4）—— preview 冒烟：HTTP 200
- [x] 合成 DICOM 样本可访问（`public/samples/dicom/` 18 个 .dcm）—— preview 冒烟：HTTP 200；多文件导入管线由 useImport.test.tsx 覆盖
- [x] 大文件（LA.stl ≈ 14MB）导入期间出现「正在处理较大文件」提示 —— useImport.test.tsx
- [x] localStorage 不可用时导入仍可用并提示「刷新后无法保留」—— repository.test.ts + App.test.tsx

## 2. 浏览与筛选

- [x] 卡片网格展示名称 / 类型 / 大小 / 状态徽标 —— App.test.tsx、AssetGrid.test.tsx、StatusBadge.test.tsx
- [x] 类型筛选 + 搜索组合（大小写不敏感）+ 清空筛选 —— App.test.tsx「filters the grid by kind and search…」
- [x] 空素材库与「无符合条件」空态提示 —— 同上
- [x] 比较显式模式（CR-011 / R-002）：顶栏「比较」汉字按钮进入比较模式 → 素材库筛选出可比较图片（非 image 行与 DICOM 患者分组面板隐藏）+「选择两张图片进行比较（已选 X/2）」提示条 —— App.scenarioMatrix.test.tsx 比较显式模式场景 + App.test.tsx「enters compare mode via the toolbar…」（CR-011 T-003）
- [x] 显式选择满两张自动并排比较（先选在左）；比较内可取消重选 —— 同上 + App.test.tsx「supports cancel within compare mode…」
- [x] 退出比较（「退出比较」按钮 / Esc / 顶栏「完成」）：清空选择、恢复完整列表与普通模式行点击查看语义 —— 同上 + App.test.tsx
- [x] 无可比较图片素材时「比较」入口禁用 —— App.test.tsx「keeps the compare entry disabled…」

## 3. DICOM 查看

- [x] 点击 DICOM 卡片打开弹层；「关闭」按钮与 Esc 均可关闭 —— DicomViewer.test.tsx + App.test.tsx
- [x] 视口四角元数据覆盖层（患者/ID/文件名、模态·传输语法、Inst #N/M、C/W 与 PixelSpacing、Zoom/Rot/平面）；中央元数据表格已下线，右栏「DICOM 元数据」分组面板为唯一元数据来源 —— DicomViewer.test.tsx「parses files…」+ App.scenarioMatrix.test.tsx（CR-009 T-001 / R-023）
- [x] 按 SeriesInstanceUID 聚合统计切片数；乱序文件按 InstanceNumber 排序（#1/#2/#3）—— 同上
- [x] 切片切换（底部滑条 + 视口滚轮 + 左栏缩略图，边界钳制不溢出）—— DicomViewer.test.tsx「switches slices…」「ignores out-of-bound…」+ App.scenarioMatrix.test.tsx 滚轮↔滑条同步（CR-009 T-001 / R-025）
- [x] Canvas 灰度预览（min-max 归一化：最小→0，最大→255）—— DicomViewer.test.tsx + decodePixel.test.ts
- [x] 压缩传输语法（JPEG）降级「仅元数据」，不崩溃 —— DicomViewer.test.tsx
- [x] JPEG 2000 传输语法文案精确区分（.90 无损 / .91）—— DicomViewer.test.tsx「labels JPEG 2000…」（T-010 修复）
- [x] 损坏文件：可读错误「无法解析该 DICOM 文件…」+ 汇总降级提示 —— 同上
- [x] 刷新后（无会话字节）：持久化元数据仍展示，预览提示需重新导入 —— 同上
- [x] 弹层 Tab 焦点圈定（Shift+Tab 末→首、Tab 首→末循环）—— DicomViewer.test.tsx「traps Tab focus…」（T-010 修复）
- [x] 关闭弹层后焦点还原到打开前触发元素 —— DicomViewer.test.tsx「restores focus…」（T-010 修复）
- [x] 解析出的元数据回写素材并持久化（刷新后仍可展示）—— App.test.tsx「opens the DICOM viewer…」

## 4. 3D 查看

- [x] 点击 STL 卡片打开查看器（React.lazy 按需加载，首帧等待 fallback 不报错）—— App.test.tsx「loads built-in STL samples…」（T-010 TD-002）
- [x] 构建产物中 three.js 为独立 chunk，主包不含 three —— `npm run build` 产物检查（见清单下方记录）
- [x] 分块读取进度（大文件「后台读取」提示）—— useModelLoader.test.ts
- [x] 损坏 / 空 STL：错误提示 + 重试按钮；重试成功恢复 —— useModelLoader.test.ts + Model3DViewer.test.tsx
- [x] 刷新后无会话内容：提示「需重新导入」不崩溃 —— Model3DViewer.test.tsx
- [x] WebGL 不可用环境：降级提示（非白屏），Esc / 关闭可用 —— App.test.tsx + Model3DViewer.test.tsx
- [ ] **（人工）** 真机 WebGL：左键拖拽旋转 / 滚轮缩放 / 右键平移、相机自动 fit、多次开关不泄漏 —— jsdom 无 WebGL，自动化不可覆盖

## 5. 标注（标签）

- [x] 评审面板添加内置 / 自建标签并持久化 —— ReviewPanel.test.tsx + review.test.ts
- [x] 移除标签（自建标签同步从注册表移除）—— 同上
- [x] 刷新后标签保留并可筛选 —— Filters.test.tsx + repository.test.ts

## 6. 评审

- [x] 状态徽标点击流转（待评审 → 通过 / 驳回）并持久化 —— App.test.tsx「updates the status via the badge…」
- [x] 提交评审追加历史留痕（时间倒序展示）—— ReviewHistory.test.tsx
- [x] 备注保存并持久化 —— ReviewPanel.test.tsx
- [x] 评审面板 Esc / 关闭按钮关闭 —— ReviewPanel.test.tsx
- [x] 保存失败（存储不可用）时提示且会话内变更仍有效 —— App.tsx commit 降级路径 + repository.test.ts

## 7. 导出 / 导入备份

- [x] 导出 JSON 全量备份（素材 / 标签 / 评审历史）—— ExportImport.test.tsx
- [x] 导入前深度校验；损坏 / 不兼容备份拒绝并提示 —— io.test.ts + ExportImport.test.tsx
- [x] 冲突确认后整体替换当前状态 —— ExportImport.test.tsx + App.test.tsx

## 8. AI 建议（占位）

- [x] 评审面板展示 AI 建议区（本地 mock，无网络请求）—— AiPanel.test.tsx + mockProvider.test.ts
- [x] 采纳命名建议：仅用户点击后重命名并持久化，绝不自动改名 —— ReviewPanel.test.tsx
- [x] 建议生成失败 / 无建议时的降级展示 —— AiPanel.test.tsx

## 9. 离线可用与核心流程

- [x] 纯前端：构建产物本地可运行，无后端 / 外部 CDN 依赖 —— `npm run preview` 冒烟（HTTP 200、样本文件 200）+ headless Edge 渲染确认（React 启动、导入区与素材库空态均渲染）
- [x] localStorage 数据损坏时恢复空库并提示 —— repository.test.ts
- [x] 全量验证通过：`powershell -ExecutionPolicy Bypass -File scripts\verify.ps1`（vitest 全量 + tsc 构建）—— T-010 执行记录：77+ 用例全绿、构建通过

## 10. 批量导入场景矩阵 · 手动清单（CR-007 T-003 / R-020；CR-008 T-003 增补面板交互与高亮）

> 自动化矩阵见 `src/App.scenarioMatrix.test.tsx`（合成 fixture，7 例全绿）；以下条目用
> **真实文件**在浏览器（`npm run dev` / `npm run preview`）人工核对，防止合成样本
> 无法覆盖的真实数据流问题回归（批量导入体验回溯的验收口径）。

- [ ] （人工）同系列 10 个真实 .dcm（同 SeriesInstanceUID、不同 InstanceNumber）：导入 → 左栏 1 个患者组 · 1 系列 · 10 切片；切片缩略图按 InstanceNumber 排序、显示真实首帧
- [ ] （人工）跨系列 10 个真实 .dcm（不同 SeriesInstanceUID）：1 组 10 系列、各自切片正确；打开其中一个系列，DevTools Network 中仅本系列文件产生字节请求（不解析其他系列）
- [ ] （人工）同患者无 UID 10 个真实 .dcm：1 组 1 个「未知系列（10 个文件）」· 10 切片（不再拆成 10 个系列）
- [ ] （人工）混合患者（≥2 名患者 + 去标识化文件）：多组互不串组、组间按（姓名, ID）排序、未知患者组在末尾；同患者内已知系列在前、「未知系列」在最后
- [ ] （人工）空批次（取消选择）与损坏 .dcm 混入：应用不崩溃；损坏文件有降级提示，其余文件正常分组、计数只含可解析切片
- [ ] （人工）缩略图：行缩略图与切片缩略图解析后显示真实像素；压缩 / 损坏文件保持占位；刷新后（blob 恢复）重新生成或保持占位，无持久化残留
- [ ] （人工）面板交互（R-021）：点击分组面板中的切片 → 中央切换到该切片、左栏高亮跟随；面板渲染位置与展开状态不变（不搬家）；素材行不挂载「展开切片」控件；分组头 / 系列行折叠交互可用
- [ ] （人工）高亮联动（R-022）：查看器内滑动条 / 步进切换切片 → 左栏对应缩略图高亮实时跟随；关闭查看器后高亮清理、面板与展开状态保留

## 11. 视口与交互走查 · 人工清单（CR-009 T-004 / R-023~R-026）

> 四角读数取值、滚轮↔滑条同步与工具切换已由自动化覆盖（`src/App.scenarioMatrix.test.tsx`
> 及 DicomViewer / TopToolbar / ImageStage 组件测试）；以下条目涉及真机拖拽手感、视觉
> 观感与过渡动画，jsdom 无法覆盖，留待浏览器人工复核（`npm run dev` / `npm run preview`）。

- [ ] （人工）视口四角覆盖层（R-023）：打开合成 DICOM（`public/samples/dicom/`）→ 左上患者/ID/文件名、右上模态·传输语法与 Inst #N/M、左下 C/W 与 PixelSpacing、右下 Zoom/Rot/AXIAL；右栏调节窗宽窗位 → 左下 C/W 实时更新；覆盖层半透明 mono、不遮挡画布拖拽
- [ ] （人工）视口工具组（R-024）：pan/zoom/window/rotate 拖拽手感（平移 / 缩放 / 调窗 / 旋转）与右下 Zoom/Rot 读数实时；measure 拖拽绘制测量线（明示 Mock 非临床）+ 清空可用；激活按钮视觉态与 aria-pressed 一致
- [ ] （人工）图片素材工具（R-024）：打开 png/jpg → pan/zoom/rotate 可用（拖拽 / Ctrl+滚轮缩放），window/measure 按钮禁用且悬停有「图片素材不支持」提示
- [ ] （人工）滚轮切片 ↔ 滑条（R-025）：DICOM 视口滚轮上下切切片（首末片钳制不溢出），底部滑条与四角 Inst 同步；滑条拖动 → 视口与 Inst 跟随；Ctrl+滚轮 = 缩放、不切切片
- [ ] （人工）左右抽屉（R-026）：顶栏开关切换左/右栏 → 0.2s 宽度过渡滑动、内容不溢出；窄窗口下侧栏折叠不遮挡中央视口

## 12. 图片比较走查 · 人工清单（CR-011 / R-002）

> 比较显式模式的状态机（进入筛选 / 显式选择 / 退出恢复）已由自动化覆盖（App.test.tsx +
> `src/App.scenarioMatrix.test.tsx` 比较显式模式场景，CR-011 T-003）；按钮文字态、提示条
> 与双图并排的视觉观感 jsdom 无法覆盖，留待浏览器人工复核（`npm run dev` / `npm run preview`）。

- [ ] （人工）顶栏「导入」「比较」汉字按钮：文字态清晰；进入比较模式后「比较」呈「完成」态（aria-pressed）；无可比较图片素材时「比较」禁用且悬停有「无可比较的图片素材（先导入图片）」说明
- [ ] （人工）比较模式：提示条「选择两张图片进行比较（已选 X/2）」计数实时；选中行有明显选中标记；非图片素材不可见、不干扰选择；选择第一张后可取消重选
- [ ] （人工）双图并排（R-002）：等尺寸窗格、先选在左；窗格独立放大 / 缩小 / 旋转 90° / 重置互不影响；图片加载失败时该侧占位提示、另一侧不受影响
- [ ] （人工）退出恢复：「退出比较」按钮 / Esc / 顶栏「完成」三路径均清空选择、恢复完整素材列表与普通模式行点击查看语义，无残留选中态

---

### 构建产物记录（TD-002 代码分割验证）

- `npm run build` 产物（T-010 实测）：主入口 `index-*.js` 278.67 kB（gzip 84.94 kB），
  three.js 随 3D 查看器拆为独立 chunk `Model3DViewer-*.js` 553.30 kB（gzip 139.63 kB），
  仅在首次点击 3D 模型卡片时按需加载；首屏不再下载 three 主包。
- 备注：Model3DViewer chunk 仍 >500 kB（three.js 本身体量），构建有 chunk 体积警告，
  属预期（TD-002 目标是将其移出首屏关键路径，非继续拆分 three）。
