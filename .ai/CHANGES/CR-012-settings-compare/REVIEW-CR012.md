# CR-012 Review

## 结论：PASS（M1 隐私边界已修复）

- 初评 REQUEST CHANGES（M1：远程 AI 请求发送完整 dicomMeta 含 patientName/patientID 直接标识符，与 AI_USAGE §4.4 声明不一致）。
- 修复（协调者在 T-004 分支落实）：`toRemoteDicomMeta` 白名单过滤（仅 Modality/SOPClass/TransferSyntax/Rows/Columns/PixelSpacing/SeriesUID/sliceCount/deidentified），PHI 字段不发送；新增单测断言 `patientName/patientID/deidentificationMethod` 不在请求体；AI_USAGE §4.4 明确"PHI 在请求构造时被剔除"。
- 复跑：`scripts\verify.ps1` 全绿（43 文件 / 442 用例）+ build 通过；CI 4× verify pass。

## 分项

| Task | 需求 | 结论 | 要点 |
|---|---|---|---|
| T-001（#52） | R-027 骨架 | PASS | 页签字号 10.5→13px；设置齿轮按钮+弹窗骨架；Esc 守卫防一键关两层 |
| T-002（#53） | R-027/R-028 | PASS（M1 修复后） | settingsStore 独立 key/损坏容错/导出隔离；remoteProvider POST/Bearer/10s 超时/失败分类；suggest 异步化兼容；回退 Mock 来源明示（fallbackToMock 关闭不悄悄换源）；AI_USAGE 更新；TD-009 登记 |
| T-003（#54） | R-029 | PASS | DicomViewport 抽取复用（存量用例无回归）；双窗切片 InstanceNumber 对齐/钳制/双向同步；pan/zoom/rotate 共享、W/L 独立；同类配对约束 |
| T-004（#55） | R-030 | PASS | modelViewSync（共享 OrbitControls 目标+复制相机变换，syncing 回环防护）；双实例+懒加载（ModelComparePanes 独立 chunk，three 不进主包）；dispose 全释放（mockThree 桩断言）；AssetGrid model 可比较；矩阵/E2E/README |

## 非阻塞（登记/待处理）

- m1：图片比较模式 Esc 双重退出（App 层图片 Esc 兜底未按 compareMode 守卫）——与 TD-003 同族，建议后续统一处理。
- m2：SettingsDialog 无焦点圈定（非模态语义，可接受）。
- m3：模型比较 geometry 未显式 dispose（与单窗行为一致，低影响）。
- m4：Builder result"DicomViewer 存量 42 用例"与测试实际 it() 计数 32 口径不符（表述复核）。

## 合并顺序

#52 → #53 → #54 → #55（栈式链）。

## 遗留人工

- 真机浏览器验收：设置弹窗（假 API 回退观察）、DICOM 双系列比较目检、STL 双模型拖拽同步（E2E-CHECKLIST 人工项）。