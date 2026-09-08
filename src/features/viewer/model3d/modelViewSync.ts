/**
 * STL 双模型比较的相机同步器（CR-012 T-004 / R-030，同步方案 A）。
 *
 * 同步方案说明（任务卡二选一）：**共享 OrbitControls 目标 + 复制相机变换**——
 * 任一侧视图状态（相机 position + controls target）变化时，把该状态完整复制到
 * 另一侧；相机朝向由 lookAt(target) 从 position/target 推导，两侧 Up 向量相同
 * 故朝向一致。相比双向事件同步（方案 B），本方案无需在两实例间转发指针/滚轮
 * 事件，状态唯一、无事件竞态，实现简单可靠（任务卡推荐）。
 *
 * 回环防护：propagate 执行期间忽略所有来源通知——applyViewState 内部
 * controls.update() 触发的联动 change 不会反向再传播；复制为等值幂等覆盖，
 * 同步过程必然收敛终止。
 *
 * 本模块为纯逻辑（不依赖 React / three.js），视图状态用普通三元组表达，
 * 由渲染窗格（ModelComparePanes）适配相机与控制器。
 */

/** 相机/目标点坐标三元组（世界坐标） */
export type ModelViewVec3 = readonly [number, number, number]

/** 一次相机视图状态快照：相机位置 + 控制器目标点（朝向由此推导） */
export interface ModelViewState {
  position: ModelViewVec3
  target: ModelViewVec3
}

/** 比较窗格标识（先选素材在左） */
export type ModelPaneId = 'left' | 'right'

/**
 * 同步参与者：渲染窗格的相机/控制器适配。
 * - getViewState：读取当前相机位置与控制器目标点；
 * - applyViewState：把另一侧状态写入本侧相机与控制器（写入后调用方保证渲染循环拾取）。
 */
export interface ModelViewSyncParticipant {
  getViewState(): ModelViewState
  applyViewState(state: ModelViewState): void
}

export interface ModelViewSync {
  /** 注册窗格参与者；返回注销函数（窗格场景销毁时调用） */
  register(id: ModelPaneId, participant: ModelViewSyncParticipant): () => void
  /** 源侧视图变化：复制源侧状态到另一侧（缺侧/同步中时为无操作） */
  propagate(sourceId: ModelPaneId): void
}

export function createModelViewSync(): ModelViewSync {
  const participants = new Map<ModelPaneId, ModelViewSyncParticipant>()
  let syncing = false
  return {
    register(id, participant) {
      participants.set(id, participant)
      return () => {
        participants.delete(id)
      }
    },
    propagate(sourceId) {
      if (syncing) return // 回环防护：applyViewState 引发的联动 change 不再反向传播
      const source = participants.get(sourceId)
      const other: ModelPaneId = sourceId === 'left' ? 'right' : 'left'
      const target = participants.get(other)
      if (source === undefined || target === undefined) return
      syncing = true
      try {
        target.applyViewState(source.getViewState())
      } finally {
        syncing = false
      }
    },
  }
}
