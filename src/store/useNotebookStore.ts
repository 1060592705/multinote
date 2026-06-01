/**
 * 笔记本状态管理（Zustand）
 *
 * 管理两个笔记本（我的 + 朋友的）的完整状态，
 * 包括页面、块、涂鸦层、撤销/重做历史。
 */

import { create } from 'zustand'
import type { Notebook, Page, Block, DoodleLayer, HandwritingData, PeerStatus } from '../types'
import { generateUserId } from '../lib/room'
import { getGlobalSync, addDoodleToDoc } from '../lib/yjs'

/* ── 常量 ── */

const MAX_HISTORY = 50

/* ── Store 类型 ── */

interface NotebookState {
  /* 数据 */
  myNotebook: Notebook
  friendNotebook: Notebook | null
  userId: string

  /* 对方状态 */
  peerStatus: PeerStatus | null

  /* 全局涂鸦开关 */
  showFriendDoodles: boolean

  /* 撤销/重做 */
  _history: string[]
  _future: string[]
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  /* === 我的笔记本操作 === */

  setMyNotebook: (nb: Notebook) => void
  goToMyPage: (pageIndex: number) => void
  addMyPage: () => string
  removeMyPage: (pageIndex: number) => void
  addBlock: (pageIndex: number, block: Block) => void
  updateBlock: (pageIndex: number, blockId: string, updater: (block: Block) => Block) => void
  removeBlock: (pageIndex: number, blockId: string) => void
  addStroke: (pageIndex: number, blockId: string, stroke: HandwritingData[number]) => void
  removeStroke: (pageIndex: number, blockId: string, strokeId: string) => void
  updateMyThumbnail: (pageIndex: number, thumbnail: string) => void
  addPageStroke: (pageIndex: number, stroke: HandwritingData[number]) => void
  removePageStroke: (pageIndex: number, strokeId: string) => void

  /* === 朋友的笔记本操作 === */

  setFriendNotebook: (nb: Notebook) => void
  viewFriendPage: (pageIndex: number) => void
  addDoodle: (friendPageIndex: number, doodle: DoodleLayer) => void
  removeDoodle: (friendPageIndex: number, doodleId: string) => void

  /* === 涂鸦控制 === */

  toggleFriendDoodles: () => void
  togglePageDoodles: (pageIndex: number) => void

  /* === 协作 === */
  setPeerStatus: (status: PeerStatus | null) => void
}

/* ── 辅助函数 ── */

