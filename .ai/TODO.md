# Technical Debt and Non-blocking TODO

不在当前 Task 范围内、且不阻塞交付的问题记录在这里。每条应足够清楚，以便未来独立建 Task；不要把它当作无优先级的愿望清单。

| ID | Problem | Impact | Priority | Suggested direction | Source | Status |
|---|---|---|---|---|---|---|
| TD-001 | 刷新页面后图片素材的 objectUrl 无法重建（T-003 未保留 File 引用，重复导入又被去重），当前无用户路径恢复刷新后的图片预览 | 刷新后图片网格显示占位+提示，需重新导入；影响体验但不影响评审结论持久化 | medium | 方案 A：T-003 useImport 对重复导入重建 objectUrl（低风险）；方案 B：IndexedDB 存 blob（需 Human 决策） | review 2026-09-04 (T-001~T-004 里程碑) | closed（CR-006：≤20MB IndexedDB 持久化自动恢复 + 重导入水合 + 行内删除） |
| TD-002 | three.js 打包使主包达 ~807KB，未做 dynamic import 代码分割 | 首屏加载体积偏大；功能不受影响 | low | Model3DViewer 改为 `React.lazy` + dynamic import，3D 代码按需加载 | T-006 builder 报告 2026-09-04 | open |
| TD-003 | Esc 无分层退出：中央 DICOM 查看器与右栏评审面板均注册 window keydown（DicomViewer L275 / ReviewPanel L100），两者并存时一次 Esc 同时关闭 | DICOM 查看器 + 评审页签并存时一次按键全关，用户可能误丢查看上下文；不影响数据与持久化 | low | 分层退出（Esc 先退评审页签/比较态，再次 Esc 关查看器）或按焦点范围判定目标 handler | T-004 报告提示 + T-005 走查 2026-09-06 | open |
| TD-004 | 视口角标覆盖层未实现：.viewport-overlay 类已迁移 index.css L120-129 但无 TSX 使用（rec 参考的视口四角信息角标缺失） | 切片号/模态/W-L 值等视口内信息需到右栏查看，信息展示弱化；功能不受影响 | low | DicomViewer / CompareView 画布四角接 .viewport-overlay 角标（只读信息，pointer-events:none） | T-005 走查 2026-09-06 | open |
| TD-005 | DICOM 切片切换无滚轮交互（DESIGN 交互流程 2 提及「滚轮/滑块」；现为 上一张/下一张/下拉/左栏缩略图） | 连续阅片需逐次点击，翻页体验缺失；功能可用 | low | 画布 onWheel 节流复用 handleStepSlice(-1/+1)，测量模式/滑杆聚焦时让行 | T-005 走查 2026-09-06 | open |