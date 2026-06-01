/**
 * useManualSync — 手动信令连接 Hook
 *
 * 管理 ManualSignalingProvider 的生命周期，
 * 暴露创建/接受连接的方法和状态。
 *
 * 使用 MutableRefObject<Y.Doc | null> 而非 Y.Doc | null：
 * 避免 React 闭包中 doc 过时 —— 调用方可以直接写 ref.current，
 * 不依赖 React 重渲染，确保 provider 创建时一定能读到 doc。
 *
 * ⚠️ 生命周期：连接建立后（synced=true），provider 不会随组件卸载而销毁，
 *    而是转移到模块级变量 _lanProvider，供 useLanSync 接管。
 */

import { useRef, useState, useCallback, useEffect, type MutableRefObject } from 'react'
import * as Y from 'yjs'
import {
  ManualSignalingProvider,
  attachDocSync,
  type ConnectionState,
  type IceStats,
} from '../lib/manual-signaling'

/* ── 模块级：LAN 连接建立后，provider 存活供 useLanSync 接管 ── */
let _lanProvider: ManualSignalingProvider | null = null

/** 获取当前存活的 LAN provider（供 useLanSync 使用） */
export function getLanProvider(): ManualSignalingProvider | null {
  if (_lanProvider && !(_lanProvider as any)['_disposed']) {
    return _lanProvider
  }
  return null
}

/** 清除模块级 LAN provider 引用（useLanSync destroy 时调用） */
export function clearLanProvider(): void {
  _lanProvider = null
}

export interface UseManualSyncReturn {
  state: ConnectionState
  synced: boolean
  lastIceStats: IceStats | null
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
    iceStats: null,
  })
  const [synced, setSynced] = useState(false)
  const syncedRef = useRef(false)
  const [lastIceStats, setLastIceStats] = useState<IceStats | null>(null)

  /* ── 同步 synced → ref（cleanup 闭包安全读取） ── */
  useEffect(() => {
    syncedRef.current = synced
  }, [synced])

  /* ── 创建/重建 Provider ── */
  const ensureProvider = useCallback(() => {
    if (providerRef.current && !(providerRef.current as any)['_disposed']) {
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

    provider.on('connection-failed', (stats?: IceStats) => {
      setSynced(false)
      if (stats) setLastIceStats(stats)
    })

    detachRef.current = attachDocSync(provider)

    return provider
  }, [docRef, roomKey])

  /* ── 清理 ──
     关键：如果连接已建立（synced），不销毁 provider，
     转移到模块级变量 _lanProvider 让 useLanSync 接管。
     旧 doc→DC 桥接先 detach，useLanSync 会重新 attachDocSync。
     否则 WebRTC DataChannel 随组件卸载而关闭，导致两个标签页各自独立。 */
  useEffect(() => {
    return () => {
      if (syncedRef.current && providerRef.current) {
        // 连接已建立 → detach 旧 handler，provider 存活转移给 useLanSync
        if (detachRef.current) {
          detachRef.current()
          detachRef.current = null
        }
        _lanProvider = providerRef.current
      } else {
        // 未连接 → 正常清理
        if (detachRef.current) {
          detachRef.current()
          detachRef.current = null
        }
        if (providerRef.current) {
          providerRef.current.destroy()
          providerRef.current = null
        }
        // 同时清理模块级（如果有）
        _lanProvider = null
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
    lastIceStats,
    createOffer,
    acceptOffer,
    acceptAnswer,
    disconnect,
  }
}
