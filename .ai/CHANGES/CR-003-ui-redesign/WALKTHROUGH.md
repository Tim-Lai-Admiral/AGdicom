# CR-003 T-005 走查记录

## 元信息

```yaml
task: T-005（走查与文档收尾）
branch: feature/CR-003-T-005-walkthrough（基于 feature/CR-003-T-004-integration）
date: 2026-09-06
spec: .ai/CHANGES/CR-003-ui-redesign/DESIGN.md
reference: rec/（Figma Make 素材，只读不提交）
method: 代码审查 + 自动化测试为主；真机浏览器项列入手动清单（见第五节，本轮未操作浏览器）
```

## 一、走查清单逐项结论

| # | 清单项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 四区布局 | ✅ 符合 | 见 1.1 |
| 2 | 深色主题一致性 | ✅ 符合 | 见 1.2 |
| 3 | W/L 与测量交互 | ✅ 符合 | 见 1.3 |
| 4 | 三类素材链路 | ✅ 符合 | 见 1.4 |
| 5 | 窄屏折叠 | ✅ 符合（附观察 O1） | 见 1.5 |
| 6 | 离线字体 | ✅ 符合 | 见 1.6 |
| 7 | 医疗界面约束（附加核对） | ✅ 符合 | 见 1.7 |
| 8 | 可访问性保留（附加核对） | ✅ 符合 | 见 1.8 |

### 1.1 四区布局（UI-001）

- 顶栏 `TopToolbar`（src/features/workbench/TopToolbar.tsx）：应用标题 + 导入 + 加载样本 + 比较 + 筛选组（Filters：类型/状态/标签/搜索）+ 导出 + 左/右栏开关（aria-pressed）。与 DESIGN 布局范式的顶栏职责一致；差异 F5/F6 见第二节。
- 左栏 `workbench__left`（17.5rem，App.tsx L343-376）：素材库 `AssetGrid` 单列卡片 + DICOM 素材 `DicomSeriesExpansion` series/切片展开（ThumbSVG 风格占位缩略图，点击切片打开中央查看器并高亮）。
- 中央 `workbench__viewport`（App.tsx L378-380）：统一容器，优先级 比较 > DICOM > 3D（React.lazy）> 图片 > 导入视图（App.tsx L226-267）。
- 右栏 `workbench__right`（20rem，App.tsx L382-431）：DICOM → 页签「元数据 | 评审」（L389-408），元数据页签 = W/L 面板 + 分组折叠元数据；其余素材 → 评审面板。`selectAsset` 联动自动切换（App.tsx L98-103）。
- 样式：styles.css L1606-1879（.workbench 100vh flex 壳、三栏、页签、导出弹出层、警告条）。

### 1.2 深色主题一致性（UI-002）

- `src/index.css` L73-94 令牌与 `rec/src/index.css` L10-27 **逐变量一致**（--bg #060810 / --panel #0b0e16 / --accent #00c4d8 / --text-mono 等 16 个）；差异仅为本地化所需的字体栈变量（--font-sans-data / --font-mono-data，index.css L92-93）。
- 组件类迁移与 rec 逐行一致：.tool-btn（32×32 + hover/active）、.range-input、.preset-btn、.meta-row/.meta-label/.meta-value、.section-header、.measuring-line（index.css L120-279）。
- styles.css 工作台作用域全部引用深色令牌；旧组件浅色令牌在 .workbench 作用域映射为深色（styles.css L1611-1623）。
- 滚动条 4px 细样式（index.css L101-114）。

### 1.3 W/L 与测量交互（R-003 修改 / R-010）

- W/L（WindowLevelPanel.tsx）：双滑杆（窗位 C -1000..1000、窗宽 W 1..4000，L51-80）+ 6 预设（Lung/Mediastinum/Bone/Brain/Liver/S. Tissue，L82-93）+ 「自动 min-max」复位（L31-38）+ 模式 role=status 提示（L41-45）。状态由 App 持有，切换素材自动复位 AUTO_WINDOW_LEVEL（App.tsx L67-69）；中央 DicomViewer 消费重解码（App.tsx L232-239）。
- 测量 Mock（DicomViewer.tsx / measure.ts）：工具开关 + 清空按钮（L488-507）；SVG 覆盖层拖拽绘制（L430-481）；距离标注 PixelSpacing 可用 → 确定性 mm，否则 Mock 图像像素口径（measure.ts L47-63）；「模拟测量，非临床：距离标注仅供界面演示」常驻提示（L508-512）；切换素材/切片清空、不持久化。
- 测试：WindowLevelPanel.test 5、windowLevel.test 3、measure.test 8、DicomViewer.test 19（含非临床文案断言 L444、Esc 关闭 L576、Tab 焦点圈定 L588、焦点还原 L615）。

### 1.4 三类素材链路

