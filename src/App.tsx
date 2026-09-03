import './styles.css'
import { useState } from 'react'
import { ASSET_KIND_LABELS } from './domain/types.ts'
import type { AppState } from './domain/types.ts'
import { loadState } from './store/repository.ts'
import type { LoadIssue } from './store/repository.ts'
import ImportZone from './features/library/ImportZone.tsx'
import { useImport } from './features/library/useImport.ts'

/** 读取异常的可提示文案（T-002 仓储契约的 UI 呈现） */
const LOAD_ISSUE_MESSAGES: Readonly<Record<LoadIssue, string>> = {
  corrupted: '本地存储数据异常，已恢复为空素材库；如有导出的 JSON 备份可稍后导入恢复。',
  'storage-unavailable': '浏览器本地存储不可用：素材仍可导入，但刷新后无法保留。',
}

function App() {
  const [initialLoad] = useState(() => loadState())
  const [state, setState] = useState<AppState>(initialLoad.state)
  const { importFiles, importing, importingLarge, feedback, clearFeedback } = useImport({
    state,
    onStateChange: setState,
  })
  const assets = Object.values(state.assets)

  return (
    <main className="app">
      <h1 className="app__title">素材评审工作台</h1>
      {initialLoad.issue !== null ? (
        <p className="app__storage-warning" role="alert">
          {LOAD_ISSUE_MESSAGES[initialLoad.issue]}
        </p>
      ) : null}
      <ImportZone
        importing={importing}
        importingLarge={importingLarge}
        feedback={feedback}
        onImportFiles={importFiles}
        onClearFeedback={clearFeedback}
      />
      <section className="asset-list" aria-label="素材库">
        <h2 className="asset-list__title">素材库（{assets.length}）</h2>
        {assets.length === 0 ? (
          <p className="asset-list__empty">
            尚无素材：拖拽或选择文件导入，导入后素材保存在本地浏览器中
          </p>
        ) : (
          <ul className="asset-list__items">
            {assets.map((asset) => (
              <li className="asset-list__item" key={asset.id}>
                <span className="asset-list__name">{asset.name}</span>
                <span className="asset-list__kind">{ASSET_KIND_LABELS[asset.kind]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
