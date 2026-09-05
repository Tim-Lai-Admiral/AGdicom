# Review: T-009 & T-010 (终审)

## Metadata

```yaml
task: T-009, T-010
cr: CR-002
reviewer: Reviewer
target_commit_or_pr: "PR #10 (feature/CR-002-T-009-samples, merge 基线 fe6a9f5) / PR #11 (feature/CR-002-T-010-finish, HEAD 6e28a1b+a8e94a6)"
date: 2026-09-05
result: PASS
```

## 审查对象与方法

- 按规则 7，审查对象为 PR #10 / #11（`gh pr view` + `gh pr diff`），非 working tree。
- PR #11 分支基于 #10 之上（含 T-009 全部变更），故在 #11 上复跑统一验证一次。
- 复跑：`powershell -ExecutionPolicy Bypass -File scripts\verify.ps1`（当前 HEAD = origin/feature/CR-002-T-010-finish）。
- 附加独立验证：pydicom 脚本幂等复跑、产物标签回读、series 结构检查。

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| T-009 目标满足（R-007 合成 DICOM + 素材章节） | pass | 脚本与 18 个 `.dcm`；README「素材样本」章节覆盖四要素 + TCIA 指引 |
| T-009 验收：脚本幂等且去标识化 | pass | 复跑 SHA256 18/18 一致（IDEMPOTENT_MATCH: True）；(0012,0062)=YES、(0012,0063)=AGDICOM-SYNTHETIC-PHANTOM、PatientName/ID 空 |
| T-009 验收：≥2 series、≥5 切片、去标识化标记 | pass | 3 series × 6 切片 = 18 文件；回读确认 3 个 SeriesInstanceUID |
| T-009 验收：产物被应用识别为多切片 series | pass | 应用解析栈 + DicomViewer.test 覆盖；Builder 已用应用自身解析层验证（同一 parseDicom/sliceCountByAsset 层） |
| T-009 验收：README 素材章节四要素 + TCIA | pass | README.md L54-85 覆盖来源/格式/获取方式/使用范围 + TCIA 指引（含许可/不识别个人/纯前端不落服务器） |
| T-010 目标满足（R-008 交付文档 + Minor + TD-002） | pass | README 完整化、E2E-CHECKLIST、TD-002 lazy 拆分、T-005 Minor 三项修复 |
| T-010 验收：verify.ps1 全绿 + build 通过 | pass | 复跑 24 files / 238 tests passed + tsc -b && vite build 成功 |
| T-010 验收：E2E 清单逐项执行 | pass | E2E-CHECKLIST.md 全链路 8 节逐项 `[x]`，仅「真机 WebGL 交互」标人工（jsdom 无 WebGL，属合理） |
| T-010 验收：README 与实现一致、已知问题如实 | pass | 7 项已知问题与代码实际一致（TD-001、压缩不解码、3D 仅 STL、localStorage、mock AI、焦点圈定范围、WebGL 未自动化） |
| T-010 验收：Minor + TD-002 有测试覆盖 | pass | buildDicomFile.test.ts（tag 升序字节遍历）；DicomViewer.test.tsx（JPEG2000 文案 + 焦点圈定/还原 2 测试）；App.test.tsx（findByRole 等 lazy 挂载） |
| 范围纪律：无越界（TD-001 未动、无用顺手改） | pass | diff 仅 30 文件，全在 scope；grep 无 indexedDB 引入；未改 `.opencode/`、`ENVIRONMENT.md` |
| PR body 含概要（规则 6 附则） | pass | PR #10/#11 body 均含实现摘要 + 验证 + 任务卡链接 |

## Tests

| Verification | Result | Evidence |
|---|---|---|
| 统一验证 verify.ps1（复跑） | pass | 24 test files / 238 tests passed；`tsc -b && vite build` ✓；输出 `== verify OK ==` |
| DICOM 脚本幂等（独立复跑） | pass | 重新运行 `python scripts/generate_sample_dicom.py` → 18/18 SHA256 一致 |
| 产物去标识化 + 结构（pydicom 回读） | pass | 18 文件/3 series；128×128；PatientName='' PatientID='' 0012,0062=YES 0012,0063=AGDICOM-SYNTHETIC-PHANTOM |
| TD-002 代码分割确认 | pass | `dist/assets/Model3DViewer-0n2LTUYd.js` 553.30 kB 独立 chunk；主包 index 278.67 kB 不含 three |
| CI（gh pr checks） | pass | PR #10 verify pass（33s）；PR #11 verify pass（46s） |

## Findings

### Blocker

- None

### Major

- None

### Minor / non-blocking

- `src/features/viewer/dicom/DicomViewer.tsx:276`（focus trap effect 依赖 `[onClose]`）：`onClose` 在 App 中为内联函数（`src/App.tsx:90` 等，非 useCallback），父组件每次渲染都会产生新引用，导致该 effect（含 `previouslyFocused` 捕获与 `closeButtonRef.current?.focus()`）在每次顶层状态变更时重新执行。潜在后果：用户 Tab 导航中途若发生父级重渲染，焦点会被重置回关闭按钮，打断了键盘操作连续性。**此为既有行为**（原 effect 依赖本就是 `[onClose]`，本次仅扩充函数体，非本次引入的回归），不阻塞；建议后续将 `onClose` 经 `useCallback` 稳定化或把 effect 拆为「仅挂载时捕获 previouslyFocused + 独立 keydown 监听」。
- `README.md:81`（TCIA 指引措辞「多数为 TCIA License / CC BY 类」）+ E2E-CHECKLIST 备注：属文案级说明，与 R-007「TCIA 指引」验收无冲突（覆盖了许可与使用注意），可选精化，不阻塞。
- `dist` Model3DViewer chunk 553.30 kB 触发 vite `>500 kB` 体积警告：Builder 已如实记录（TD-002 目标是移出首屏关键路径，非继续拆分 three），非阻塞。

## 范围纪律补充确认

- `REVIEW-T006-008.md` 出现在 #11 diff 中，属历史 commit `83dd761`（T-008 里程碑审查报告）随分支历史带入，非本任务改动，无越界。
- TD-001（IndexedDB）未在本 PR 处理，符合 T-010「Out of scope：TD-001」约定（README 已知问题第 1 条已如实标注为其未实现项）。

## Recommendation

**PASS**（T-009 + T-010 均满足要求，可交付合并；合并权属 Human，按规则 10/合并后删分支处理）。

- 下一动作：Human 合并 PR #10 → #11（#11 已含 #10 变更，合并 #11 即可携带 T-009）；合并后由协调者更新 `.ai/CURRENT/`。
- 遗留人工项（非阻塞）：E2E-CHECKLIST 第 4 节「真机 WebGL 交互」仍待人工浏览器复核，建议 Human 在合并后做一次最终真机抽查。