- 图片：导入（拖拽/选择，useImport）→ 卡片 → 中央 `ImageStage` 预览；勾选两张 → 自动进入 `CompareView` 并排（先选在左）→ Esc/按钮退出（CompareView.tsx L62-66）。
- DICOM：series 按 SeriesInstanceUID 聚合、切片按 InstanceNumber 排序；左栏展开缩略图 + 中央 上一张/下一张/下拉/位置显示（DicomViewer.tsx L514-559）；Canvas 灰度预览默认自动 min-max，可调 W/L；压缩语法/损坏/刷新后多路降级仅元数据；元数据解析后回写持久化（App.tsx L190-204）。
- 3D：STL 解析 + three.js 渲染（React.lazy 按需 chunk，TD-002）；WebGL 不可用/损坏文件降级；obj/glb/gltf 可读错误提示。
- 内置样本：顶栏一键加载 4 个 STL（App.tsx L162-183）；合成 DICOM 样本 public/samples/dicom（18 文件，3 series × 6 切片）经导入走查。
- 测试：App.workbench.test 6（评审全链路、导出导入回环）、App.test 8（样本加载 → 3D 打开、比较进出）、CompareView.test 6、Model3DViewer.test 4（降级）、useImport/importAssets/AssetGrid/ImportZone 等共 28 文件 274 测试全绿。

### 1.5 窄屏折叠

- `@media (max-width: 64rem)`：左栏收窄 17.5rem→14rem、右栏 20rem→17rem（styles.css L1871-1879）；顶栏 flex-wrap 换行、筛选组弹性宽度（L1637-1693）。
- 折叠：顶栏「左栏 / 右栏」开关（TopToolbar.tsx L91-110，aria-pressed + title 提示），折叠后条件渲染不占位不溢出（App.tsx L343/L382）。
- 观察 O1：无断点自动折叠（窄屏需手动点开关）；侧栏收窄后仍占位。属可接受行为，见第二节。

### 1.6 离线字体

