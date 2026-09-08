/**
 * modelViewSync 单元测试（CR-012 T-004 / R-030）。
 *
 * 同步方案 A 的核心契约：任一侧视图变化 → 相机变换（position + target）完整
 * 复制到另一侧；applyViewState 引发的联动通知被回环防护吸收（不反向传播）；
 * 缺侧（未加载完成 / 已注销）时传播为无操作。
 */
import { describe, expect, it } from 'vitest'
import type { ModelPaneId, ModelViewState, ModelViewSyncParticipant } from './modelViewSync.ts'
import { createModelViewSync } from './modelViewSync.ts'

/**
 * 参与者桩：内部状态可变（模拟相机被用户交互改变），applyViewState 记录每次写入
 * 并可选回呼 onApply（模拟真实窗格中 controls.update() 联动派发的 change 事件）。
 */
function makePane(state: ModelViewState, onApply?: () => void) {
  const participant: ModelViewSyncParticipant & { applied: ModelViewState[] } = {
    applied: [],
    getViewState: () => state,
    applyViewState: (next: ModelViewState) => {
      state.position = next.position
      state.target = next.target
      participant.applied.push(next)
      onApply?.()
    },
  }
  return participant
}

describe('modelViewSync（CR-012 T-004 / R-030 相机同步）', () => {
  it('左侧视图变化后 propagate 把相机变换完整复制到右侧', () => {
    const sync = createModelViewSync()
    const leftState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const rightState: ModelViewState = { position: [1, 2, 3], target: [4, 5, 6] }
    const left = makePane(leftState)
    const right = makePane(rightState)
    sync.register('left', left)
    sync.register('right', right)

    // 用户在左侧旋转/平移/缩放 → 左侧状态更新 → 派发 change（propagate）
    leftState.position = [2, -1, 7.5]
    leftState.target = [0.5, 0.25, 0]
    sync.propagate('left')

    // 右侧相机变换 = 左侧相机变换（position 与 target 逐值断言）
    expect(rightState.position).toEqual([2, -1, 7.5])
    expect(rightState.target).toEqual([0.5, 0.25, 0])
  })

  it('右侧同样可以驱动左侧（双向同步）', () => {
    const sync = createModelViewSync()
    const leftState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const rightState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    sync.register('left', makePane(leftState))
    sync.register('right', makePane(rightState))

    rightState.position = [-3, 0.5, 2]
    rightState.target = [1, 1, 1]
    sync.propagate('right')

    expect(leftState.position).toEqual([-3, 0.5, 2])
    expect(leftState.target).toEqual([1, 1, 1])
  })

  it('applyViewState 触发的联动 change 不再反向传播（回环防护，必然收敛）', () => {
    const sync = createModelViewSync()
    const leftState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const rightState: ModelViewState = { position: [9, 9, 9], target: [8, 8, 8] }
    // 真实窗格中 applyViewState 内 controls.update() 会联动派发 change → propagate；
    // 此处以回调模拟该联动（对侧收到状态后尝试反向传播回源侧）
    const left = makePane(leftState)
    const right = makePane(rightState, () => sync.propagate('left'))
    sync.register('left', left)
    sync.register('right', right)

    leftState.position = [1, 1, 1]
    leftState.target = [0, 0, 0]
    expect(() => sync.propagate('left')).not.toThrow()

    // 右侧收到复制；联动传播被吸收（右侧只写入一次，状态保持源侧等值）
    expect(rightState.position).toEqual([1, 1, 1])
    expect(rightState.target).toEqual([0, 0, 0])
    expect(right.applied).toHaveLength(1)
  })

  it('对侧未注册（未加载完成）时 propagate 为无操作，不抛错', () => {
    const sync = createModelViewSync()
    const leftState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    sync.register('left', makePane(leftState))
    expect(() => sync.propagate('left')).not.toThrow()
    expect(() => sync.propagate('right')).not.toThrow()
  })

  it('unregister 后（场景销毁）不再参与同步', () => {
    const sync = createModelViewSync()
    const leftState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const rightState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const unregisterLeft = sync.register('left', makePane(leftState))
    sync.register('right', makePane(rightState))

    unregisterLeft()
    leftState.position = [5, 5, 5]
    sync.propagate('left')

    expect(rightState.position).toEqual([0, 0, 10])
  })

  it('连续多次传播保持等值收敛（复制幂等，无漂移）', () => {
    const sync = createModelViewSync()
    const leftState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const rightState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const left = makePane(leftState)
    const right = makePane(rightState)
    sync.register('left', left)
    sync.register('right', right)

    // 连续 5 帧交互 + 重复传播同一状态
    for (let i = 1; i <= 5; i += 1) {
      leftState.position = [i, 0, 10 - i]
      sync.propagate('left')
    }
    sync.propagate('left')

    expect(rightState.position).toEqual([5, 0, 5])
    // 每次交互帧都有一次写入；重复传播同一状态同样写入（等值覆盖，无累积误差）
    expect(right.applied).toHaveLength(6)
    expect(right.applied[5]?.position).toEqual([5, 0, 5])
  })

  it('register 返回的注销函数可重复调用（删除为幂等）', () => {
    const sync = createModelViewSync()
    const leftState: ModelViewState = { position: [0, 0, 10], target: [0, 0, 0] }
    const unregister = sync.register('left' as ModelPaneId, makePane(leftState))
    unregister()
    expect(() => unregister()).not.toThrow()
  })
})
