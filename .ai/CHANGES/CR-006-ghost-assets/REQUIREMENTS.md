# Requirements Delta: CR-006

## R-014: 重导入水合

**Status**: approved

**Behavior**

```text
Given 幽灵资产（持久化记录存在、无可用 objectUrl）
When 用户重新导入去重键（fileName+fileSize+kind）相同的文件
Then 不新增记录：为该资产重建 objectUrl 并回写（水合）
And 反馈"已恢复预览"；再次刷新前预览/查看器可用
```

**Acceptance criteria**

- [ ] 水合后资产可预览（image）/ 可解析（dicom）/ 可加载（model）
- [ ] 非幽灵（已有 objectUrl）去重行为不变（仍报重复）
- [ ] 单测覆盖：幽灵命中/非幽灵命中/水合后持久化不落 objectUrl

## R-015: 资产删除

**Status**: approved

**Behavior**

```text
Given 任一素材（含幽灵）
When 用户点击删除（行内按钮或评审面板入口）
Then 二次确认后：删除资产记录、其评审历史、DICOM 元数据、关联 IndexedDB blob（若 T-003 已启用）
And 列表/分组/中央查看区同步消失
```

**Acceptance criteria**

- [ ] 行内删除按钮（选中行）与评审面板删除入口均可用
- [ ] 级联清理无残留（grep/单测：review 无孤儿、series 分组重建）
- [ ] 删除后重导入同一文件 → 正常新增（无幽灵残留）

## R-016: IndexedDB 二进制持久化

**Status**: approved

**Behavior**

```text
Given 导入文件（≤20MB）
When 注册资产
Then 文件 blob 写入 IndexedDB（键=去重键或 assetId），供刷新后恢复
Given 刷新启动
When 加载状态
Then 从 IndexedDB 恢复 blob 并重建 objectUrl → 预览/查看立即可用，无需重导入
Given 单文件 >20MB
When 导入
Then 不入库（会话态 objectUrl + R-014 水合兜底），界面提示
Given 删除资产
When 删除
Then 同步删除对应 blob
Given IndexedDB 写入失败/配额满
When 导入
Then 降级为会话态并提示，不阻塞导入
```

**Acceptance criteria**

- [ ] 刷新后 20MB 内素材 objectUrl 自动恢复（image 预览可见）
- [ ] >20MB 文件行为：会话内可用，刷新后走水合（提示）
- [ ] 删除素材同步删 blob（IndexedDB 无残留）
- [ ] 单测：fake-indexeddb 或注入式存储接口覆盖 保存/恢复/删除/超限/失败降级

## 非目标

- 导出 JSON 含二进制；配额管理；自动清理幽灵。