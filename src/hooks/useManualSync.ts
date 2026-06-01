/**
 * useManualSync — 手动信令连接 Hook
 *
 * 管理 ManualSignalingProvider 的生命周期，
 * 暴露创建/接受连接的方法和状态。
 *
 * 使用 docRef 避免 React 闭包中 doc 过时问题：
 * setState 是异步的，click handler 调用时新 doc 可能还未渲染。
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import * as Y from 'yjs'
import {
  ManualSignalingProvider,
  attachDocSync,
  type ConnectionState,
} from '../lib/manual-signaling'

export interface UseManualSyncReturn {
  /** 连接状态 */
  state: ConnectionState
  /** 是否已连接并同步 */
  synced: boolean
  /** 发起方：创建 offer → 返回 SDP 文本供复制 */
  createOffer: () => Promise<string>
  /** 接收方：接受 offer → 返回 answer SDP 文本供复制 */
  acceptOffer: (sdpText: string) => Promise<string>
  /** 发起方：接受 answer → 完成连接 */
  acceptAnswer: (sdpText: string) => Promise<void>
  /** 断开连接 */
  disconnect: () => void
}

export function useManualSync(
  doc: Y.Doc | null,
  roomKey: string,
): UseManualSyncReturn {
  const docRef = useRef<Y.Doc | null>(doc)
  // 始终保持 ref 与最新 doc 同步
  docRef.current = doc

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
    // 通过 ref 读取 doc，避免闭包过时
    const currentDoc = docRef.current
    if (!currentDoc) throw new Error('文档未初始化')

    // 清理旧 provider
    if (detachRef.current) {
      detachRef.current()
      detachRef.current = null
    }

    const provider = new ManualSignalingProvider(currentDoc, roomKey)
    providerRef.current = provider

    // 监听状态变化
    provider.on('state', ([s]: [ConnectionState]) => {
      setState({ ...s })
    })

    provider.on('synced', ([data]: [{ synced: boolean }]) => {
      setSynced(data.synced)
    })

    provider.on('connect', () => {
      setSynced(true)
    })

    provider.on('disconnect', () => {
      setSynced(false)
    })

    // 挂载 doc update 监听（本地更新→发送给对等端）
    detachRef.current = attachDocSync(provider)

    return provider
  }, [roomKey])

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

  /* ── 公开方法 ── */

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
