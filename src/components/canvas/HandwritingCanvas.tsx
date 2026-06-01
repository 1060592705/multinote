/**
 * 块级手写 Canvas 组件
 *
 * 每个 Block 实例挂载一个 HandwritingCanvas，
 * 负责捕获笔输入、实时渲染笔迹、管理笔画数据。
 *
 * 架构：双 Canvas 叠加
 *   - 背景 Canvas：存放已完成的笔画（笔画结束时渲染一次，无需每帧重绘）
 *   - 前景 Canvas：只渲染当前正在绘制的一笔（每帧清除 + 重绘，O(1)）
 *
 * 这是 tldraw / Excalidraw / GoodNotes 等主流绘图应用的标准做法，
 * 避免每帧重绘所有历史笔画导致的 iPad 书写延迟。
 */

import { useRef, useEffect, useCallback } from 'react'
import type { Stroke, HandwritingData, Point } from '../../types'
import { useToolStore } from '../../store/useToolStore'
import { useNotebookStore } from '../../store/useNotebookStore'
import { usePointerHandler } from '../../hooks/usePointerHandler'
import { renderStroke, renderStrokes, hitTestStroke, hitTestStrokeLine } from '../../lib/brush-engine'

type Props = {
  blockId: string
  pageIndex: number
  strokes: HandwritingData | null
  width: number
  height: number
  readOnly?: boolean
  isDoodle?: boolean
  pageLevel?: boolean
  targetNotebook?: 'my' | 'friend'
}

