/**
 * 画布缩放 Hook
 *
 * 监听容器宽度，计算 CSS transform:scale() 的缩放比例。
 * 支持自动适应 + 手动缩放（乘法）叠加。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUIStore } from '../store/useUIStore'

/* ── 常量 ── */
export const LOGICAL_WIDTH_DUAL = 1464  // 720×2 + 24 缝隙
export const LOGICAL_WIDTH_SINGLE = 720
export const MIN_SCALE = 0.4
export const MAX_SCALE = 2.0

export interface CanvasScaleState {
  /** 最终缩放比例 */
  scale: number
  /** 自动缩放（基于容器宽度） */
  autoScale: number
  /** 用户手动缩放倍率（乘法叠加，1=不干预） */
  userZoom: number
  /** 容器实际宽度 */
  containerWidth: number
  /** 容器实际高度 */
  containerHeight: number
  /** 逻辑宽度（单页或双页） */
  logicalWidth: number
  /** 是否实际显示双页（屏幕宽 + 朋友面板展开） */
  isDual: boolean
  /** 屏幕是否够宽支持双页（用于显示折叠按钮） */
  screenWide: boolean
  /** 设置手动缩放（乘法: prev * (1 + delta)） */
  zoomBy: (delta: number) => void
  /** 重置手动缩放 */
  resetZoom: () => void
  /** 容器 ref */
  containerRef: React.MutableRefObject<HTMLDivElement | null>
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function useCanvasScale(): CanvasScaleState {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(window.innerWidth)
  const [containerHeight, setContainerHeight] = useState(window.innerHeight)
  const [userZoom, setUserZoom] = useState(1)
  const [isDual, setIsDual] = useState(true)

  // 监听容器宽高
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerWidth(e.contentRect.width)
        setContainerHeight(e.contentRect.height)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // 响应式：太窄时自动切单页（仅取决于屏幕宽度）
  useEffect(() => {
    if (containerWidth < LOGICAL_WIDTH_SINGLE * MIN_SCALE) {
      setIsDual(false)
    } else if (containerWidth > LOGICAL_WIDTH_SINGLE * 1.2) {
      setIsDual(true)
    }
  }, [containerWidth])

  // 朋友面板折叠状态
  const friendPanelOpen = useUIStore((s) => s.friendPanelOpen)

  // 逻辑宽度：
  //   双页展开 → 1464 (720+24+720)
  //   双页但朋友折叠 → 744 (24+720，折叠按钮列 + 我的面板)
  //   窄屏单页 → 720 (仅我的面板，无折叠按钮)
  const effectiveWidth = isDual
    ? (friendPanelOpen ? LOGICAL_WIDTH_DUAL : LOGICAL_WIDTH_SINGLE + 24)
    : LOGICAL_WIDTH_SINGLE

  const autoScale = clamp(containerWidth / effectiveWidth, MIN_SCALE, MAX_SCALE)

  // 最终缩放 = autoScale × userZoom（clamped）
  const scale = clamp(autoScale * userZoom, MIN_SCALE, MAX_SCALE)

  // 乘法缩放（与浏览器 Ctrl+滚轮手感一致）
  const zoomBy = useCallback((delta: number) => {
    setUserZoom((prev) => clamp(prev * (1 + delta), 0.5, 3.0))
  }, [])

  const resetZoom = useCallback(() => {
    setUserZoom(1)
  }, [])

  return {
    scale,
    autoScale,
    userZoom,
    containerWidth,
    containerHeight,
    logicalWidth: effectiveWidth,
    isDual: isDual && friendPanelOpen,
    screenWide: isDual,
    zoomBy,
    resetZoom,
    containerRef,
  }
}
