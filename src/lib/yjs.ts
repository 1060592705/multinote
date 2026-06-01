/**
 * Yjs 实时同步模块
 *
 * 使用 y-webrtc 建立 P2P WebRTC 连接。
 * 同网络下无需 STUN，信令服务器交换局域网 IP 后直连。
 *
 * 策略：单一共享 Y.Doc，每个用户在 notebooks[userId] 下维护自己的笔记本数据。
 */

import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import type { Block, DoodleLayer, HandwritingData, Stroke } from '../types'
import type { BlockContent } from '../types'
import { SIGNALING_SERVERS, ICE_SERVERS } from './constants'

/* ═══════════════════════════════════════════
   Yjs → JSON 读取
   ═══════════════════════════════════════════ */

/** 从 Y.Doc 中提取指定用户的笔记本序列化数据 */
export function readNotebookFromDoc(doc: Y.Doc, userId: string): NotebookData | null {
  const notebooks = doc.getMap('notebooks')
  const nbMap = notebooks.get(userId) as Y.Map<unknown> | undefined
  if (!nbMap) return null

  return {
    name: (nbMap.get('name') as string) || '笔记本',
    currentPageIndex: (nbMap.get('currentPageIndex') as number) || 0,
    pages: readPages(nbMap),
  }
}

function readPages(nbMap: Y.Map<unknown>): PageData[] {
  const yPages = nbMap.get('pages') as Y.Array<Y.Map<unknown>> | undefined
  if (!yPages || yPages.length === 0) {
    return [createDefaultPage(1)]
  }
  return yPages.toArray().map((pm) => {
    const blocks = pm.get('blocks') as Y.Array<Y.Map<unknown>> | undefined
    const doodleLayers = pm.get('doodleLayers') as Y.Array<Y.Map<unknown>> | undefined
    return {
      id: (pm.get('id') as string) || '',
      pageNumber: (pm.get('pageNumber') as number) || 1,
      blocks: blocks ? blocks.toArray().map(readBlock) : [],
      doodleLayers: doodleLayers ? doodleLayers.toArray().map(readDoodle) : [],
      pageHandwriting: readStrokes(pm, 'pageHandwriting'),
      thumbnail: (pm.get('thumbnail') as string) || null,
      showDoodles: (pm.get('showDoodles') as boolean) ?? true,
      createdAt: (pm.get('createdAt') as number) || Date.now(),
      updatedAt: (pm.get('updatedAt') as number) || Date.now(),
    }
  })
}

function readStrokes(pm: Y.Map<unknown>, key: string): HandwritingData {
  const arr = pm.get(key) as Y.Array<Y.Map<unknown>> | undefined
  if (!arr || arr.length === 0) return []
  return arr.toArray().map((sm) => ({
    id: (sm.get('id') as string) || '',
    points: (sm.get('points') as Stroke['points']) || [],
    brush: (sm.get('brush') as Stroke['brush']) || 'pen',
    color: (sm.get('color') as string) || '#1A1A1A',
    size: (sm.get('size') as number) || 3,
    timestamp: (sm.get('timestamp') as number) || Date.now(),
    authorId: (sm.get('authorId') as string) || '',
  }))
}

function readBlock(bm: Y.Map<unknown>): Block {
  return {
    id: (bm.get('id') as string) || '',
    type: (bm.get('type') as Block['type']) || 'paragraph',
    content: (bm.get('content') as BlockContent) || { type: 'paragraph', text: '' },
    handwriting: (bm.get('handwriting') as HandwritingData) || null,
    position: (bm.get('position') as number) || 0,
    style: (bm.get('style') as Block['style']) || {},
    createdAt: (bm.get('createdAt') as number) || Date.now(),
    updatedAt: (bm.get('updatedAt') as number) || Date.now(),
  }
}

function readDoodle(dm: Y.Map<unknown>): DoodleLayer {
  return {
    id: (dm.get('id') as string) || '',
    pageId: (dm.get('pageId') as string) || '',
    blockId: (dm.get('blockId') as string) || null,
    authorId: (dm.get('authorId') as string) || '',
    strokes: (dm.get('strokes') as DoodleLayer['strokes']) || [],
    createdAt: (dm.get('createdAt') as number) || Date.now(),
    updatedAt: (dm.get('updatedAt') as number) || Date.now(),
  }
}

/* ═══════════════════════════════════════════
   写入 Yjs
   ═══════════════════════════════════════════ */

/** 初始化用户在 Y.Doc 中的笔记本（如果还不存在） */
export function ensureNotebookInDoc(doc: Y.Doc, userId: string, name: string): void {
  const notebooks = doc.getMap('notebooks')
  if (notebooks.has(userId)) return

  const nbMap = new Y.Map<unknown>()
  nbMap.set('name', name)
  nbMap.set('currentPageIndex', 0)

  const pages = new Y.Array<Y.Map<unknown>>()
  pages.push([pageToYMap(createDefaultPage(1))])
  nbMap.set('pages', pages)

  notebooks.set(userId, nbMap)
}