export default function HandwritingCanvas({
  blockId,
  pageIndex,
  strokes,
  width,
  height,
  readOnly = false,
  isDoodle = false,
  pageLevel = false,
  targetNotebook = 'my',
}: Props) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const fgCanvasRef = useRef<HTMLCanvasElement>(null)
  const currentStrokeRef = useRef<Stroke | null>(null)

  const activeBrush = useToolStore((s) => s.activeBrush)
  const color = useToolStore((s) => s.color)
  const size = useToolStore((s) => s.size)
  const editMode = useToolStore((s) => s.editMode)

  const addStroke = useNotebookStore((s) => s.addStroke)
  const removeStroke = useNotebookStore((s) => s.removeStroke)
  const addPageStroke = useNotebookStore((s) => s.addPageStroke)
  const removePageStroke = useNotebookStore((s) => s.removePageStroke)
  const addDoodle = useNotebookStore((s) => s.addDoodle)
  const removeDoodle = useNotebookStore((s) => s.removeDoodle)

  const isFriend = targetNotebook === 'friend'
  const acceptMouse = isDoodle || editMode === 'draw'

  /* ──────────────────────────
     背景层：已完成的笔画
     ────────────────────────── */
  const redrawBackground = useCallback(() => {
    const canvas = bgCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (strokes && strokes.length > 0) {
      renderStrokes(ctx, strokes)
    }
  }, [strokes])

  /* ──────────────────────────
     前景层：当前正在绘制的一笔
     ────────────────────────── */
  const redrawForeground = useCallback(() => {
    const canvas = fgCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (currentStrokeRef.current) {
      renderStroke(ctx, currentStrokeRef.current)
    }
  }, [])

  /* ──────────────────────────
     笔画回调
     ────────────────────────── */
  const handleStrokeStart = useCallback(() => {
    currentStrokeRef.current = null
  }, [])

  const handleStrokeMove = useCallback(
    (points: Point[]) => {
      if (points.length > 0) {
        currentStrokeRef.current = {
          id: '__drawing__',
          points,
          brush: activeBrush,
          color,
          size,
          timestamp: Date.now(),
          authorId: 'me',
        }
      }
      // 只重绘前景层（当前一笔），背景层不动
      redrawForeground()
    },
    [redrawForeground, activeBrush, color, size],
  )

  const handleStrokeEnd = useCallback(
    (strokeData: Omit<Stroke, 'id' | 'authorId'>) => {
      const fullStroke: HandwritingData[number] = {
        ...strokeData,
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        authorId: 'me',
      }

      // 1. 立即渲染到背景 Canvas（即时视觉反馈，不等 React 重渲染）
      const bgCanvas = bgCanvasRef.current
      if (bgCanvas) {
        const ctx = bgCanvas.getContext('2d')
        if (ctx) renderStroke(ctx, fullStroke)
      }

      // 2. 清除前景 Canvas
      currentStrokeRef.current = null
      const fgCanvas = fgCanvasRef.current
      if (fgCanvas) {
        const ctx = fgCanvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height)
      }

      // 3. 持久化到 store
      if (isFriend) {
        addDoodle(pageIndex, {
          id: `doodle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          pageId: `page-${pageIndex}`,
          blockId: pageLevel ? null : blockId,
          authorId: 'me',
          strokes: [fullStroke],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      } else if (pageLevel) {
        addPageStroke(pageIndex, fullStroke)
      } else {
        addStroke(pageIndex, blockId, fullStroke)
      }
    },
    [pageIndex, blockId, pageLevel, isFriend, addStroke, addPageStroke, addDoodle],
  )

  /* ──────────────────────────
     橡皮擦（操作历史笔画，不改动）
     ────────────────────────── */
  const handleEraserMove = useCallback(
    (prev: { x: number; y: number }, curr: { x: number; y: number }) => {
      if (!strokes) return
      for (const stroke of strokes) {
        if (hitTestStrokeLine(stroke, prev, curr)) {
          if (isFriend) removeDoodle(pageIndex, stroke.id)
          else if (pageLevel) removePageStroke(pageIndex, stroke.id)
          else removeStroke(pageIndex, blockId, stroke.id)
        }
      }
    },
    [strokes, pageIndex, blockId, pageLevel, isFriend, removeStroke, removePageStroke, removeDoodle],
  )

  const handleEraserTap = useCallback(
    (point: { x: number; y: number }) => {
      if (!strokes) return
      for (const stroke of strokes) {
        if (hitTestStroke(stroke, point)) {
          if (isFriend) removeDoodle(pageIndex, stroke.id)
          else if (pageLevel) removePageStroke(pageIndex, stroke.id)
          else removeStroke(pageIndex, blockId, stroke.id)
          break
        }
      }
    },
    [strokes, pageIndex, blockId, pageLevel, isFriend, removeStroke, removePageStroke, removeDoodle],
  )

  /* ──────────────────────────
     Pointer Handler（只绑定在前景 Canvas）
     ────────────────────────── */
  const { handlers } = usePointerHandler({
    brush: activeBrush,
    color,
    size,
    canvasRef: fgCanvasRef,
    enabled: !readOnly,
    acceptMouse,
    callbacks: {
      onStrokeStart: handleStrokeStart,
      onStrokeMove: handleStrokeMove,
      onStrokeEnd: handleStrokeEnd,
      onEraserMove: handleEraserMove,
      onEraserTap: handleEraserTap,
    },
  })

  /* ──────────────────────────
     尺寸同步（两个 Canvas 同时缩放 DPR）
     ────────────────────────── */
  const syncDimensions = useCallback(() => {
    const dpr = window.devicePixelRatio || 1
    for (const ref of [bgCanvasRef, fgCanvasRef]) {
      const canvas = ref.current
      if (!canvas) continue
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    }
  }, [width, height])

  useEffect(() => {
    syncDimensions()
    redrawBackground()
  }, [syncDimensions, redrawBackground])

  /* ──────────────────────────
     笔迹数据变化 → 重绘背景
     ────────────────────────── */
  useEffect(() => {
    redrawBackground()
  }, [redrawBackground])

  /* ──────────────────────────
     共用样式
     ────────────────────────── */
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    borderRadius: 'inherit',
  }

  return (
    <>
      {/* 背景 Canvas：已完成的笔画 */}
      <canvas
        ref={bgCanvasRef}
        style={{
          ...baseStyle,
          zIndex: pageLevel ? 5 : 10,
          pointerEvents: 'none', // 不响应事件，让前景 Canvas 捕获
        }}
      />

      {/* 前景 Canvas：当前笔画 + 事件捕获 */}
      <canvas
        ref={fgCanvasRef}
        style={{
          ...baseStyle,
          zIndex: pageLevel ? 6 : 11,
          pointerEvents: readOnly ? 'none' : 'auto',
          cursor: readOnly
            ? 'default'
            : activeBrush === 'eraser'
              ? 'crosshair'
              : acceptMouse || activeBrush === 'pen'
                ? 'crosshair'
                : 'default',
        }}
        {...handlers}
      />
    </>
  )
}

