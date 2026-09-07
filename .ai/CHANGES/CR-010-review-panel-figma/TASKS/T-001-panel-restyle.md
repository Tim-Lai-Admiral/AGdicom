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