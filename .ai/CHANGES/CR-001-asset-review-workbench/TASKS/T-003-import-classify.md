# Task T-003: 素材导入与分类

## Metadata

```yaml
id: T-003
cr: CR-001
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
depends_on: [T-002]
branch: feature/CR-001-T-003-import
```

## Objective

实现拖拽/文件选择导入：按扩展名分类（image/dicom/model）、去重、未知类型拒绝，并注册入仓储。

## Context and inputs

- Requirement(s): R-001
- Current architecture/design references: CR-001 ARCHITECTURE.md（features/library 导入部分）
- Dependency output: T-002 领域类型与仓储

## Scope

Allowed changes:

- `src/features/library/importAssets.ts`（纯函数）：扩展名→类型映射、去重（名称+大小+类型）、未知类型错误。
- `src/features/library/useImport.ts`：File API 读取（FileReader/objectURL）、调用注册。
- `src/features/library/ImportZone.tsx`：拖拽区 + 文件选择按钮 + 结果反馈（成功/重复/失败）。
- `src/features/library/importAssets.test.ts`：单测。
- `src/App.tsx`：接入导入区与素材库空态。

## Out of scope

- 素材网格/筛选（T-004）。
- DICOM 解析（T-005）、3D 查看器（T-006）。

## Expected behavior

1. 拖入或选择 `.png/.jpg/.jpeg/.gif/.webp/.bmp` → image；`.dcm` → dicom；`.stl/.obj/.glb/.gltf` → model。
2. 未知扩展名 → 明确错误提示，不注册。
3. 重复（同名称+大小+类型）→ 提示已存在，不重复注册。
4. 导入后素材出现在库中（T-004 完成前先用简单列表验证）。

## Acceptance criteria

### Functional

- [ ] 三类素材各至少一次成功导入。
- [ ] 未知类型与重复导入有明确反馈。
- [ ] 导入后数据存在于仓储（刷新仍在）。

### Error handling and compatibility

- [ ] 大文件（≥10MB）导入不卡死（异步处理 + 提示）。
- [ ] 取消选择/空文件列表时无副作用。

### UI (if applicable)

- [ ] 拖拽区有视觉反馈（拖入高亮）。

## Technical constraints

- 不读取文件内容做类型嗅探（仅扩展名），DICOM 内容解析留给 T-005。

## Implementation notes

- 文件持久化为 objectURL（`URL.createObjectURL`），素材记录保存引用；注意刷新后重建（T-002 仓储存 name/type/size，URL 在会话内重建即可——若影响验收则改为内存会话缓存）。

## Test requirements

- [ ] Unit: 扩展名映射、去重、未知类型单测。
- [ ] Manual/E2E: 三类文件拖入/选择导入成功，重复与未知类型提示正确。

## Definition of done

- [ ] Acceptance criteria satisfied.
- [ ] Required tests pass.
- [ ] No unrelated changes.
- [ ] Git diff is ready for review.
- [ ] Reviewer has approved.

## Builder result

> Builder fills this before requesting review.

- **Task**: T-003（素材导入与分类）
- **Branch**: `feature/CR-001-T-003-import`
- **Commits**: `ec98a68` feat: asset import with type classification（代码）；本卡片的填写随后以 `docs: fill T-003 builder result` 单独提交在同一分支

### Implementation summary

- `src/features/library/importAssets.ts`（纯函数）：`EXTENSION_KIND_MAP` 扩展名→类型映射（png/jpg/jpeg/gif/webp/bmp→image；dcm→dicom；stl/obj/glb/gltf→model，大小写不敏感）；`classifyImportFiles(state, files, options)` 输出结构化结果 `{ state, created, duplicates, unknown }`；去重键 = fileName + fileSize + kind（同时覆盖库中存量与本批次内部重复）；未知扩展名进入 `unknown` 列表并附中文提示（`SUPPORTED_TYPES_HINT`），不注册；`now`/`createId`/`source` 可注入，不修改入参。
- `src/features/library/useImport.ts`（Hook）：`importFiles(files, source?)` 异步处理（先渲染“导入中”再处理，≥10MB 标记 `importingLarge`）；为新素材创建会话级 objectUrl（`attachObjectUrls`，jsdom 未实现时安全跳过）；调用 `saveState` 持久化，保存失败（RepositorySaveError）转为反馈消息且内存状态保留；空文件列表为 no-op；维护 `importing / importingLarge / feedback / clearFeedback`。
- `src/features/library/ImportZone.tsx`（UI）：拖拽区（dragenter/dragover 高亮 `is-active`，dragleave 用 relatedTarget 判断避免子元素闪烁；drop 导入，source=‘拖拽导入’）+ 文件选择按钮（hidden input，change 后重置 value 以支持重复选择同一文件，source=‘文件选择导入’）；importing 期间忽略新事件并禁用按钮；反馈面板显示成功计数 / 重复列表（附类型中文标签）/ 未知类型原因 / 保存异常，可“知道了”关闭。
- `src/App.tsx`：从 `loadState()` 初始化 AppState（读取异常显示降级警告），接入 ImportZone 与 `useImport`；素材以简单列表展示（名称+类型，`ASSET_KIND_LABELS`），空态提示导入方式——完整网格留待 T-004。
- `src/styles.css`：建立 CSS 变量设计令牌（`:root`），新增导入区/反馈/列表样式（未引入 UI 框架，符合 DESIGN 约束）。

