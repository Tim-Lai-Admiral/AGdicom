/**
 * 图片并排比较视图（CR-001 T-004 / R-002）。
 *
 * 应用内视图状态（非路由）：由上层在选中两张图片时渲染于工作台中央查看区
 * （CR-003 T-002 布局壳 / T-004 归位）；两张图片等尺寸并排（等分栅格 +
 * object-fit: contain）；“退出比较”按钮与 Esc 键均可退出。
 * objectUrl 缺失或加载失败时显示占位与提示，不影响另一侧。
 */
import { useEffect, useRef, useState } from 'react'
import type { Asset } from '../../domain/types.ts'

// 幽灵占位提示统一措辞（CR-006 T-004，与 AssetGrid/ImageStage 一致）
const PREVIEW_UNAVAILABLE = '图片预览不可用：会话失效，可重新导入或删除该素材'
const LOAD_FAILED = '图片加载失败'

/** 单侧图片窗格：等分宽度 + 等高视口；名称置于图下 */
function ComparePane({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false)
  const objectUrl = asset.objectUrl
  // objectUrl 变化（如重新导入后）时复位加载失败状态
  useEffect(() => {
    setFailed(false)
  }, [objectUrl])

  return (
    <figure className="compare-pane">
      <div className="compare-pane__viewport">
        {objectUrl === undefined || failed ? (
          <p className="compare-pane__placeholder">
            {failed ? LOAD_FAILED : PREVIEW_UNAVAILABLE}
          </p>
        ) : (
          <img
            className="compare-pane__img"
            src={objectUrl}
            alt={`素材“${asset.name}”的图片预览`}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <figcaption className="compare-pane__name" title={asset.name}>
        {asset.name}
      </figcaption>
    </figure>
  )
}

export interface CompareViewProps {
  /** 左侧图片（先选中的） */
  left: Asset
  /** 右侧图片（后选中的） */
  right: Asset
  /** 退出比较（“退出比较”按钮与 Esc 键均触发） */
  onExit: () => void
}

export default function CompareView({ left, right, onExit }: CompareViewProps) {
  const exitButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // 弹层打开后聚焦退出按钮（键盘用户可直达），并监听 Esc 关闭
    exitButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onExit])

  return (
    <div className="compare-overlay">
      <section className="compare" role="dialog" aria-label="图片比较">
        <header className="compare__header">
          <h2 className="compare__title">图片比较</h2>
          <p className="compare__esc-hint">两张图片等尺寸并排显示，按 Esc 也可退出</p>
          <button type="button" ref={exitButtonRef} className="compare__exit" onClick={onExit}>
            退出比较
          </button>
        </header>
        <div className="compare__panes">
          <ComparePane asset={left} />
          <ComparePane asset={right} />
        </div>
      </section>
    </div>
  )
}
