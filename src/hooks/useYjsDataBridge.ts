/**
 * useYjsDataBridge — Y.Doc ↔ Zustand 双向数据桥接（共享逻辑）
 *
 * 被 useYjsSync (WebRTC 模式) 和 useLanSync (LAN 模式) 共同使用。
 * 负责：
 *   1. Zustand myNotebook 变更 → 写入 Y.Doc
 *   2. Y.Doc 好友数据变更 → 更新 Zustand friendNotebook
 *   3. Y.Doc doodleLayers 变更 → 合并回 Zustand myNotebook.pages
 *
 * 不负责：连接建立、provider 生命周期、peer awareness（由各模式 hook 自行处理）
 */

import { useEffect, useRef, type MutableRefObject } from 'react'
import * as Y from 'yjs'
import { useNotebookStore } from '../store/useNotebookStore'
import { readNotebookFromDoc } from '../lib/yjs'
import type { YjsSync } from '../lib/yjs'
import type { Notebook, DoodleLayer } from '../types'

/** 将 HandwritingData 转为 Y.Array<Y.Map> */
function strokesToYArray(strokes: Notebook['pages'][number]['pageHandwriting']): Y.Array<Y.Map<unknown>> {
  const arr = new Y.Array<Y.Map<unknown>>()
  arr.push(strokes.map((s) => {
    const sm = new Y.Map<unknown>()
    sm.set('id', s.id); sm.set('points', s.points)
    sm.set('brush', s.brush); sm.set('color', s.color)
    sm.set('size', s.size); sm.set('timestamp', s.timestamp)
    sm.set('authorId', s.authorId)
    return sm
  }))
  return arr
}

/** 将 Block[] 转为 Y.Array<Y.Map> */
function blocksToYArray(blocks: Notebook['pages'][number]['blocks']): Y.Array<Y.Map<unknown>> {
  const arr = new Y.Array<Y.Map<unknown>>()
  arr.push(blocks.map((b) => {
    const bm = new Y.Map<unknown>()
    bm.set('id', b.id); bm.set('type', b.type)
    bm.set('content', b.content); bm.set('handwriting', b.handwriting)
    bm.set('position', b.position); bm.set('style', b.style)
    bm.set('createdAt', b.createdAt); bm.set('updatedAt', b.updatedAt)
    return bm
  }))
  return arr
}

export function useYjsDataBridge(
  syncRef: MutableRefObject<YjsSync | null>,
  userId: string,
) {
  /* ── 1. Zustand myNotebook → Y.Doc ── */
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
      pm.set('blocks', blocksToYArray(page.blocks))
      pm.set('pageHandwriting', strokesToYArray(page.pageHandwriting))
    })
  }, [myNotebook, userId])

  /* ── 2. Y.Doc friend notebook → Zustand ── */
  const setFriendNotebook = useNotebookStore((s) => s.setFriendNotebook)
  const prevFriendRef = useRef('')

  useEffect(() => {
    const sync = syncRef.current
    if (!sync) return

    const notebooks = sync.doc.getMap('notebooks')

    const handler = () => {
      notebooks.forEach((_nbMap, key) => {
        if (key === userId) return

        const data = readNotebookFromDoc(sync.doc, key)
        if (data) {
          const snapshot = JSON.stringify(data)
          if (snapshot !== prevFriendRef.current) {
            prevFriendRef.current = snapshot

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

          // 自动检测对方在线状态与页码
          const currentPeer = useNotebookStore.getState().peerStatus
          if (!currentPeer ||
            currentPeer.userId !== key ||
            currentPeer.currentPageIndex !== data.currentPageIndex
          ) {
            useNotebookStore.getState().setPeerStatus({
              userId: key,
              isOnline: true,
              currentPageIndex: data.currentPageIndex,
              mode: 'browse',
            })
          }
        }
      })
    }

    notebooks.observeDeep(handler)
    handler()

    return () => {
      notebooks.unobserveDeep(handler)
    }
  }, [userId, setFriendNotebook])

  /* ── 3. Y.Doc doodleLayers → Zustand myNotebook.pages ── */
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
}