### Files changed

新增：`src/features/library/importAssets.ts`、`useImport.ts`、`ImportZone.tsx`、`importAssets.test.ts`、`ImportZone.test.tsx`、`useImport.test.tsx`；修改：`src/App.tsx`、`src/App.test.tsx`、`src/styles.css`。共 9 个文件（含 3 个测试文件）。

### Tests run and results

- `npm.cmd test`（vitest，jsdom）：**7 个测试文件、70/70 通过**（含 T-001/T-002 既有 34 个）。
  - `importAssets.test.ts` 15 个：扩展名映射（大小写/多级后缀/无后缀/隐藏文件）、三类注册、source/id/时间注入、未知类型不注册、存量去重、批次内去重、同名不同大小不误判、混合批次、入参不可变。
  - `useImport.test.tsx` 9 个：注册+objectUrl+持久化（loadState 复检、objectUrl 剥离）、三类混合导入顺序、跨批次去重、重复不写存储、未知类型反馈、空列表 no-op、≥10MB 大文件完成导入、保存失败反馈（内存状态保留）、清除反馈。
  - `ImportZone.test.tsx` 10 个：拖入高亮/离开取消、drop 与选择分别以正确 source 调用、importing 期间忽略事件、空文件列表无副作用、大文件提示、反馈渲染与关闭。
  - `App.test.tsx` 2 个：空态渲染；拖拽导入集成（三类成功→重复提示→未知类型提示，且 `loadState()` 验证持久化，计数保持 3）。
  - 备注：vitest 未启用 `globals`，RTL 自动 cleanup 不生效，组件测试中已显式 `cleanup()`。
- `npm.cmd run build`（`tsc -b && vite build`）：**成功，无类型错误**。
- `npm.cmd run dev`：**启动成功，`GET /` 返回 HTTP 200**（拖拽/选择的完整手动交互以组件测试与 App 集成测试覆盖，浏览器手动复核建议由 Reviewer 顺带执行）。

### Known limitations

1. 去重按 fileName+fileSize+kind 精确匹配：同名同大小但不同扩展名的文件不会互相去重（kind 由扩展名决定，天然不冲突）；`a.png` 与 `a.PNG` 视为不同文件（文件名区分大小写）。
2. `importFiles` 并发调用各自基于闭包内 state 快照，后完成者会覆盖先完成者；ImportZone 已在 importing 期间忽略新事件规避，若未来其他入口直接调用 hook 需自行防并发。
3. objectUrl 为会话字段：刷新后素材记录仍在（localStorage），但 blob URL 失效，T-004+ 展示层需懒重建（预期行为，见 T-002 契约注释）；当前未提供 revoke 时机（素材删除属于后续任务）。
4. 本任务未读取文件内容（仅扩展名分类，符合技术约束）；DICOM 元数据解析、真实预览分别属于 T-005/T-006。
5. `styles.css` 不在任务 Scope 的 Allowed changes 列表中，但 ImportZone 的样式必须落地；项目无 CSS 模块约定且 DESIGN 约束“手写 CSS（CSS 变量）”，故在 `src/styles.css` 内新增样式并顺带建立 `:root` 变量——请 Reviewer 确认此边界。

### For reviewer

- 重点看 `classifyImportFiles` 的去重键与“无新增时返回原 state 引用”的约定，以及 `useImport` 中“分类（纯函数）→ attach objectUrl → setState → saveState”的数据流顺序是否符合架构意图。
- App.test.tsx 的集成测试即为验收标准的三类导入/重复/未知类型的自动化复现；拖拽高亮在 ImportZone.test.tsx 验证。
- 反馈文案全部为中文，医疗无关文案，符合 DESIGN 约束。

## Reviewer result

> Reviewer fills this using the Review template.