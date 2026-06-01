/**
 * useLanSync — 局域网模式 Y.Doc ↔ Zustand 同步 Hook
 *
 * 从 useManualSync 接管 ManualSignalingProvider（WebRTC DataChannel），
 * 数据同步委托给 useYjsDataBridge 共享逻辑。
 */

import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { useNotebookStore } from '../store/useNotebookStore'
import { ensureNotebookInDoc, setGlobalSync } from '../lib/yjs'
import type { YjsSync } from '../lib/yjs'
import { getLanProvider, clearLanProvider } from './useManualSync'
import { attachDocSync } from '../lib/manual-signaling'
import { useYjsDataBridge } from './useYjsDataBridge'

function createLocalSync(doc: Y.Doc): YjsSync {
  return {
    doc,
    provider: {
      awareness: {
        setLocalState: () => {},
        getStates: () => new Map(),
        on: () => {},
        off: () => {},
        clientID: 0,
        setLocalStateField: () => {},
      },
      on: () => {},
      off: () => {},
      disconnect: () => {},
    } as unknown as YjsSync['provider'],
    destroy: () => {},
  }
}

export function useLanSync(doc: Y.Doc, userId: string) {
  const syncRef = useRef<YjsSync | null>(null)
  const detachRef = useRef<(() => void) | null>(null)

  /* ── 初始化 ── */
  useEffect(() => {
    const lanProv = getLanProvider()
    let sync: YjsSync

    if (lanProv && lanProv.doc === doc) {
      const detach = attachDocSync(lanProv)
      detachRef.current = detach

      sync = {
        doc,
        provider: {
          awareness: {
            setLocalState: () => {},
            getStates: () => new Map(),
            on: () => {},
            off: () => {},
            clientID: 0,
            setLocalStateField: () => {},
          },
          on: () => {},
          off: () => {},
          disconnect: () => lanProv.destroy(),
        } as unknown as YjsSync['provider'],
        destroy: () => {
          detach()
          lanProv.destroy()
          clearLanProvider()
        },
      }
    } else {
      sync = createLocalSync(doc)
    }

    syncRef.current = sync
    setGlobalSync(sync)
    ensureNotebookInDoc(sync.doc, userId, '我的笔记本')

    return () => {
      setGlobalSync(null)
      syncRef.current = null
    }
  }, [doc, userId])

  /* ── 数据桥接（共享逻辑） ── */
  useYjsDataBridge(syncRef, userId)

  /* ── 定期更新当前页码 ── */
  useEffect(() => {
    const interval = setInterval(() => {
      const sync = syncRef.current
      if (!sync) return
      const notebooks = sync.doc.getMap('notebooks')
      const nbMap = notebooks.get(userId) as Y.Map<unknown> | undefined
      if (nbMap) {
        nbMap.set('currentPageIndex', useNotebookStore.getState().myNotebook.currentPageIndex)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [userId])

  return syncRef
}
