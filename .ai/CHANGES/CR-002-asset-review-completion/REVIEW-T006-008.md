# Review: T-006 / T-007 / T-008（PR #6 / #7 / #8）

> 审查对象为已合并 PR（git diff 以 PR merge commit 为准，非 working tree）。复跑验证在 master（三 PR 合并后态）上完成。

## Metadata

```yaml
task: T-006, T-007, T-008
cr: CR-001 (T-006/T-007), CR-002 (T-008)
reviewer: Reviewer
target_pr: PR #6 (35c0faf "feat: 3D 查看器"), PR #7 (eba7cd8 "feat: 标注与评审结论"), PR #8 (a5a43c5 "feat: Mock AI 建议面板")
date: 2026-09-05
result: PASS
```

## Scope and requirement check

### T-006（R-004：3D 模型加载与交互）

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | `useModelLoader.ts`（状态机 + 分块进度 + dispose）+ `Model3DViewer.tsx`（WebGLRenderer + OrbitControls + 错误重试 + WebGL 降级）+ `App.tsx` 样本入口复用 T-003 管线 |
| Acceptance criteria | pass | 4 个内置 STL 已入库（`public/samples/stl/`：aorta/CB/LA/LVOT）；三项交互为 OrbitControls 默认映射（左键旋转/滚轮缩放/右键平移，`Model3DViewer.tsx:133-140` 未改映射）；损坏文件路径有 `parseStlGeometry` 四类校验（`useModelLoader.ts:111-133`）与错误重试 |
| No out-of-scope changes | pass | 无 GLTF/OBJ、无测量/剖切；`ENVIRONMENT.md`/`.ai/TODO.md` 改动为 commit 语言约定与 TD-002 技术债登记（协调类元数据，非产品代码），详见 Minor |
| CURRENT/architecture respected | pass | three.js + `three/examples/jsm/loaders/STLLoader.js` 与 `OrbitControls.js`；未引入 react-three-fiber；`features/viewer/model3d/` 分层符合 ARCHITECTURE.md |

### T-007（R-005：标注与评审结论持久化与导出）

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | `ReviewPanel.tsx`（标签增删/自建/备注/状态/意见）+ `ReviewHistory.tsx`（时间戳留痕）+ `ExportImport.tsx`（导出/导入）+ `domain/review.ts`（`updateAssetNote`）+ `store/io.ts`（深度导入校验 + `findNameConflicts`） |
| Acceptance criteria | pass | 标签/备注/状态/意见持久化（App `commit` 落库）；历史追加式（`applyReview` 每次 append 一条，`ReviewHistory` 倒序展示）；导出→导入往返（`ExportImport.test.tsx` 覆盖）；版本不符/结构非法拒绝（`parseImportFile` + `ImportFormatError`） |
| No out-of-scope changes | pass | 无 AI（T-008 分开）；`AssetGrid.tsx` 新增可选 `onOpenReview`（未提供不渲染，向后兼容）为最小合理扩展，已在 Builder result 明示并经审定为必要入口 |
| CURRENT/architecture respected | pass | 复用 T-002 仓储与 schema v1（`EXPORT_SCHEMA_VERSION=1`，`toPersistableState` 剥离会话字段）；AI 区由 T-008 内嵌 |

