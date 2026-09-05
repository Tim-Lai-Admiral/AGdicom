# Review: CR-003（T-001 ~ T-005）

## Metadata

```yaml
task: T-001..T-005
cr: CR-003
reviewer: Reviewer
target_commit_or_pr: "#13 (merged) / #14 / #15 / #16 / #17 (stacked)"
date: 2026-09-06
result: PASS
```

> 审查对象为 PR #13~#17（GitHub，非 working tree）。#14~#17 为栈式链（各含前序提交），
> #17 diff = 全链（T-002→T-003→T-004→T-005）；#13（T-001）已合并进 origin/master。
> 复跑验证在 `gh pr checkout 17` 对应的 T-005 分支上执行后切回 master。

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | 五卡目标逐项达成：设计系统接入、四区布局、W/L+测量、功能集成回归、走查收尾 |
| Acceptance criteria | pass | R-003 修改 / R-010 / UI-001 / UI-002 验收项全覆盖（见下分项） |
| No out-of-scope changes | pass | `git diff master...T-005 --stat` 无 `src/domain/*` / `src/store/*` 改动；契约零改动；唯一组件契约增量为 AssetGrid 可选 `renderExtras`（默认不渲染，向后兼容） |
| CURRENT/architecture respected | pass | 未改领域/仓储契约、未改 DICOM 解码核心与 3D 内核；样式基础设施引入 Tailwind v4 属 CHANGE 已批准范围 |

## 分项结论

| Task | PR | 结论 | 关键证据 |
|---|---|---|---|
| T-001 设计系统 | #13 (merged) | PASS | `vite.config.ts` 注册 `@tailwindcss/vite`；`src/index.css` 令牌与 rec 一致（--bg #060810/--panel #0b0e16/--accent #00c4d8 等 16 变量 + 组件类）；4 个 woff2 入 `public/fonts/`，grep 全库无 fonts.googleapis/gstatic（仅注释）；`main.tsx` 在 legacy `styles.css` 后引入 `index.css` |
| T-002 工作台布局 | #14 | PASS | `App.tsx` 四区壳（顶栏/左栏 17.5rem/中央/右栏 20rem）；`DicomSeriesExpansion` 复用 seriesUtils 展开 series+切片缩略图并切换；`MetadataPanel` 分组折叠 + `metaLabels.ts` 抽出共享；preflight 于 `index.css` 启用，`.workbench` 作用域令牌映射处理视觉回归 |
| T-003 W/L+测量 | #15 | PASS | `decodeDicomFrame` 缺省路径逐字节等价（diff 仅新增 windowed 分支）；ww=1 阈值分支不除零；`windowLevel.ts` 6 预设取值与 rec 一致；`measure.ts` PixelSpacing 确定性 mm / 无间距 Mock px / 非临床明示 / 切换清空 / 降级禁用 |
| T-004 集成回归 | #16 | PASS | CompareView/DicomViewer/Model3DViewer 移除 `aria-modal`（App.test.tsx 3 处回归断言）；旧布局死样式清理（grep 无残留 TSX 引用）；导出/导入回环测试通过 |
| T-005 走查收尾 | #17 | PASS | WALKTHROUGH.md 清单逐项有结论；F1-F6/O1 全部非阻塞并处置（TD-003/004/005 登记 .ai/TODO.md + README #8）；DESIGN.md 校对无事实错误；CHANGE.md Result 与实现一致 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| Required unit tests | pass | 复跑 `scripts\verify.ps1`：**28 个测试文件 / 274 测试通过**（含 decodePixel 扩展 24、windowLevel 3、measure 8、WindowLevelPanel 5、DicomViewer 19、App.workbench 6、App 8 等） |
| Required integration/E2E/manual | pass（自动化）/ 待人工 | jsdom 入口级测试覆盖评审全链路、导出导入回环、布局切换、DICOM series 展开；真机浏览器项（WebGL 交互、W/L 滑杆手感、导出下载、真实 DICOM 缩放显示）见 WALKTHROUGH.md 第五节 11 项，待 Reviewer/Human 执行 |
| Regression risk checks | pass | 存量 238 测试零回归；build `tsc -b && vite build` 成功（Model3DViewer chunk >500KB 为既有状态，TD-002 已拆按需加载） |

## CI 结果

`gh pr checks`：**#13~#17 全部 `verify pass`**（38s / 50s / 50s / 55s / 43s）。

## Findings

### Blocker

- 无。

### Major

- 无。

### Minor / non-blocking

- **canvas 显示方式变更需真机确认**：`.dicom-viewer__canvas` 由 max-width/max-height 改为 `width/height:100% + object-fit: contain`（styles.css:631-638），是测量覆盖层对齐的前提，但真实 DICOM 缩放显示效果 jsdom 无法验证；Builder 已在 T-003 result「需 Reviewer 关注」标注，属 WALKTHROUGH.md 第五节手动清单 #5/#6/#7 项，非阻塞。
- **Esc 分层退出缺失（TD-003）**：DicomViewer（L275）与 ReviewPanel（L100）均注册 window keydown，并存时一次 Esc 同时关闭两者；已登记 TODO.md + README #8，属既有行为，非阻塞。
- **非模态语义与焦点圈定并存**：三个查看器 T-004 起不再声明 `aria-modal`（内嵌视图），但 DicomViewer 仍保留 Tab 焦点圈定 + 关闭焦点还原（DicomViewer.tsx:268-313）；README #6 如实记录，属可访问性折衷，非阻塞。
- **auto 态滑杆展示候选值（40/400）而非帧实际 min/max 派生值**：已以「自动（min-max）」提示消歧（windowLevel.ts:49 + WindowLevelPanel.tsx:41-45），非阻塞。
- **WALKTHROUGH.md 行号引用轻微漂移**（如 App.tsx L343-376 与当前 343/378/382 略有出入）：文档性偏差，不影响结论。

## Recommendation

**PASS**。五个 PR 满足各自验收标准与 CR-003 需求（R-003 修改 / R-010 / UI-001 / UI-002），无阻塞发现，domain/store 契约零改动，274 测试全绿且 CI 全过。

最小后续动作（供 Human / 协调者）：
1. 按 #14 → #15 → #16 → #17 顺序合并（#13 已合并）；合并后删除 T-002~T-005 分支。
2. 执行 WALKTHROUGH.md 第五节真机手动清单（11 项），确认 WebGL / W/L 手感 / 导出下载 / 真实 DICOM 缩放。
3. 合并后由协调者更新 `.ai/CURRENT/DESIGN.md`（R-003/R-010/UI-001/UI-002 生效）。
