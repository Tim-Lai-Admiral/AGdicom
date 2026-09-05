# Task T-007: 标注与评审结论

## Metadata

```yaml
id: T-007
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-002]
branch: feature/CR-001-T-007-review"
```

## Objective

实现评审面板：标签管理（自建）、备注、评审状态与意见、评审历史（时间戳留痕）、JSON 导出/导入（可追溯）。

## Context and inputs

- Requirement(s): R-005
- Current architecture/design references: CR-001 DESIGN.md（评审面板）、ARCHITECTURE.md（store 导入导出）
- Dependency output: T-002 领域模型与仓储

## Scope

Allowed changes:

- `src/features/review/ReviewPanel.tsx`：标签增删（含自建）、备注编辑、状态选择、评审意见输入。
- `src/features/review/ReviewHistory.tsx`：历史列表（时间戳 + 状态 + 意见）。
- `src/domain/review.ts`：评审记录追加、历史合并（T-002 已建基座，此处完善）。
- `src/features/review/ExportImport.tsx`：导出 JSON 下载、导入 JSON 恢复（含冲突提示）。
- `src/features/review/*.test.ts`：单测。
- `src/App.tsx`：布局接线（侧栏/抽屉）。

## Out of scope

- AI 建议（T-008）。
- 多选批量评审（可选扩展）。

## Expected behavior

1. 对任一素材可增删标签（自建标签全局可复用）、编辑备注、设置状态与评审意见。
2. 每次评审保存形成历史记录（追加式，时间戳留痕），刷新不丢。
3. 导出 JSON（schema v1，含素材清单与全部评审记录）可下载；导入可还原；名称冲突提示。

## Acceptance criteria

### Functional

- [ ] 标签/备注/状态/意见持久化，刷新保留。
- [ ] 评审历史为追加式，多次评审均可见且按时间排序。
- [ ] 导出→清空→导入 往返还原一致。
- [ ] 导入版本不符或结构非法时拒绝并提示。

### Error handling and compatibility

- [ ] 导出/导入失败有明确提示（浏览器限制下载/文件读取失败）。

### UI (if applicable)

- [ ] 面板在窄屏折叠为抽屉可展开。
- [ ] 保存成功有反馈（状态提示）。

## Technical constraints

- 复用 T-002 仓储与 schema；schema 版本变更必须升版本并兼容旧版本导入。

## Implementation notes

- 导出文件名建议 `review-export-YYYYMMDD-HHmmss.json`。

## Test requirements

- [ ] Unit: 标签增删、历史追加排序、导出导入往返、非法导入拒绝。
- [ ] Manual/E2E: 完整"导入→标注→评审→导出→导入还原"链路。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

- 分支：`feature/CR-001-T-007-review`；commit：`2070a53`（`feat: 评审面板与导出导入`）。
- 实现摘要：
  - `src/features/review/ReviewPanel.tsx`：右侧抽屉评审面板（非模态，与查看器并存，查看器 z-index 更高时覆盖面板）。含素材信息、评审结论单选（草稿态，随外部状态变更同步）+ 评审意见 + 保存评审（applyReview 一次追加一条历史）、标签增删（输入自建 / 全局标签库一键复用，addAssetTag/removeAssetTag）、备注独立保存（不追加历史）、保存反馈（role="status"，3s 自动消失）、Esc/关闭按钮、可折叠（aria-expanded）；窄屏（≤40rem）为全宽抽屉。
  - `src/features/review/ReviewHistory.tsx`：评审历史只读列表，最新在前，每条含本地时间戳（YYYY-MM-DD HH:mm:ss）+ 状态徽标 + 意见（无意见有明确占位文案）。
  - `src/features/review/ExportImport.tsx`：导出 JSON 下载（文件名 review-export-YYYYMMDD-HHmmss.json，本地时间；serializeExport，自动剥离 objectUrl）；导入经 parseImportFile 深度校验（非 JSON / 版本不符 / 结构非法均以中文 role="alert" 提示且不改动现有数据），成功后 findNameConflicts 检测名称冲突，有冲突先提示并要求确认（仍然导入/取消），导入语义为整体还原替换，成功有反馈。
  - `src/domain/review.ts`：新增 `updateAssetNote` 纯函数（备注保存，更新 updatedAt，不追加评审历史）；T-002 既有函数未改动。
  - `src/App.tsx`：接线（评审面板状态与五个持久化处理器、ExportImport 区块）；新增 `commit` 统一"领域函数结果 + saveState + 失败提示"落库路径，handleSetStatus / handleDicomMetasParsed 同步复用（行为不变）。
  - `src/features/library/AssetGrid.tsx`：新增可选 `onOpenReview` 回调 + 卡片"评审"按钮（未提供时不渲染，既有行为不变）。**说明**：任务卡 Allowed changes 未列此文件，但"选中素材打开评审面板"须有每卡片入口（image/dicom/model 三类都要能评审），故做了这一最小向后兼容扩展，请 Reviewer 关注。
  - `src/styles.css`：评审面板 / 历史 / 导出导入 / 卡片评审按钮样式（手写 CSS 变量体系，含窄屏媒体查询）。
- 测试：`src/features/review/ReviewHistory.test.tsx`（4）、`ReviewPanel.test.tsx`（13：标签增删/去重/空白、状态提交与草稿同步、备注、历史追加展示、折叠、Esc）、`ExportImport.test.tsx`（9：导出文件名与内容、导出失败提示、导出→清空→导入往返一致、版本不符/非 JSON/结构非法拒绝、名称冲突确认/取消）；`src/domain/review.test.ts` 增补 updateAssetNote 与纯度用例。jsdom 无 globals、RTL 显式 cleanup，参照既有测试模式。
- 验证：`powershell -ExecutionPolicy Bypass -File scripts\verify.ps1` 全绿（21 文件 213 测试通过，tsc -b + vite build 成功）。
- 已知限制：
  - 面板 Esc 与查看器 Esc 同时监听 window：两者并存时按 Esc 会一起关闭（低风险 UX 细节，未做焦点抢占）。
  - 导入为"备份还原"语义（整体替换当前数据），冲突确认文案已明示；未提供"清空"按钮（验收中的"清空"指手动清库后导入，可经浏览器清 localStorage 或 T-010 E2E 覆盖）。
  - 领域层无"历史合并/去重"函数：T-002 的 applyReview 已满足追加式留痕，导入走整体替换，无需合并（未发现缺口，未额外造 API）。
- 建议 Reviewer 关注：AssetGrid 可选回调扩展的合理性；导入整体替换语义；面板与查看器并存/Esc 行为。


## Reviewer result

> Reviewer fills this using the Review template.