function createEmptyPage(pageNumber: number): Page {
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

function createEmptyNotebook(ownerId: string, name: string): Notebook {
  const firstPage = createEmptyPage(1)
  return {
    id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    ownerId,
    pages: [firstPage],
    currentPageIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/** 不可变更新指定页：浅克隆 pages 数组，对目标页应用 fn */
function updatePage(pages: Page[], pageIndex: number, fn: (page: Page) => Page): Page[] {
  const updated = [...pages]
  updated[pageIndex] = fn({ ...updated[pageIndex] })
  return updated
}

/** 生成历史快照并清空 future 栈 */
function pushHistory(s: NotebookState) {
  const snapshot = JSON.stringify(s.myNotebook)
  return {
    _history: [...s._history, snapshot].slice(-MAX_HISTORY),
    _future: [] as string[],
  }
}

/* ── Store ── */

export const useNotebookStore = create<NotebookState>((set, get) => {
  const userId = generateUserId()
  const myNotebook = createEmptyNotebook(userId, '我的笔记本')

  return {
    myNotebook,
    friendNotebook: null,
    userId,
    peerStatus: null,
    showFriendDoodles: true,

    /* === 撤销/重做 === */

    _history: [],
    _future: [],

    undo: () =>
      set((s) => {
        if (s._history.length === 0) return s
        const currentSnapshot = JSON.stringify(s.myNotebook)
        const prevSnapshot = s._history[s._history.length - 1]
        const restored = JSON.parse(prevSnapshot) as Notebook
        return {
          _history: s._history.slice(0, -1),
          _future: [...s._future, currentSnapshot].slice(-MAX_HISTORY),
          myNotebook: restored,
        }
      }),

    redo: () =>
      set((s) => {
        if (s._future.length === 0) return s
        const currentSnapshot = JSON.stringify(s.myNotebook)
        const nextSnapshot = s._future[s._future.length - 1]
        const restored = JSON.parse(nextSnapshot) as Notebook
        return {
          _future: s._future.slice(0, -1),
          _history: [...s._history, currentSnapshot].slice(-MAX_HISTORY),
          myNotebook: restored,
        }
      }),

    canUndo: () => get()._history.length > 0,
    canRedo: () => get()._future.length > 0,

    /* === 我的 === */

    setMyNotebook: (nb) => set({ myNotebook: nb }),

    goToMyPage: (pageIndex) =>
      set((s) => ({
        myNotebook: {
          ...s.myNotebook,
          currentPageIndex: Math.max(0, Math.min(pageIndex, s.myNotebook.pages.length - 1)),
        },
      })),

    addMyPage: () => {
      const state = get()
      const newPage = createEmptyPage(state.myNotebook.pages.length + 1)
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: [...s.myNotebook.pages, newPage],
          updatedAt: Date.now(),
        },
      }))
      return newPage.id
    },

    removeMyPage: (pageIndex) => {
      const state = get()
      if (state.myNotebook.pages.length <= 1) return // 至少保留一页
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: s.myNotebook.pages.filter((_, i) => i !== pageIndex),
          currentPageIndex: Math.min(s.myNotebook.currentPageIndex, s.myNotebook.pages.length - 2),
          updatedAt: Date.now(),
        },
      }))
    },

    addBlock: (pageIndex, block) =>
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            blocks: [...page.blocks, { ...block, position: page.blocks.length }],
            updatedAt: Date.now(),
          })),
          updatedAt: Date.now(),
        },
      })),

    updateBlock: (pageIndex, blockId, updater) =>
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            blocks: page.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
            updatedAt: Date.now(),
          })),
          updatedAt: Date.now(),
        },
      })),

    removeBlock: (pageIndex, blockId) =>
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            blocks: page.blocks
              .filter((b) => b.id !== blockId)
              .map((b, i) => ({ ...b, position: i })),
            updatedAt: Date.now(),
          })),
          updatedAt: Date.now(),
        },
      })),

    addStroke: (pageIndex, blockId, stroke) =>
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            blocks: page.blocks.map((b) =>
              b.id === blockId
                ? { ...b, handwriting: [...(b.handwriting || []), stroke] as HandwritingData, updatedAt: Date.now() }
                : b,
            ),
            updatedAt: Date.now(),
          })),
          updatedAt: Date.now(),
        },
      })),

    removeStroke: (pageIndex, blockId, strokeId) =>
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            blocks: page.blocks.map((b) =>
              b.id === blockId && b.handwriting
                ? { ...b, handwriting: b.handwriting.filter((st) => st.id !== strokeId), updatedAt: Date.now() }
                : b,
            ),
            updatedAt: Date.now(),
          })),
          updatedAt: Date.now(),
        },
      })),

    updateMyThumbnail: (pageIndex, thumbnail) =>
      set((s) => ({
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            thumbnail,
          })),
        },
      })),

    addPageStroke: (pageIndex, stroke) =>
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            pageHandwriting: [...page.pageHandwriting, stroke],
            updatedAt: Date.now(),
          })),
          updatedAt: Date.now(),
        },
      })),

    removePageStroke: (pageIndex, strokeId) =>
      set((s) => ({
        ...pushHistory(s),
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            pageHandwriting: page.pageHandwriting.filter((st) => st.id !== strokeId),
            updatedAt: Date.now(),
          })),
          updatedAt: Date.now(),
        },
      })),

    /* === 朋友的 === */

    setFriendNotebook: (nb) => set({ friendNotebook: nb }),

    viewFriendPage: (pageIndex) => {
      const { friendNotebook } = get()
      if (!friendNotebook) return
      set({
        friendNotebook: {
          ...friendNotebook,
          currentPageIndex: Math.max(0, Math.min(pageIndex, friendNotebook.pages.length - 1)),
        },
      })
    },

    addDoodle: (friendPageIndex, doodle) =>
      set((s) => {
        if (!s.friendNotebook) return s
        const sync = getGlobalSync()
        if (sync) {
          addDoodleToDoc(sync.doc, s.friendNotebook.ownerId, friendPageIndex, doodle)
        }
        return {
          ...pushHistory(s),
          friendNotebook: {
            ...s.friendNotebook,
            pages: updatePage(s.friendNotebook.pages, friendPageIndex, (page) => ({
              ...page,
              doodleLayers: [...page.doodleLayers, doodle],
              updatedAt: Date.now(),
            })),
            updatedAt: Date.now(),
          },
        }
      }),

    removeDoodle: (friendPageIndex, doodleId) =>
      set((s) => {
        if (!s.friendNotebook) return s
        return {
          ...pushHistory(s),
          friendNotebook: {
            ...s.friendNotebook,
            pages: updatePage(s.friendNotebook.pages, friendPageIndex, (page) => ({
              ...page,
              doodleLayers: page.doodleLayers.filter((d) => d.id !== doodleId),
              updatedAt: Date.now(),
            })),
            updatedAt: Date.now(),
          },
        }
      }),

    /* === 涂鸦 === */

    toggleFriendDoodles: () =>
      set((s) => ({ showFriendDoodles: !s.showFriendDoodles })),

    togglePageDoodles: (pageIndex) =>
      set((s) => ({
        myNotebook: {
          ...s.myNotebook,
          pages: updatePage(s.myNotebook.pages, pageIndex, (page) => ({
            ...page,
            showDoodles: !page.showDoodles,
          })),
        },
      })),

    /* === 协作 === */
    setPeerStatus: (status) => set({ peerStatus: status }),
  }
})