### T-008（R-006：Mock AI 建议能力）

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | `ai/types.ts`（`AIProvider` 接口）+ `mockProvider.ts`（确定性规则）+ `AiPanel.tsx`（采纳/忽略/重新生成/Mock 明示）+ `AI_USAGE.md` + `domain/review.ts` `updateAssetName` |
| Acceptance criteria | pass | 三类建议（DICOM/STL/图片）均可用且确定性（`mockProvider.test.ts` 10 例）；采纳命名填名、标签合并、忽略零副作用（`AiPanel.test.tsx` 7 例）；生成异常降级"暂无建议"不崩溃；界面 `Mock 生成` badge + AI_USAGE.md 明示验证/修改/拒绝方式 |
| No out-of-scope changes | pass | 无真实 AI、无流式/自动改名；`updateAssetName` 为纯粹函数新增，未改 `domain/types.ts` 契约（详见 Minor） |
| CURRENT/architecture respected | pass | `AIProvider` 抽象注入点（AiPanel `provider` prop 默认 `mockProvider`），符合 R-006 "预留接口接真实服务"约束 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| Required unit tests | pass | `scripts\verify.ps1` 复跑：**233/233 tests passed（23 文件）**，含 useModelLoader(13)/Model3DViewer(4)/ReviewPanel(14)/ReviewHistory(4)/ExportImport(9)/mockProvider(10)/AiPanel(7)/io(16)/review(16) |
| Required integration/E2E/manual checks | partial（已在 follow-up 记录） | WebGL 实际渲染 + 三项交互手感 + LA 14MB 加载进度无法在 jsdom 验证，Builder 已知限制并建议人工浏览器验证；Node 层实测 4 样本三角面数与包围球半径均有限 |
| Regression risk checks | pass | `tsc -b` 无错误 + `vite build` 通过（verify OK）；既有 213 测试无回归（T-007 时 213 → T-008 时 233 新增 20） |

## Findings

### Blocker

- None

### Major

- None

### Minor / non-blocking

1. **3D 主包过大（R-004 性能）**：`vite build` 输出主 JS 达 ~830KB（gzip ~224KB），已触发 chunk>500KB 告警。Builder 已登记 TD-002（`Model3DViewer` 改 `React.lazy` + dynamic import 按需加载），非阻塞，建议在 T-010 收尾一并处理。
2. **查看器与评审面板 Esc 冲突（T-007 UX）**：`ReviewPanel.tsx` 与 `Model3DViewer`/`DicomViewer` 均监听 `window` 的 Escape，两者并存时按 Esc 会一起关闭（Builder 已知限制，低风险 UX 细节，未做焦点抢占）。非阻塞。
3. **`domain/review.ts` 新增 `updateAssetName` 的契约边界（T-008）**：任务卡禁止项为"不改 domain 契约"。经核对 `domain/types.ts` 的 `Asset`/`AppState` 契约未改动，`updateAssetName` 为遵循既有纯函数模式的新增函数（非契约修改），并可复用为后续手动重命名链路，判断合理。已在 Builder result 明示，请 Human 知悉。
4. **fixture 正确性（T-006）**：`buildStlFile.ts` 二进制 STL 头故意不以 `'solid'` 开头以规避 STLLoader 的 ASCII 分支判断，面数越界/空文件/无 facet ASCII 三类损坏变体覆盖解析错误路径，构造自洽（四面体 4 面循环复用），正确性已由 `useModelLoader.test.ts` 与真实样本 Node 解析佐证。
5. **CI 无 checks 回报（P-004 观察）**：`gh pr checks 6/7/8` 均返回 "no checks reported"。`.github/workflows/ci.yml` 存在且覆盖 test/lint/build，但三 PR 的 CI 未在合并时产生可查询的 check 记录（可能因为 PR 由 `gh pr create` 建立后即合并、或 checks 事件未触发）。本地复跑 `verify.ps1`（test + build）已绿，结论不依赖 CI 报表；建议 Human 在后续全量构建时确认 CI 正常触发。

## Recommendation

**PASS**。

三 PR 均实现目标、验收标准覆盖完整、错误/降级路径齐备、测试充分（233 全绿），范围纪律与契约符合性良好（`AssetGrid.onOpenReview`、`updateAssetName` 两处越界点均已明示且为最小向后兼容扩展）。阻塞/严重问题为零。Minor 项（3D 包体、Esc 冲突、CI 报表）均为非阻塞，建议随 T-010 收尾顺带处理（TD-002 已在 TODO 登记）。

> 提示：三 PR 已由 Human 合并（mergedAt 2026-09-05），本报告为合并后审查结论；PASS 不代表额外授权，合并权属已属 Human。
