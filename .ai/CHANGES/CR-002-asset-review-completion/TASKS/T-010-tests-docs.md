# Task T-010: 测试与文档收尾

## Metadata

```yaml
id: T-010
cr: CR-002
type: docs
status: planned
owner: Builder
reviewer: Reviewer
priority: normal
expected_steps: 20
depends_on: [T-008, T-009]
branch: feature/CR-002-T-010-finish
```

## Context pack

- Requirement: R-008（CR-001 REQUIREMENTS.md）；流程 P-001~P-003（CR-002）
- 关键文件：`README.md`（补全定位/功能/技术栈/安装/启动/已知问题）、`E2E-CHECKLIST.md`（新建或 README 章节）、`src/features/viewer/dicom/__fixtures__/buildDicomFile.ts` 与 `DicomViewer.tsx`（Minor 修复点）
- 附带处理（已登记）：
  - T-005 审查 Minor：① buildDicomFile NumberOfFrames tag 顺序（0028,0008 应在 0028,0002 之后按 tag 升序）② JPEG2000 UID 文案精确化 ③ DicomViewer dialog 焦点圈定/关闭后焦点还原
  - TD-002：Model3DViewer 改 `React.lazy` + dynamic import（three.js 主包 ~807KB 代码分割）
- 禁止：不改 `.opencode/`、`ENVIRONMENT.md`；不新增业务功能

## Objective

补齐测试与交付文档：README.md 完整（定位/功能/技术栈/安装/启动/素材来源/已知问题）、E2E 清单执行、T-005 Minor 项与 TD-002 修复、全量验证。

## Scope

- README.md 完成（含 T-009 素材章节整合）
- `E2E-CHECKLIST.md`：导入→浏览→DICOM→3D→标注→评审→导出→AI 建议 全链路清单（执行并勾选）
- T-005 Minor 项与 TD-002 修复（改动限上述文件）
- 测试补齐与 `scripts\verify.ps1` 全量验证

## Out of scope

- 新业务功能；TD-001（IndexedDB）等未分配技术债。

## Acceptance criteria

- [ ] `scripts\verify.ps1` 全绿；`npm run build` 通过
- [ ] E2E 清单逐项执行完成（含核心流程离线可用）
- [ ] README 与实现一致，已知问题如实记录
- [ ] Minor 项与 TD-002 修复完成且有测试覆盖（lazy 加载不回归）

## Test requirements

- [ ] Unit/Integration: `scripts\verify.ps1`
- [ ] Manual/E2E: 清单逐项勾选

## Definition of done

- [ ] 验收通过；填 Builder result；Reviewer 终审

## Builder result

- **实现摘要**：
  - **TD-002**：`App.tsx` 中 Model3DViewer 改 `React.lazy(() => import(...))` + `<Suspense>`（fallback「正在加载 3D 模型查看器…」），three.js 拆为独立 chunk：主入口 278.67 kB（gzip 84.94 kB）+ `Model3DViewer-*.js` 553.30 kB（gzip 139.63 kB），首屏不再加载 three 主包；`App.test.tsx` 3D 用例改为 `findByRole` 等待 lazy 挂载（不回归）。
  - **T-005 Minor ①**：`buildDicomFile.ts` 将 NumberOfFrames（0028,0008）移到 0028,0002/0028,0004 之后、0028,0010 之前，数据集严格 tag 升序；新增 `__fixtures__/buildDicomFile.test.ts` 按字节遍历数据集断言升序（explicit/implicit 双编码，含可选元素缺席场景）。
  - **T-005 Minor ②**：`DicomViewer.tsx` 传输语法映射补 JPEG 2000（1.2.840.10008.1.2.4.90「JPEG 2000 无损压缩」/.91「JPEG 2000 压缩」），未知 UID 按家族前缀 `.9` 精确区分，不再笼统显示「JPEG 压缩」；含测试。
  - **T-005 Minor ③**：`DicomViewer.tsx` 弹层无障碍：打开时聚焦关闭按钮 + Tab/Shift+Tab 在弹层可聚焦元素间循环圈定 + 关闭（卸载）后焦点还原到打开前触发元素；含 2 个测试（圈定循环、焦点还原）。
  - **README.md**：补全项目定位、功能一览、环境要求、安装与启动（含 verify.ps1）、技术栈、已知问题（7 项如实记录：文件字节不持久化/TD-001、压缩语法不解码、3D 仅 STL、localStorage 容量、AI mock、焦点圈定范围、WebGL 未自动化）；T-009 素材章节原样保留。
  - **E2E-CHECKLIST.md**（仓库根，新建）：导入→浏览→DICOM→3D→标注→评审→导出→AI 建议 全链路清单，逐项标注验证方式（自动化测试/构建/预览冒烟）；仅「真机 WebGL 交互」一项留人工复核并显式标注。
- **文件清单**：`src/App.tsx`、`src/App.test.tsx`、`src/features/viewer/dicom/DicomViewer.tsx`、`DicomViewer.test.tsx`、`__fixtures__/buildDicomFile.ts`、`__fixtures__/buildDicomFile.test.ts`（新增）、`README.md`、`E2E-CHECKLIST.md`（新增）、本任务卡。
- **验证结果**：
  - `scripts\verify.ps1` 全绿：24 test files / **238 tests passed** + `tsc -b && vite build` 成功；
  - `npm run preview` 冒烟：`/`、`/samples/stl/aorta.stl`（3.9MB）、`/samples/dicom/phantom-ct-01.dcm` 均 HTTP 200；
  - headless Edge（--headless=new --dump-dom）确认构建产物在真实浏览器启动渲染（导入区/素材库空态正常）；
  - 构建产物检查：`dist/assets/Model3DViewer-0n2LTUYd.js` 独立 chunk，主入口不含 three（TD-002 达成；chunk >500 kB 有 vite 警告，属 three 本身体量，已在 E2E-CHECKLIST 备注）。
- **commit / PR**：实现 `6e28a1b`（Minor+TD-002）、`a8e94a6`（README+E2E 清单）、本卡回填；分支 `feature/CR-002-T-010-finish`；PR #11：https://github.com/Tim-Lai-Admiral/AGdicom/pull/11
- **已知限制**：
  - E2E 清单的「真机 WebGL 交互」（旋转/缩放/平移、多次开关不泄漏）自动化不可覆盖（jsdom 无 WebGL），已标注为人工项，建议 Reviewer 浏览器复核一次；
  - 焦点圈定仅覆盖 DICOM 查看器（卡片范围）；3D 查看器/评审面板等其余弹层未实现 focus trap，已记入 README 已知问题第 6 条。
- **需 Reviewer 关注点**：① TD-002 后 App 引用与测试等待方式是否可接受（Suspense fallback 文案）；② focus trap 实现选择 window 级 keydown + querySelector 圈定（无依赖），边界（弹层内无可聚焦元素）已处理；③ 已知问题记录是否与实现一致。