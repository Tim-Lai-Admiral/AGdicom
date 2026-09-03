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

## Reviewer result

> Reviewer fills this using the Review template.