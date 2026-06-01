/**
 * UI 状态管理（Zustand）
 *
 * 管理布局、侧栏、主题、连接状态等界面状态。
 */

import { create } from 'zustand'

interface UIState {
  /* 侧栏 */
  sidebarOpen: boolean
  sidebarWidth: number  // 当前侧栏宽度（展开/折叠）

  /* 大纲展开 */
  expandedNotebooks: Set<string>
  expandedPages: Set<string>

  /* 主题 */
  isDarkMode: boolean  // 跟随系统，用于组件判断

  /* 当前选中的块 */
  selectedBlockId: string | null
  selectedPageIndex: number | null  // null = 右边（我的）

  /* 手机端当前视图 */
  mobileView: 'my' | 'friend'

  /* WebRTC 连接状态 */
  connectedPeers: number    // 已连接的对等端数量
  peerConnecting: boolean   // 正在尝试连接中

  /* 朋友面板折叠 */
  friendPanelOpen: boolean

  /* 画布缩放（供指针坐标修正用） */
  canvasScale: number

  /* 操作 */
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleFriendPanel: () => void

  toggleNotebook: (nbId: string) => void
  togglePage: (pageId: string) => void

  setDarkMode: (dark: boolean) => void

  selectBlock: (blockId: string | null) => void
  selectPage: (pageIndex: number | null) => void

  setMobileView: (view: 'my' | 'friend') => void

  setConnectedPeers: (count: number) => void
  setPeerConnecting: (connecting: boolean) => void
  setCanvasScale: (scale: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 280,

  expandedNotebooks: new Set(),
  expandedPages: new Set(),

  isDarkMode: false,

  selectedBlockId: null,
  selectedPageIndex: null,

  mobileView: 'my',

  connectedPeers: 0,
  peerConnecting: true,
  friendPanelOpen: true,
  canvasScale: 1,

  toggleSidebar: () =>
    set((s) => ({
      sidebarOpen: !s.sidebarOpen,
      sidebarWidth: !s.sidebarOpen ? 280 : 48,
    })),

  setSidebarOpen: (open) =>
    set({ sidebarOpen: open, sidebarWidth: open ? 280 : 48 }),

  toggleFriendPanel: () =>
    set((s) => ({ friendPanelOpen: !s.friendPanelOpen })),

  toggleNotebook: (nbId) =>
    set((s) => {
      const next = new Set(s.expandedNotebooks)
      if (next.has(nbId)) next.delete(nbId)
      else next.add(nbId)
      return { expandedNotebooks: next }
    }),

  togglePage: (pageId) =>
    set((s) => {
      const next = new Set(s.expandedPages)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return { expandedPages: next }
    }),

  setDarkMode: (dark) => set({ isDarkMode: dark }),

  selectBlock: (blockId) => set({ selectedBlockId: blockId }),
  selectPage: (pageIndex) => set({ selectedPageIndex: pageIndex }),

  setMobileView: (view) => set({ mobileView: view }),

  setConnectedPeers: (count) => set({ connectedPeers: count, peerConnecting: false }),
  setPeerConnecting: (connecting) => set({ peerConnecting: connecting }),
  setCanvasScale: (scale) => set({ canvasScale: scale }),
}))
