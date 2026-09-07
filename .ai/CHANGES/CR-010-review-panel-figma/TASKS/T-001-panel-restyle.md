# Task T-001: 右栏评审面板图样重样式

## Metadata

```yaml
id: T-001
cr: CR-010
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 22
depends_on: []
branch: feature/CR-010-T-001-panel-restyle
```

## Context pack

- Requirement: UI-003 细化（CR-010 CHANGE.md）；图样：Human 提供的两张评审面板截图（Review/Metadata 页签、素材头、REVIEW VERDICT、TAGS、AI SUGGESTIONS[Mock]、NOTES、REVIEW HISTORY、DANGER ZONE、合规脚注）
- 关键文件：`src/features/review/ReviewPanel.tsx`（368 行：现 header 标题/折叠/关闭 + 素材信息 + 状态单选 + 标签 + AiPanel + 备注 + 历史 + 危险区）、`src/features/review/AiPanel.tsx`（建议卡片化）、`src/features/review/ReviewHistory.tsx`（计数+空态）、`src/features/review/ExportImport.tsx`（不动）、`src/App.tsx`（rightTab 页签 meta/review——样式联动）、`src/styles.css`（.review-panel/.status-dot 现有；--accent/--warn/--danger/--success 令牌已有）
- 契约/保留：三态评审+追加历史、标签自建/复用、AI 采纳/忽略/重新生成、备注独立保存、删除二次确认、Esc/折叠（若图样无关闭按钮，保留可访问入口：右栏顶部折叠钮，说明取舍）
- 禁止：改 domain/store/io；改 Measurement/其他功能；图样"Adopt Tags (2)"等英文仅作样式参考，界面保持中文文案

## Objective

右栏评审面板按图样重样式：页签下划线（review/meta 联动）、素材头（文件名+状态点+DICOM chip+Series/切片/来源信息）、VERDICT 三态平铺按钮（选中态状态色瓦片+圆点）、Save 青色按钮、TAGS（已存 chips×/输入+Add/Global library 虚线+chips）、AI SUGGESTIONS[Mock]（说明文案+命名卡片+Adopt 按钮+标签卡片+Adopt Tags(N)+摘要卡片+忽略/重新生成）、NOTES、REVIEW HISTORY(N)（空态斜体文案）、DANGER ZONE（红框+Delete Asset 红描边）、页脚（绿点+合规文案：dicom→去标识化? '已去标识化 · 未检测到 PHI' : '存在待核验标识信息'；其他→'工程素材 · 结论可追溯'）。

## Scope

- ReviewPanel 重构渲染结构（区块化 + 分区标题大写 letter-spacing；类名沿用/新加，不破坏既有 aria 查询语义；测试文案断言沿用）
- AiPanel 卡片化（建议命名/标签/摘要卡片 + Adopt/Dismiss/Regenerate；Mock 徽标）
- ReviewHistory 计数头 + 空态文案
- 页签（App rightTab 渲染位置样式：下划线高亮，tab 文案 '评审'/'元数据'）
- 状态瓦片三态色（pending=--warn 琥珀、passed=--success 绿、rejected=--danger 红；圆点+文字）
- 页脚合规（绿点+文案，dicom 依据 dicomMeta.deidentified）
- 测试适配（P-005：文案/角色语义保持；必要时微调选择器，改动说明）
- `scripts\verify.ps1` 全绿（374 存量不回归 + 冒烟）

## Out of scope

- 元数据页签内容；功能/契约变更；ExportImport（顶栏导出入口不动）

## Acceptance criteria

- [ ] 图样六区块齐全（VERDICT/TAGS/AI/NOTES/HISTORY/DANGER）+ 页签下划线 + 页脚
- [ ] 三态评审/标签/AI/备注/删除/历史全部可用且语义不变（既有测试通过）
- [ ] 关闭/折叠可访问性入口保留（说明取舍）
- [ ] 374 存量全绿（语义改动说明）

## Test requirements

- [ ] Unit: verify.ps1（适配说明）
- [ ] Manual: 浏览器对照图样目检

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查

## Builder result

- **分支 / commit / PR**：`feature/CR-010-T-001-panel-restyle`；`4a31966`（feat: 评审面板按图样重样式）；PR #46（https://github.com/Tim-Lai-Admiral/AGdicom/pull/46）
- **实现摘要**：
  - 评审结论（VERDICT）：三态平铺瓦片（三等分 grid）；radio 视觉隐藏但保留键盘焦点流（label focus-within 外描边）；圆点+文字双通道；选中瓦片按状态着色（待评审=--warn 琥珀 / 通过=--success 绿 / 驳回=--danger 红）
  - 素材头：卡片化（文件名 + 类型 chip（mono 描边胶囊，类名 `.review-panel__asset-kind` 沿用）+ StatusDot + 文件/来源）；DICOM 解析出元数据后追加 Series/切片行（UID >16 字符截断显示、title 保留全文）
  - 危险区（DANGER ZONE→中文）：标题改「危险区」，红框 + 红描边「删除素材」按钮；内联二次确认（确认删除=实心红 / 取消）契约不变
  - 合规脚注：绿点 + 文案；DICOM 按 `dicomMeta.deidentified` 分级（已去标识化 · 未检测到 PHI / 存在待核验标识信息，含 meta 未解析时保守提示），其余素材「工程素材 · 结论可追溯」
  - styles.css：分区标题统一大写+字距小标签风；保存/采纳按钮通栏青色（accent）；AI 建议卡片化（Mock 徽标 accent 描边、建议卡片 surface 底）；评审历史空态斜体；页签 `.workbench__tab` 文本+2px 下划线高亮（aria-pressed 与「元数据/评审」文案不变）
- **文件清单**：`src/features/review/ReviewPanel.tsx`、`src/features/review/ReviewPanel.test.tsx`、`src/styles.css`（AiPanel.tsx / ReviewHistory.tsx / App.tsx 零 TSX 改动，卡片化/空态/页签由 CSS 承载）
- **测试适配说明（P-005）**：既有 374 用例零改动通过（aria/role/文案全保留：`getByLabelText('驳回')` 等经 label 关联不受瓦片重构影响）；新增 1 用例（合规脚注三态文案），既有用例补 评审结论/标签/备注/危险区 分区断言。改动 aria 一处：危险区 section `aria-label` 删除素材→危险区（与可见标题一致，无测试依赖）
- **验证结果**：`scripts/verify.ps1` 全绿——38 文件 375 用例通过（374 存量 + 1 新增）+ `tsc -b && vite build` 通过
- **关闭/折叠取舍**：图样无面板头/关闭按钮，保留「收起」（aria-expanded）与「关闭」钮 + Esc（合同要求的可访问入口，Esc 与查看器共用 closeActiveAsset）
- **已知限制 / 需 Reviewer 关注**：① 浏览器对照图样目检（Manual 验收）待复核，尤其三态瓦片选中配色与页签下划线观感；② Series 行用 modality 之外的 UID 截断展示属低风险实现细节，若图样要求别的 series 表达可调；③ 深色/浅色令牌双兼容（`.workbench` 作用域映射），非 workbench  standalone 场景未目检（当前无该用法）
- **未标记 done**：待 Reviewer 审查与 Human 合并