- public/fonts/ 4 个 woff2：Inter（latin/latin-ext，300-600 可变）、JetBrains Mono（latin/latin-ext，400-500 可变）。
- @font-face 指向本地 /fonts/*.woff2 + unicode-range（index.css L24-67）；全库 grep 无 fonts.googleapis / fonts.gstatic / CDN 引用（唯一命中为 index.css 注释中的禁用声明）。
- 构建产物纯本地：vite build 成功，无外部请求路径。

### 1.7 医疗界面约束

- 测量明示「模拟测量，非临床」（DicomViewer.tsx L510，测试断言 L444）；元数据面板/3D 查看器头注明确「不包含任何诊断/治疗暗示」。
- 全库 grep「诊断/治疗/癌/病灶」：仅命中上述否定声明注释，无暗示性文案。

### 1.8 可访问性保留

- role=alert/status 双通道（存储/保存/样本警告、导入反馈、W/L 模式、解析进度）；状态徽标颜色 + 中文文字双通道。
- Esc 关闭：比较 / DICOM / 3D / 评审面板均可 Esc 退出（现象 F1 见下）。
- 焦点：DICOM 查看器 Tab 圈定 + 关闭后焦点还原（DicomViewer.tsx L273-311）；README 已知问题 #6 如实记录其余内嵌视图无 Tab 圈定。

## 二、发现项与处置

| ID | 发现 | 级别 | 处置 |
|---|---|---|---|
| F1 | 一次 Esc 同时关闭中央 DICOM 查看器与右栏评审页签（DicomViewer L275 与 ReviewPanel L100 均注册 window keydown，未分层退出；T-002/T-003 既有行为） | 非阻塞 | **TD-003** 登记 .ai/TODO.md（派发指令指定）；README 已知问题 #8 同步 |
| F2 | 视口角标覆盖层未实现：.viewport-overlay 类已迁移 index.css L120-129 但无 TSX 使用（rec 参考的视口角标信息层缺失） | 非阻塞（信息展示弱化，元数据右栏仍可查） | **TD-004** 登记 .ai/TODO.md；README 已知问题 #8 同步 |
| F3 | DICOM 切片无滚轮切换：DESIGN 交互流程 2 提及「滚轮/滑块」；实现为 上一张/下一张/下拉/左栏缩略图，无 onWheel | 非阻塞（交互补充） | **TD-005** 登记 .ai/TODO.md；README 已知问题 #8 同步 |
| F4 | 侧栏缩略图未用 .sidebar-thumb 类：DicomSeriesExpansion 采用自有 .dicom-expand__thumb（SliceThumb SVG 内联，功能等价）；.sidebar-thumb（index.css L157-174）暂无使用 | 非阻塞（类名差异，功能等价） | 走查注记；类保留供后续统一，不改动 |
| F5 | DESIGN「状态筛选并入类型筛选」：实现为同一筛选控件组内并列四控件（类型/状态/标签/搜索，Filters.tsx） | 非阻塞（措辞差异，功能等价：状态筛选保留且可用） | 走查注记 |
| F6 | DESIGN 顶栏映射未列「比较」按钮：实现将比较入口置于顶栏（旧布局在素材库头部，迁移后位置合理） | 非阻塞 | 走查注记 |
| O1 | 窄屏无自动折叠（见 1.5） | 非阻塞（观察） | 手动清单观察项 |

**无阻塞发现**：核心链路与验收功能全部可用，T-005 禁止功能改动，本 PR 仅文档与登记。

## 三、DESIGN.md 校对结论

- 令牌表、组件类名、布局范式、交互流程与 rec/ 实现逐项核对：**无事实性错误，正文无需修改**。
- F2/F3 属实现偏差而非规范错误，按协议不动已批准规范（不得为迎合实现修改更高层事实），偏差在本文档与 TODO 登记。
- `.ai/CURRENT/DESIGN.md` 更新按任务卡约定**合并后由协调者执行**，不在本任务范围。

## 四、自动化验证（2026-09-06，本分支）

- `powershell -ExecutionPolicy Bypass -File scripts\verify.ps1` **全绿**：
  - npm test：28 个测试文件 / 274 测试通过（vitest 5 / jsdom）；
  - npm run build：`tsc -b && vite build` 成功（Model3DViewer chunk >500KB 警告为既有状态，TD-002 已拆分按需加载）。

## 五、手动验证清单（真机浏览器，待 Reviewer / Human 执行）

`npm run dev` 启动后逐项确认（对应 Scope 的浏览器手动验证项）：

1. 四区渲染：顶栏 / 左栏 / 中央 / 右栏齐全，无横向滚动条，整体深色无浅色残留区块。
2. 面板开关：顶栏「左栏 / 右栏」点击折叠/展开，aria 状态与 title 提示正确；折叠后中央区自适应占满。
3. 图片链路：拖拽 + 按钮导入图片 → 卡片出现 → 点击中央预览；勾选两张 → 自动并排比较（先选在左）→ Esc 与按钮均可退出。
4. 样本链路：顶栏「加载内置样本（STL）」→ 4 个 STL 导入（LA 大文件有进度提示）→ 打开 3D 查看器（懒加载提示 → 渲染）→ 左键旋转 / 滚轮缩放 / 右键平移。
5. DICOM 链路：导入 public/samples/dicom/ 18 个文件 → 左栏「展开切片」显示 series 分组与缩略图 → 点击缩略图打开中央查看器 → 上一张/下一张/下拉切换正常，位置显示正确。
6. W/L：右栏拖动 窗位 C / 窗宽 W 滑杆 → 预览即时变化；6 个预设逐一点击生效；「自动 min-max」复位；切换素材后自动复位。
7. 测量：开启「测量（模拟）」→ 画布拖拽绘制 → 线 + 端点 + 距离标注（PixelSpacing mm 或模拟 px 口径）→「清空测量」→ 切换切片/素材自动清空；「模拟测量，非临床」提示可见。
8. 窄屏：窗口缩至 <1024px，侧栏收窄不溢出，顶栏换行后可用。
9. 离线字体：DevTools Network 面板无 fonts.googleapis / gstatic 请求；Inter 正文 / JetBrains Mono（元数据 mono 值）生效。
10. 评审/导出：提交评审（状态 + 意见）→ 历史留痕；标签增删；备注保存；刷新后保留；导出 JSON 下载 → 导入回填（同名冲突确认）。
11. 已知现象复现（非通过项）：打开 DICOM 后右栏切到「评审」页签，按一次 Esc → 中央查看器与评审页签（整个查看态）同时关闭，即 TD-003。

## 六、文档更新清单（随本 PR 提交）

- 新增本文档（走查记录）。
- `.ai/TODO.md`：新增 TD-003 / TD-004 / TD-005。
- `README.md`：功能一览补工作台布局 / W-L / 测量 Mock；已知问题截至 T-005 并新增 #8（走查遗留）；技术栈补 Tailwind v4；项目文档补 CR-003。
- `CHANGE.md`：填写 Result（合并状态与交付摘要）。
- 任务卡 `T-005-walkthrough.md`：status → implemented，填写 Builder result。

## 七、结论

- 验收「走查清单逐项执行并有结论记录」：达成（本文档第一节 + 第四节）。
- 验收「发现项均有处置」：达成（F1-F6 / O1 全部登记或注记，无阻塞）。
- 验收「文档与实现一致」：达成（本 PR 同步 README / CHANGE / TODO；CURRENT 待合并后由协调者更新）。
- 残留：TD-003 / TD-004 / TD-005 非阻塞技术债；第五节真机手动清单待人工执行。
