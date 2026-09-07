/**
 * 中央图片预览区（CR-003 T-002 / UI-001）。
 *
 * 选中 image 素材时中央查看区显示该图片（会话级 objectUrl）；缺失或加载失败
 * 时显示占位与提示（与 AssetGrid/CompareView 的 objectUrl 会话字段约定一致），
 * 不影响布局。仅预览，不含比较（比较由 CompareView 承载）。
 */
import { useEffect, useState } from 'react'
import type { Asset } from '../../domain/types.ts'

// 幽灵占位提示统一措辞（CR-006 T-004，与 AssetGrid/CompareView 一致）
const PREVIEW_UNAVAILABLE = '图片预览不可用：会话失效，可重新导入或删除该素材'
const LOAD_FAILED = '图片加载失败'

export default function ImageStage({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false)
  const objectUrl = asset.objectUrl
  // objectUrl 变化（如重新导入后）时复位加载失败状态
  useEffect(() => {
    setFailed(false)
  }, [objectUrl])

  return (
    <figure className="image-stage" aria-label="图片预览">
      <div className="image-stage__canvas">
        {objectUrl === undefined || failed ? (
          <p className="image-stage__placeholder">
            {failed ? LOAD_FAILED : PREVIEW_UNAVAILABLE}
          </p>
        ) : (
          <img
            className="image-stage__img"
            src={objectUrl}
            alt={`素材“${asset.name}”的图片预览`}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <figcaption className="image-stage__name" title={asset.name}>
        {asset.name}
      </figcaption>
    </figure>
  )
}
