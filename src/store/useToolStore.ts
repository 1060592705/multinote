/**
 * 工具状态管理（Zustand）
 *
 * 管理当前激活的笔刷、颜色、粗细等工具状态。
 */

import { create } from 'zustand'
import type { BrushType } from '../lib/constants'
import { DEFAULT_BRUSH_COLOR, DEFAULT_BRUSH_SIZE } from '../lib/constants'

interface ToolState {
  /* 当前工具 */
  activeBrush: BrushType
  color: string
  size: number
  /** 最近使用的颜色（用于快速切换） */
  recentColors: string[]

  /* 涂鸦模式（左侧查看朋友页面时） */
  isDoodleMode: boolean

  /* 编辑/涂鸦模式（右侧自己的笔记本） */
  editMode: 'write' | 'draw'

  /* 套索选区 */
  isLassoActive: boolean
  lassoSelection: { x: number; y: number; width: number; height: number } | null

  /* 操作 */
  setBrush: (brush: BrushType) => void
  setColor: (color: string) => void
  setSize: (size: number) => void
  setDoodleMode: (on: boolean) => void
  toggleDoodleMode: () => void
  setEditMode: (mode: 'write' | 'draw') => void
  toggleEditMode: () => void
  setLassoActive: (on: boolean) => void
  setLassoSelection: (sel: ToolState['lassoSelection']) => void
}

export const useToolStore = create<ToolState>((set) => ({
  activeBrush: 'pen',
  color: DEFAULT_BRUSH_COLOR,
  size: DEFAULT_BRUSH_SIZE,
  recentColors: [DEFAULT_BRUSH_COLOR],
  isDoodleMode: true,
  editMode: 'write',
  isLassoActive: false,
  lassoSelection: null,

  setBrush: (brush) =>
    set((s) => ({
      activeBrush: brush,
      isLassoActive: brush === 'eraser' ? false : s.isLassoActive,
    })),

  setColor: (color) =>
    set((s) => {
      const recent = [color, ...s.recentColors.filter((c) => c !== color)].slice(0, 8)
      return { color, recentColors: recent }
    }),

  setSize: (size) => set({ size }),

  setDoodleMode: (on) => set({ isDoodleMode: on }),
  toggleDoodleMode: () => set((s) => ({ isDoodleMode: !s.isDoodleMode })),

  setEditMode: (mode) => set({ editMode: mode }),
  toggleEditMode: () => set((s) => ({ editMode: s.editMode === 'write' ? 'draw' : 'write' })),

  setLassoActive: (on) => set({ isLassoActive: on }),
  setLassoSelection: (sel) => set({ lassoSelection: sel }),
}))
