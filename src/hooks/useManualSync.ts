/**
 * useManualSync — 手动信令连接 Hook
 *
 * 管理 ManualSignalingProvider 的生命周期，
 * 暴露创建/接受连接的方法和状态。
 *
 * 使用 MutableRefObject<Y.Doc | null> 而非 Y.Doc | null：
 * 避免 React 闭包中 doc 过时 —— 调用方可以直接写 ref.current，
 * 不依赖 React 重渲染，确保 provider 创建时一定能读到 doc。
 */

import { useRef, useState, useCallback, useEffect, type MutableRefObject } from 'react'
import * as Y from 'yjs'
import {
  ManualSignalingProvider,
  attachDocSync,
  type ConnectionState,
} from '../net/signaling'

export interface UseManualSyncReturn {
  state: ConnectionState
  synced: boolean
  createOffer: () => Promise<string>
  acceptOffer: (sdpText: string) => Promise<string>
  acceptAnswer: (sdpText: string) => Promise<void>
  disconnect: () => void
}

export function useManualSync(
  docRef: MutableRefObject<Y.Doc | null>,
  roomKey: string,
): UseManualSyncReturn {
  const providerRef = useRef<ManualSignalingProvider | null>(null)
  const detachRef = useRef<(() => void) | null>(null)
  const [state, setState] = useState<ConnectionState>({
    status: 'idle',
    role: null,
    localSdp: null,
    error: null,
  })
  const [synced, setSynced] = useState(false)

  /* ── 创建/重建 Provider ── */
  const ensureProvider = useCallback(() => {
    if (providerRef.current && !providerRef.current['_disposed']) {
      return providerRef.current
    }
    // 直接从 ref 读 doc —— 调用方可以同步设置 ref.current，不依赖 React 重渲染
    const currentDoc = docRef.current
    if (!currentDoc) throw new Error('文档未初始化')

    if (detachRef.current) {
      detachRef.current()
      detachRef.current = null
    }

    const provider = new ManualSignalingProvider(currentDoc, roomKey)
    providerRef.current = provider

    // emit('state', [obj]) 经过 lib0/observable 展开为 f(obj)，obj 是普通对象非数组
    provider.on('state', (s: ConnectionState) => {
      setState({ ...s })
    })

    provider.on('synced', (data: { synced: boolean }) => {
      setSynced(data.synced)
    })

    provider.on('connect', () => {
      setSynced(true)
    })

    provider.on('disconnect', () => {
      setSynced(false)
    })

    detachRef.current = attachDocSync(provider)

    return provider
  }, [docRef, roomKey])

  /* ── 清理 ── */
  useEffect(() => {
    return () => {
      if (detachRef.current) {
        detachRef.current()
        detachRef.current = null
      }
      if (providerRef.current) {
        providerRef.current.destroy()
        providerRef.current = null
      }
    }
  }, [])

  const createOffer = useCallback(async (): Promise<string> => {
    const provider = ensureProvider()
    return provider.createOffer()
  }, [ensureProvider])

  const acceptOffer = useCallback(async (sdpText: string): Promise<string> => {
    const provider = ensureProvider()
    return provider.acceptOffer(sdpText)
  }, [ensureProvider])

  const acceptAnswer = useCallback(async (sdpText: string): Promise<void> => {
    const provider = ensureProvider()
    return provider.acceptAnswer(sdpText)
  }, [ensureProvider])

  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy()
      providerRef.current = null
    }
    if (detachRef.current) {
      detachRef.current()
      detachRef.current = null
    }
  }, [])

  return {
    state,
    synced,
    createOffer,
    acceptOffer,
    acceptAnswer,
    disconnect,
  }
}
