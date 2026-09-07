# CR-006: 幽灵素材问题（水合 + 删除 + IndexedDB 持久化）

## Metadata

```yaml
id: CR-006
title: "刷新后幽灵素材：重导入水合、资产删除能力、IndexedDB 二进制持久化（TD-001 解决）"
change_level: L2
status: approved
parent: null
created_by: Planner
created_at: 2026-09-06
```

## Why

TD-001（refresh 后 objectUrl 无法重建）导致的用户问题：刷新后素材成为"幽灵"（占位、无法预览），重新导入因去重被静默跳过，且应用无删除能力，幽灵无法清理；文件变化时新旧重复。Human 2026-09-06 决定解决：重导入水合 + 资产删除 + IndexedDB 持久化（20MB 阈值，删除入口=行内+评审面板）。

## Goal

- 重导入命中幽灵资产时重建 objectUrl（水合），不再静默跳过。
- 提供资产删除能力（行内 + 评审面板，级联清理评审/元数据/blob）。
- IndexedDB 持久化文件 blob：刷新后自动恢复 objectUrl，无需重新导入；>20MB 单文件降级会话态。

## Non-goals

- 导出 JSON 包含二进制（备份语义不变，仍为元数据+评审）。
- 浏览器配额管理策略（仅降级提示）。
- 幽灵自动清理（保留可见，供用户手动删除）。

## Requirement changes

### Added

- R-014: 重导入水合：去重命中且资产无可用 objectUrl（幽灵）时，重建 objectUrl 并回写该资产，不新增记录；反馈"已恢复预览"。
- R-015: 资产删除：行内与评审面板删除入口（二次确认）；级联删除评审历史、DICOM 元数据、对应 IndexedDB blob。
- R-016: IndexedDB 二进制持久化：导入时 blob 入库（键=去重键；单文件 >20MB 不入库，走会话态+水合）；启动时恢复并重建 objectUrl；删除素材同步删 blob；配额失败降级提示。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | major | 刷新体验根治；新增删除能力 |
| UX/UI | minor | 行内删除按钮 + 水合反馈 |
| Architecture | minor | 新增存储层（localStorage + IndexedDB 双存储） |
| Data / API | minor | repository 扩展；删除/水合纯函数 |
| Testing | major | 存储层与交互测试（jsdom 缺 IndexedDB → 用 fake-indexeddb 或抽象接口） |

## Tasks

- [ ] T-001: 资产删除能力（domain + 行内/评审面板 UI + 级联清理）
- [ ] T-002: 重导入水合（去重命中幽灵 → 重建 objectUrl）
- [ ] T-003: IndexedDB 二进制持久化（存储层 + 导入/恢复管线 + 20MB 阈值）
- [ ] T-004: 收尾（幽灵文案统一、README/TD-001 更新、全量回归）

## Dependencies

- TD-001（本 CR 解决）；T-003 依赖 T-001（删除级联 blob）

## Approval

- [x] Human approved scope（2026-09-06：P1+P2 全做；删除入口=行内+评审面板；IndexedDB 阈值 20MB）

## Result

<!-- 合并后填写 -->