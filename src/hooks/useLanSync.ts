/**
 * useLanSync — 局域网模式下的 Y.Doc ↔ Zustand 同步 Hook
 *
 * 与 useYjsSync 的区别：
 *   - 不创建 WebrtcProvider（数据通道由 ManualSignalingProvider 管理）
 *   - 仅负责 Y.Doc 与 Zustand stores 之间的双向桥接
 *   - 对方状态始终为"在线"（局域网直连，连接即在线）
 */

import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { useNotebookStore } from '../store/useNotebookStore'
import {
  readNotebookFromDoc,
  ensureNotebookInDoc,
  setGlobalSync,
} from '../lib/yjs'
import type { YjsSync } from '../lib/yjs'
import type { Notebook, DoodleLayer } from '../types'

/* ── 轻量 YjsSync（无 WebRTC） ── */
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

  /* ── 初始化 ── */
  useEffect(() => {
    const sync = createLocalSync(doc)
    syncRef.current = sync
    setGlobalSync(sync)
    ensureNotebookInDoc(sync.doc, userId, '我的笔记本')

    // 自动发现已连接的对方：扫描 Y.Doc 中不为当前 userId 的 notebook
    const notebooks = sync.doc.getMap('notebooks')
    notebooks.forEach((_nbMap, key) => {
      if (key !== userId) {
        useNotebookStore.getState().setPeerStatus({
          userId: key,
          isOnline: true,
          currentPageIndex: 0,
          mode: 'browse',
        })
      }
    })

    return () => {
      setGlobalSync(null)
      syncRef.current = null
    }
  }, [doc, userId])

  /* ── 我的笔记本 → Y.Doc ── */
  const myNotebook = useNotebookStore((s) => s.myNotebook)
  const prevMyNotebookRef = useRef<string>('')

  useEffect(() => {
    const sync = syncRef.current
    if (!sync) return

    const json = JSON.stringify(myNotebook)
    if (json === prevMyNotebookRef.current) return
    prevMyNotebookRef.current = json

    const notebooks = sync.doc.getMap('notebooks')
    let nbMap = notebooks.get(userId) as Y.Map<unknown> | undefined
    if (!nbMap) {
      nbMap = new Y.Map<unknown>()
      notebooks.set(userId, nbMap)
    }

    nbMap.set('name', myNotebook.name)
    nbMap.set('currentPageIndex', myNotebook.currentPageIndex)

    let pages = nbMap.get('pages') as Y.Array<Y.Map<unknown>> | undefined
    if (!pages) {
      pages = new Y.Array<Y.Map<unknown>>()
      nbMap.set('pages', pages)
    }

    myNotebook.pages.forEach((page, idx) => {
      while (pages!.length <= idx) {
        const newPageMap = new Y.Map<unknown>()
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
    })
  }, [myNotebook, userId])

  /* ── 对方笔记本 ← Y.Doc ── */
  const setFriendNotebook = useNotebookStore((s) => s.setFriendNotebook)

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

  /* ── 朋友涂鸦 ← Y.Doc ── */
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