/** 添加涂鸦到朋友的页面上 */
export function addDoodleToDoc(doc: Y.Doc, targetUserId: string, pageIndex: number, doodle: DoodleLayer): void {
  const pageMap = getPageMap(doc, targetUserId, pageIndex)
  if (!pageMap) return

  let doodles = pageMap.get('doodleLayers') as Y.Array<Y.Map<unknown>> | undefined
  if (!doodles) {
    doodles = new Y.Array<Y.Map<unknown>>()
    pageMap.set('doodleLayers', doodles)
  }

  doodles.push([doodleToYMap(doodle)])
  pageMap.set('updatedAt', Date.now())
}

/* ═══════════════════════════════════════════
   辅助
   ═══════════════════════════════════════════ */

function getPageMap(doc: Y.Doc, userId: string, pageIndex: number): Y.Map<unknown> | null {
  const notebooks = doc.getMap('notebooks')
  const nbMap = notebooks.get(userId) as Y.Map<unknown> | undefined
  if (!nbMap) return null

  const pages = nbMap.get('pages') as Y.Array<Y.Map<unknown>> | undefined
  if (!pages || pageIndex >= pages.length) return null

  return pages.get(pageIndex)
}

function blockToYMap(block: Block): Y.Map<unknown> {
  const bm = new Y.Map<unknown>()
  bm.set('id', block.id)
  bm.set('type', block.type)
  bm.set('content', block.content)
  bm.set('handwriting', block.handwriting)
  bm.set('position', block.position)
  bm.set('style', block.style)
  bm.set('createdAt', block.createdAt)
  bm.set('updatedAt', block.updatedAt)
  return bm
}

function doodleToYMap(doodle: DoodleLayer): Y.Map<unknown> {
  const dm = new Y.Map<unknown>()
  dm.set('id', doodle.id)
  dm.set('pageId', doodle.pageId)
  dm.set('blockId', doodle.blockId)
  dm.set('authorId', doodle.authorId)
  dm.set('strokes', doodle.strokes)
  dm.set('createdAt', doodle.createdAt)
  dm.set('updatedAt', doodle.updatedAt)
  return dm
}

function pageToYMap(page: PageData): Y.Map<unknown> {
  const pm = new Y.Map<unknown>()
  pm.set('id', page.id)
  pm.set('pageNumber', page.pageNumber)

  const blocks = new Y.Array<Y.Map<unknown>>()
  blocks.push(page.blocks.map(blockToYMap))
  pm.set('blocks', blocks)

  const doodles = new Y.Array<Y.Map<unknown>>()
  doodles.push(page.doodleLayers.map(doodleToYMap))
  pm.set('doodleLayers', doodles)

  pm.set('thumbnail', page.thumbnail)
  pm.set('showDoodles', page.showDoodles)
  pm.set('createdAt', page.createdAt)
  pm.set('updatedAt', page.updatedAt)
  return pm
}

function createDefaultPage(pageNumber: number): PageData {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pageNumber,
    blocks: [],
    doodleLayers: [],
    pageHandwriting: [],
    thumbnail: null,
    showDoodles: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/* ═══════════════════════════════════════════
   WebRTC 连接
   ═══════════════════════════════════════════ */

export interface YjsSync {
  doc: Y.Doc
  provider: WebrtcProvider
  destroy: () => void
}

/** 全局 YjsSync 引用，供 store 层写入 Yjs */
let _globalSync: YjsSync | null = null

export function setGlobalSync(sync: YjsSync | null): void {
  _globalSync = sync
}

export function getGlobalSync(): YjsSync | null {
  return _globalSync
}

/** 初始化 Yjs + WebRTC 连接 */
export function initYjsSync(roomCode: string, userId: string): YjsSync {
  const doc = new Y.Doc()
  const room = `multinote-${roomCode}`

  const provider = new WebrtcProvider(room, doc, {
    signaling: SIGNALING_SERVERS,
    password: `mn-${roomCode}`,
    peerOpts: {
      iceServers: ICE_SERVERS,
    },
  })

  provider.awareness.setLocalState({
    userId,
    currentPageIndex: 0,
    online: true,
  })

  const destroy = () => {
    provider.awareness.setLocalState(null)
    provider.disconnect()
    doc.destroy()
  }

  return { doc, provider, destroy }
}

/* ═══════════════════════════════════════════
   序列化类型（轻量版，不含 Yjs 类型）
   ═══════════════════════════════════════════ */

export interface NotebookData {
  name: string
  currentPageIndex: number
  pages: PageData[]
}

export interface PageData {
  id: string
  pageNumber: number
  blocks: Block[]
  doodleLayers: DoodleLayer[]
  pageHandwriting: HandwritingData
  thumbnail: string | null
  showDoodles: boolean
  createdAt: number
  updatedAt: number
}
