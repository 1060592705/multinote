/**
 * useYjsSync — 在线 WebRTC 模式同步 Hook
 *
 * 使用 y-webrtc 信令服务器建立 P2P 连接，
 * 数据同步委托给 useYjsDataBridge 共享逻辑。
 */

import { useEffect, useRef } from 'react'
import { useNotebookStore } from '../store/useNotebookStore'
import { useUIStore } from '../store/useUIStore'
import { initYjsSync, ensureNotebookInDoc, setGlobalSync } from '../lib/yjs'
import type { YjsSync } from '../lib/yjs'
import { CONNECTION_TIMEOUT } from '../lib/constants'
import { useYjsDataBridge } from './useYjsDataBridge'

function getPeerCount(sync: YjsSync): number {
  const peers = (sync.provider as unknown as { peers?: Map<string, unknown> }).peers
  return peers ? peers.size : 0
}

export function useYjsSync(roomCode: string, userId: string) {
  const syncRef = useRef<YjsSync | null>(null)
  const setPeerStatus = useNotebookStore((s) => s.setPeerStatus)

  /* ── 初始化连接 ── */
  useEffect(() => {
    const sync = initYjsSync(roomCode, userId)
    syncRef.current = sync
    setGlobalSync(sync)
    ensureNotebookInDoc(sync.doc, userId, '我的笔记本')

    const updatePeers = () => {
      useUIStore.getState().setConnectedPeers(getPeerCount(sync))
    }
    sync.provider.on('peers', updatePeers)
    updatePeers()

    const timeout = setTimeout(() => {
      if (getPeerCount(sync) === 0) {
        useUIStore.getState().setPeerConnecting(false)
      }
    }, CONNECTION_TIMEOUT)

    return () => {
      setGlobalSync(null)
      sync.provider.off('peers', updatePeers)
      clearTimeout(timeout)
      sync.destroy()
      syncRef.current = null
    }
  }, [roomCode, userId])

  /* ── 数据桥接（共享逻辑） ── */
  useYjsDataBridge(syncRef, userId)

  /* ── Peer awareness ── */
  useEffect(() => {
    const sync = syncRef.current
    if (!sync) return

    const updatePeer = () => {
      const states = sync.provider.awareness.getStates()
      states.forEach((state, clientId) => {
        if (sync.provider.awareness.clientID === clientId) return
        const s = state as Record<string, unknown> | undefined
        if (s && s.userId && s.userId !== userId) {
          setPeerStatus({
            userId: s.userId as string,
            isOnline: (s.online as boolean) ?? true,
            currentPageIndex: (s.currentPageIndex as number) || 0,
            mode: 'browse',
          })
        }
      })
    }

    sync.provider.awareness.on('change', updatePeer)
    updatePeer()

    const interval = setInterval(() => {
      sync.provider.awareness.setLocalStateField('currentPageIndex',
        useNotebookStore.getState().myNotebook.currentPageIndex
      )
    }, 3000)

    return () => {
      sync.provider.awareness.off('change', updatePeer)
      clearInterval(interval)
    }
  }, [userId, setPeerStatus])

  return syncRef
}
