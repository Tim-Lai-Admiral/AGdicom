# Technical Debt and Non-blocking TODO

不在当前 Task 范围内、且不阻塞交付的问题记录在这里。每条应足够清楚，以便未来独立建 Task；不要把它当作无优先级的愿望清单。

| ID | Problem | Impact | Priority | Suggested direction | Source | Status |
|---|---|---|---|---|---|---|
| TD-001 | 刷新页面后图片素材的 objectUrl 无法重建（T-003 未保留 File 引用，重复导入又被去重），当前无用户路径恢复刷新后的图片预览 | 刷新后图片网格显示占位+提示，需重新导入；影响体验但不影响评审结论持久化 | medium | 方案 A：T-003 useImport 对重复导入重建 objectUrl（低风险）；方案 B：IndexedDB 存 blob（需 Human 决策） | review 2026-09-04 (T-001~T-004 里程碑) | closed（CR-006：≤20MB IndexedDB 持久化自动恢复 + 重导入水合 + 行内删除） |
| TD-002 | three.js 打包使主包达 ~807KB，未做 dynamic import 代码分割 | 首屏加载体积偏大；功能不受影响 | low | Model3DViewer 改为 `React.lazy` + dynamic import，3D 代码按需加载 | T-006 builder 报告 2026-09-04 | closed（CR-003 T-010 已 lazy 拆分） |
| TD-006 | 损坏/无法解析的 DICOM 文件每次打开都会重试解析（无元数据 → 永不归类；completedIdsRef 卸载后重置） | 反复打开损坏文件重复解析开销 | low | 会话级失败标记（类似 sliceThumb failedThumbs 模式），本会话不重试 | review 2026-09-07 (CR-007) | open |
| TD-007 | 点击"当前已打开素材"的分组面板缩略图不重挂载查看器（key=activeAsset.id）→ 中央停留滑动条所切片、左栏高亮跳回 | 边缘交互不一致（非数据/契约风险） | low | 受控选中或 nonce 重挂载（会损失解析会话缓存，需评估） | review 2026-09-07 (CR-008 M-1) | open |
| TD-003 | Esc 无分层退出：中央 DICOM 查看器与右栏评审面板均注册 window keydown（DicomViewer L275 / ReviewPanel L100），两者并存时一次 Esc 同时关闭 | DICOM 查看器 + 评审页签并存时一次按键全关，用户可能误丢查看上下文；不影响数据与持久化 | low | 分层退出（Esc 先退评审页签/比较态，再次 Esc 关查看器）或按焦点范围判定目标 handler | T-004 报告提示 + T-005 走查 2026-09-06 | open |
| TD-004 | 视口角标覆盖层未实现：.viewport-overlay 类已迁移 index.css L120-129 但无 TSX 使用（rec 参考的视口四角信息角标缺失） | 切片号/模态/W-L 值等视口内信息需到右栏查看，信息展示弱化；功能不受影响 | low | DicomViewer / CompareView 画布四角接 .viewport-overlay 角标（只读信息，pointer-events:none） | T-005 走查 2026-09-06 | closed（CR-009 T-001：视口四角元数据覆盖层接线，R-023；CompareView 未接入） |
| TD-005 | DICOM 切片切换无滚轮交互（DESIGN 交互流程 2 提及「滚轮/滑块」；现为 上一张/下一张/下拉/左栏缩略图） | 连续阅片需逐次点击，翻页体验缺失；功能可用 | low | 画布 onWheel 节流复用 handleStepSlice(-1/+1)，测量模式/滑杆聚焦时让行 | T-005 走查 2026-09-06 | closed（CR-009 T-001：视口滚轮切片 + 滑条双向同步，R-025；切片 UI 已改为滑条） |
| TD-008 | 视口旋转（rotate 工具拖出角度）时测量落点换算失真：测量端点经 canvas.getBoundingClientRect()（旋转后的外接矩形）映射图像坐标，rotate ≠ 0 时拖拽落点与测量线绘制位置偏差 | 仅影响 rotate ≠ 0 时测量线的绘制位置（视觉失真）；距离计算、平移/缩放下的表现与四角读数不受影响 | low | 测量落点映射经变换舞台逆变换补偿（getScreenCTM 或手动旋转逆矩阵），或测量覆盖层脱离 stage 变换 | CR-009 T-002 Builder 报告遗留；T-004 登记 2026-09-08 | open |
| TD-009 | AI 测试偶发 unhandled rejection：全量并行跑测时 remoteProvider/AiPanel 测试出现 `ENOTFOUND api.example.com`（真实 fetch 逃离 stub 窗口，疑 AiPanel 加载态用例的永不落定 fetch stub + 真实 abort 定时器在 afterEach unstub 后触发） | vitest 明示 unhandled error 可能造成其他文件用例误报失败；CR-012 T-003 全量验证曾因此偶发一例（复跑即绿），影响 verify.ps1 稳定性 | medium | 排查 stub 生命周期（用 AbortSignal 感知的 fetch stub、或在用例内 await 挂起 promise 的受控落定/显式 abort），确保无逃离 stub 窗口的真实请求与跨用例残留定时器 | CR-012 T-003 Builder 报告 2026-09-08 | open |