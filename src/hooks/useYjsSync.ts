/**
 * Yjs 同步 Hook
 *
 * 桥接 Yjs ↔ Zustand 状态同步。双向绑定。
 *
 * 数据流向:
 *   我的操作 → Zustand myNotebook → Yjs (my userId, 不含 doodleLayers)
 *   朋友的涂鸦 → addDoodleToDoc → Yjs (friend userId).doodleLayers
 *   Yjs 变更 → observeDeep → Zustand friendNotebook
 */

import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { useNotebookStore } from '../store/useNotebookStore'
import { useUIStore } from '../store/useUIStore'
import { initYjsSync, readNotebookFromDoc, ensureNotebookInDoc, setGlobalSync } from '../lib/yjs'
import type { YjsSync } from '../lib/yjs'
import type { Notebook, DoodleLayer } from '../types'
import { CONNECTION_TIMEOUT } from '../lib/constants'

/** 跟踪 peer 数量（通过 'peers' 事件更新，避免访问 y-webrtc 内部 API） */

export function useYjsSync(roomCode: string, userId: string) {
  const syncRef = useRef<YjsSync | null>(null)

  /* ── 初始化连接 ── */
  useEffect(() => {
    const sync = initYjsSync(roomCode, userId)
    syncRef.current = sync
    setGlobalSync(sync)
    ensureNotebookInDoc(sync.doc, userId, '我的笔记本')

    // 追踪 WebRTC 对等端连接数量（通过 'peers' 事件数据）
    const peerCountRef = { current: 0 }
    const updatePeers = ({ webrtcPeers }: { webrtcPeers?: unknown[] }) => {
      const count = Array.isArray(webrtcPeers) ? webrtcPeers.length : 0
      peerCountRef.current = count
      useUIStore.getState().setConnectedPeers(count)
    }

    sync.provider.on('peers', updatePeers)

    // 超时检测：30 秒后若还没有对等端
    const timeout = setTimeout(() => {
      if (peerCountRef.current === 0) {
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

  /* ── 自己的笔记本变化 → Yjs（不含 doodleLayers） ── */
  const myNotebook = useNotebookStore((s) => s.myNotebook)
  const prevMyNotebookRef = useRef<string>('')

  useEffect(() => {
    const sync = syncRef.current
    if (!sync) return

    const json = JSON.stringify(myNotebook)
    if (json === prevMyNotebookRef.current) return
    prevMyNotebookRef.current = json

    const notebooks = sync.doc.getMap('notebooks')
    // 增量更新：获取已有 entry 或创建新的（不替换，保留 doodleLayers）
    let nbMap = notebooks.get(userId) as Y.Map<unknown> | undefined
    if (!nbMap) {
      nbMap = new Y.Map<unknown>()
      notebooks.set(userId, nbMap)
    }

    nbMap.set('name', myNotebook.name)
    nbMap.set('currentPageIndex', myNotebook.currentPageIndex)

    // 只更新 blocks/pageHandwriting，doodleLayers 由对方写入保持不变
    let pages = nbMap.get('pages') as Y.Array<Y.Map<unknown>> | undefined
    if (!pages) {
      pages = new Y.Array<Y.Map<unknown>>()
      nbMap.set('pages', pages)
    }

    // 同步每页的 blocks 和 pageHandwriting
    myNotebook.pages.forEach((page, idx) => {
      // 确保 pages 数组有足够长度
      while (pages!.length <= idx) {
        const newPageMap = new Y.Map<unknown>()
        // 新页面需要初始化 doodleLayers，否则 addDoodleToDoc 会找不到
        newPageMap.set('doodleLayers', new Y.Array<Y.Map<unknown>>())
        pages!.push([newPageMap])
      }
      const pm = pages!.get(idx)
      pm.set('id', page.id)
      pm.set('pageNumber', page.pageNumber)
      pm.set('showDoodles', page.showDoodles)
      pm.set('createdAt', page.createdAt)
      pm.set('updatedAt', Date.now())
      pm.set('thumbnail', page.thumbnail)

      // blocks
      const blocks = new Y.Array<Y.Map<unknown>>()
      blocks.push(page.blocks.map((b) => {
        const bm = new Y.Map<unknown>()
        bm.set('id', b.id); bm.set('type', b.type)
        bm.set('content', b.content); bm.set('handwriting', b.handwriting)
        bm.set('position', b.position); bm.set('style', b.style)
        bm.set('createdAt', b.createdAt); bm.set('updatedAt', b.updatedAt)
        return bm
      }))
      pm.set('blocks', blocks)

      // pageHandwriting
      const phw = new Y.Array<Y.Map<unknown>>()
      phw.push(page.pageHandwriting.map((s) => {
        const sm = new Y.Map<unknown>()
        sm.set('id', s.id); sm.set('points', s.points)
        sm.set('brush', s.brush); sm.set('color', s.color)
        sm.set('size', s.size); sm.set('timestamp', s.timestamp)
        sm.set('authorId', s.authorId)
        return sm
      }))
      pm.set('pageHandwriting', phw)

      // 注意：不设置 doodleLayers — 保持 Yjs 中已有的值
    })
  }, [myNotebook, userId])

  /* ── 对方笔记本变化 ← Yjs ── */
  const setFriendNotebook = useNotebookStore((s) => s.setFriendNotebook)
  const setPeerStatus = useNotebookStore((s) => s.setPeerStatus)

  useEffect(() => {
    const sync = syncRef.current
    if (!sync) return

    const notebooks = sync.doc.getMap('notebooks')

    const handler = () => {
      notebooks.forEach((_nbMap, key) => {
        if (key === userId) return

        const data = readNotebookFromDoc(sync.doc, key)
        if (data) {
          const friendNb: Notebook = {
            id: `nb-${key}`,
            name: data.name,
            ownerId: key,
            pages: data.pages.map((p) => ({
              id: p.id,
              pageNumber: p.pageNumber,
              blocks: p.blocks,
              doodleLayers: p.doodleLayers,
              pageHandwriting: p.pageHandwriting || [],
              thumbnail: p.thumbnail,
              showDoodles: p.showDoodles,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            })),
            currentPageIndex: data.currentPageIndex,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          setFriendNotebook(friendNb)
        }
      })
    }

    notebooks.observeDeep(handler)
    handler()

    return () => {
      notebooks.unobserveDeep(handler)
    }
  }, [userId, setFriendNotebook])

  /* ── 朋友在我页面上的涂鸦 ← Yjs（读回我自己 notebook 的 doodleLayers） ── */
  useEffect(() => {
    const sync = syncRef.current
    if (!sync) return

    const notebooks = sync.doc.getMap('notebooks')

    const handler = () => {
      const nbMap = notebooks.get(userId) as Y.Map<unknown> | undefined
      if (!nbMap) return

      const pages = nbMap.get('pages') as Y.Array<Y.Map<unknown>> | undefined
      if (!pages) return

      const state = useNotebookStore.getState()
      const myPages = state.myNotebook.pages

      // 只同步 doodleLayers（朋友画的涂鸦）
      let changed = false
      const newPages = myPages.map((page, idx) => {
        if (idx >= pages.length) return page
        const yPage = pages.get(idx)
        const yDoodles = yPage.get('doodleLayers') as Y.Array<Y.Map<unknown>> | undefined
        if (!yDoodles) return page

        const doodleLayers: DoodleLayer[] = yDoodles.toArray().map((dm) => ({
          id: (dm.get('id') as string) || '',
          pageId: (dm.get('pageId') as string) || '',
          blockId: (dm.get('blockId') as string) || null,
          authorId: (dm.get('authorId') as string) || '',
          strokes: (dm.get('strokes') as DoodleLayer['strokes']) || [],
          createdAt: (dm.get('createdAt') as number) || Date.now(),
          updatedAt: (dm.get('updatedAt') as number) || Date.now(),
        }))

        // 简单对比：数量变化即更新
        if (doodleLayers.length !== page.doodleLayers.length) {
          changed = true
          return { ...page, doodleLayers }
        }
        return page
      })

      if (changed) {
        useNotebookStore.setState({
          myNotebook: { ...state.myNotebook, pages: newPages }
        })
      }
    }

    notebooks.observeDeep(handler)

    return () => {
      notebooks.unobserveDeep(handler)
    }
  }, [userId])

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
