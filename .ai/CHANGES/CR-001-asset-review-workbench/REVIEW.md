# Review: CR-001 T-001~T-004（里程碑审查）

## Metadata

```yaml
task: T-001, T-002, T-003, T-004
cr: CR-001
reviewer: Reviewer
target_commit_or_pr: "feature/CR-001-T-004-image-library @ 523077e"
date: 2026-09-04
result: PASS
```

## 审查范围

- 分支 `feature/CR-001-T-004-image-library`，`git log master..HEAD` 共 9 条提交：
  - `56b4605` scaffold（T-001）、`0a39576` domain-store（T-002）、`ec98a68` import（T-003）、`917ee11` image-library（T-004）
  - 及各任务 `docs: fill T-XXX builder result`（4 条）、`14fa9aa` merge master（仅带入 `8621b13` config-only 提交，无源码影响）
- `git diff master...HEAD`：40 文件，+6661 行，全部为四个任务 Scoped 的新增源码/测试 + 任务卡片 Builder result 追加，无越界改动。

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | T-001~T-004 各目标均已达成，代码与 Builder result 一致 |
| Acceptance criteria | pass | 见各任务分项（下） |
| No out-of-scope changes | pass | `.ai/` 仅追加各任务 Builder result；`src/styles.css` 修改为 T-003/T-004 样式落地所需（详见非阻塞项 N1） |
| CURRENT/architecture respected | pass | 领域类型集中在 `types.ts`，store/domain 分层符合 ARCHITECTURE；未动 `.ai/CURRENT/`、根 `AGENTS.md` |

## 各任务分项结论

### T-001 脚手架 — PASS
- TypeScript strict 已在 `tsconfig.app.json:20` 显式开启；`npm run build`（tsc -b && vite build）无类型错误、产出 dist。
- 依赖清单合理（react/vite/typescript/vitest/jsdom/RTL/three/dicom-parser/@types），`npm ls` 无 peer 冲突（Builder 声明，复跑 build/test 无报错佐证）。
- `vite.config.ts` 用 `vitest/config` 的 `defineConfig` 内嵌测试配置，组织方式可接受（无独立 vitest.config.ts 的必要）。
- 精简干净：无 oxlint、favicon、模板素材残留；`.gitignore` 仅追加 Node/build 段。

### T-002 领域契约 — PASS
- `src/domain/types.ts` 完整定义 AssetKind/AssetStatus/Asset/AssetFile/DicomMeta/ReviewRecord/ReviewHistory/Tag/AppState，字段齐全支撑 T-003/T-005/T-007；含 `isAssetKind`/`isAssetStatus` 守卫与中文标签常量（单一事实来源）。
- `store/repository.ts` 容错到位：损坏 → `corrupted`、存储不可用 → `storage-unavailable`、保存异常 → 抛中文可读 `RepositorySaveError`；`toPersistableState` 单一来源剥离 objectUrl。
- `store/io.ts` schema v1：导出含 `schemaVersion:1`+`exportedAt`；`parseImportFile` 深度结构校验、版本不符/非法 JSON 均抛 `ImportFormatError` 且携带 issue 路径。导出导入往返与非法拒绝均有单测覆盖（io.test.ts 14 例）。

### T-003 导入分类 — PASS
- `importAssets.ts` 扩展名映射（大小写不敏感）；去重键 = fileName+fileSize+kind（同时覆盖存量+batch 内重复）；未知类型进入 `unknown` 附中文提示不注册。
- `useImport.ts` 大文件 ≥10MB 异步提示（`importingLarge`）、保存失败降级、空列表 no-op；objectUrl 会话级安全创建。
- 单测 34 例（15+9+10），App 集成测试复现三类导入/重复/未知类型并 `loadState()` 验证持久化。

### T-004 浏览筛选比较 — PASS
- `filter.ts` 纯函数：kind/status/tag/search 四维 AND 组合；空结果返回空数组；`collectTagNames` 注册表∪在用标签、码点排序确定。
- 状态徽标 `StatusBadge.tsx` 颜色+文字双通道；App 层 `setAssetStatus`（纯函数）+`saveState` 持久化，刷新保留（有 App 测试断言 localStorage 与评审历史）。
- `CompareView.tsx` 双图等宽并排、`role="dialog"`、"退出比较"按钮 + Esc 关闭、打开时聚焦退出按钮。
- 单测 60 例新增，filter/StatusBadge/Filters/CompareView/AssetGrid/App 集成全覆盖。

## Tests

| Verification | Result | Evidence |
|---|---|---|
| Unit + React 组件测试 | pass | 复跑 `npm.cmd test`：12 文件 / **114 tests 全绿** |
| TypeScript 构建 | pass | 复跑 `npm.cmd run build`：tsc -b 无类型错误，vite build 成功（27 modules） |
| Manual E2E | not run（Reviewer 未手动浏览器复核） | Builder 以 App 集成测试复现核心流程；窄屏滚动观感、真实图片 objectUrl 渲染为 jsdom 无法覆盖的剩余缺口（见 N3） |

## Findings

### Blocker
- 无。

### Major
- 无。

### Minor / non-blocking

- **N1（范围边界说明，可接受）**：`src/styles.css`（577 行）改动不在 T-003/T-004 任务卡片 Allowed changes 的显式文件清单内，但 ImportZone/网格/徽标/比较视图样式必须落地，且 DESIGN 约束"手写 CSS（CSS 变量）、不引 UI 框架"，`:root` 变量令牌顺带建立属合理局部整理。建议后续任务卡片在 Allowed changes 里显式列入样式文件，避免同类追问。——不阻塞。
- **N2（objectUrl 刷新后无法重建，技术债，建议登记 TODO）**：T-003 未保留原始 File 引用，T-004 采用"刷新后预览占位 + 提示重新导入"策略；但重新导入同一文件会被 T-003 去重（`useImport.ts:115-117` 的 `duplicates` 路径不重新 attach objectUrl），因此**当前无任何用户路径恢复刷新后的图片预览**。Builder 已如实记录并归因于 T-003 契约调整（属跨任务边界，未擅动）。该限制不影响 R-002 验收（"状态徽标持久化""比较可进入可退出"均不依赖 objectUrl 重建），但属真实产品缺口。**建议登记 `.ai/TODO.md`**，指向两个候选方案：a) T-003 `useImport` 重复导入时为既有 image 素材重建 objectUrl；b) IndexedDB 存 blob（新存储层，需 Planner/Human 决策）。
- **N3（测试盲区，jsdom 无法覆盖）**：真实图片 objectUrl 的 `<img>` 渲染与 onError 降级、窄屏筛选横向滚动观感、Esc/键盘流程的真实浏览器行为，需一次手动 E2E 复核。App/组件测试已覆盖逻辑与 DOM，缺口仅剩浏览器视觉/资源加载层面。
- **N4（UX 权衡，非契约）**：状态徽标采用单按钮循环切换（pending→passed→rejected→pending），从"待评审"设到"驳回"需两次点击，且与「三选一点击区」相比直观性略弱。Builder 已说明可替换 UI 层不影响契约；不阻塞。
- **N5（低风险）**：Filters 使用静态 DOM id（`library-filter-*`），假定单实例渲染；标签"全部"用空串 option 表示，依赖 T-002"不产生空名标签"约定。均有 Builder 已知限制记录，当前单视图 SPA 下无实际风险。

## Recommendation

**PASS**。四个任务均满足各自主目标与验收标准，契约、容错、范围纪律与测试质量均达标；构建与 114 项测试复跑全绿。唯一值得长期跟进的是 objectUrl 刷新后无法重建的技术债（N2），建议登记 `.ai/TODO.md` 而非阻塞本里程碑。审查通过不自动授权合并；是否合并由 Human 决定。
