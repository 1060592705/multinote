/**
 * Pointer Events 处理 Hook
 *
 * 负责捕获笔/鼠标/触摸输入，转换为采样点序列，
 * 处理压感、防误触（仅接受笔输入用于书写）。
 */

import { useRef, useCallback } from 'react'
import type { Point, Stroke } from '../types'
import type { BrushType } from '../lib/constants'
import { useUIStore } from '../store/useUIStore'

/* ── 类型 ── */

export interface PointerCallbacks {
  /** 笔画开始时触发 */
  onStrokeStart?: () => void
  /** 笔画进行中，返回当前所有点 */
  onStrokeMove?: (points: Point[]) => void
  /** 笔画结束时触发，返回完整 Stroke 数据 */
  onStrokeEnd?: (stroke: Omit<Stroke, 'id' | 'authorId'>) => void
  /** 橡皮擦移动时触发，返回橡皮位置 */
  onEraserMove?: (prev: { x: number; y: number }, curr: { x: number; y: number }) => void
  /** 橡皮擦点击时触发 */
  onEraserTap?: (point: { x: number; y: number }) => void
}

export interface PointerHandlerOptions {
  /** 当前笔刷类型 */
  brush: BrushType
  color: string
  size: number
  /** Canvas 元素的 ref（用于坐标转换） */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 是否启用（false 时不响应） */
  enabled: boolean
  /** 是否接受鼠标输入（桌面端涂鸦模式） */
  acceptMouse: boolean
  /** 回调 */
  callbacks: PointerCallbacks
}

/* ── Hook 返回值 ── */

export interface PointerHandlerResult {
  /** 绑定到 Canvas 的 pointer 事件处理器 */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: (e: React.PointerEvent) => void
    onPointerLeave: (e: React.PointerEvent) => void
    onPointerCancel: (e: React.PointerEvent) => void
  }
  /** 当前是否正在画 */
  isDrawing: boolean
}

/* ── Hook 实现 ── */

export function usePointerHandler(opts: PointerHandlerOptions): PointerHandlerResult {
  const isDrawing = useRef(false)
  const pointsRef = useRef<Point[]>([])
  const lastEraserPos = useRef<{ x: number; y: number } | null>(null)

  /** 获取相对于 canvas 逻辑像素的坐标（修正 CSS transform:scale 偏移）
   *  接受 clientX/clientY 而非 PointerEvent，支持 getCoalescedEvents 返回的原生事件 */
  const canvasPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = opts.canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scale = useUIStore.getState().canvasScale || 1
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      }
    },
    [opts.canvasRef],
  )

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent | PointerEvent): { x: number; y: number } | null => {
      return canvasPoint(e.clientX, e.clientY)
    },
    [canvasPoint],
  )

  /** 判断当前事件是否应被处理
   *
   *  模式分离策略（通过 opts.acceptMouse 统一控制 pen/mouse 是否触发涂鸦）：
   *    - 涂鸦模式 (isDoodleMode)  → acceptMouse=true  → pen/mouse/touch 可绘制
   *    - 绘制模式 (editMode=draw)  → acceptMouse=true  → pen/mouse/touch 可绘制
   *    - 输入模式 (editMode=write) → acceptMouse=false → pen/mouse 穿透到块层用于选中/编辑
   *
   *  iPad Safari 特殊处理：
   *    - 快速书写时偶尔将 Apple Pencil `pointerType` 误报为 'touch'
   *    - 绘制中不受 pointerType 变化影响（mid-stroke 续笔）
   *    - 绘制起始时 touch + pressure>0 视为笔（Apple Pencil 有压感，手掌误触 pressure=0）
   */
  const shouldHandle = useCallback(
    (e: React.PointerEvent): boolean => {
      if (!opts.enabled) return false
      // pen 仅在接受时绘制（acceptMouse 在 draw/doodle 模式为 true，write 模式为 false）
      if (e.pointerType === 'pen') return opts.acceptMouse
      // 绘制中不受 pointerType 变化影响，保持连续性
      if (isDrawing.current) return true
      // 触摸起始：仅压力 > 0（笔）且处于绘图模式
      if (e.pointerType === 'touch' && e.pressure > 0) return opts.acceptMouse
      if (e.pointerType === 'mouse') return opts.acceptMouse
      return false
    },
    [opts.enabled, opts.acceptMouse],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!shouldHandle(e)) return
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const point = getCanvasPoint(e)
      if (!point) return

      const sample: Point = {
        x: point.x,
        y: point.y,
        pressure: e.pressure || 0.5,
        timestamp: Date.now(),
      }

      pointsRef.current = [sample]
      isDrawing.current = true
      lastEraserPos.current = point

      opts.callbacks.onStrokeStart?.()
    },
    [shouldHandle, getCanvasPoint, opts.callbacks],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!shouldHandle(e) || !isDrawing.current) return
      e.preventDefault()

      // getCoalescedEvents：取出浏览器在两次事件派发之间采样的所有中间点
      // iPad Safari 笔采样 120Hz 但只派发 60Hz → 丢一半点。此 API 补齐丢失的点。
      const coalesced = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [e.nativeEvent]
      let lastSample: Point | null = null

      for (const ce of coalesced) {
        const pt = canvasPoint(ce.clientX, ce.clientY)
        if (!pt) continue

        const sample: Point = {
          x: pt.x,
          y: pt.y,
          pressure: (ce as PointerEvent).pressure || 0.5,
          timestamp: Date.now(),
        }

        pointsRef.current.push(sample)
        lastSample = sample
      }

      if (lastSample) {
        if (opts.brush === 'eraser') {
          if (lastEraserPos.current) {
            opts.callbacks.onEraserMove?.(lastEraserPos.current, lastSample)
          }
          lastEraserPos.current = lastSample
        } else {
          opts.callbacks.onStrokeMove?.(pointsRef.current)
        }
      }
    },
    [shouldHandle, canvasPoint, opts.brush, opts.callbacks],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return
      e.preventDefault()
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      isDrawing.current = false

      if (opts.brush === 'eraser') {
        // 橡皮擦点击（短按）
        opts.callbacks.onEraserTap?.(
          lastEraserPos.current || { x: 0, y: 0 }
        )
      } else {
        // 完成笔画
        const points = pointsRef.current
        if (points.length > 0) {
          opts.callbacks.onStrokeEnd?.({
            points,
            brush: opts.brush,
            color: opts.color,
            size: opts.size,
            timestamp: Date.now(),
          })
        }
      }

      pointsRef.current = []
      lastEraserPos.current = null
    },
    [opts.brush, opts.color, opts.size, opts.callbacks],
  )

  /** pointerleave 不再结束笔画。
   *  iPad 快速书写时 Apple Pencil 会短暂离开悬停检测范围，触发 pointerleave，
   *  导致笔画被提前截断。pointerup 才是笔真正抬起的信号，用它结束笔画即可。 */
  const onPointerLeave = useCallback(
    (_e: React.PointerEvent) => {
      // 故意不做任何事 — 让 pointerup 负责结束笔画
    },
    [],
  )

  /** pointercancel：系统中断（来电、手势、手掌误触等）。tldraw 也显式处理此事件。
   *  清理状态并保存已有笔画数据（不完整也比全丢好）。 */
  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return
      e.preventDefault()
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch (_) {}

      isDrawing.current = false

      // 保存当前已有的点
      if (opts.brush !== 'eraser') {
        const points = pointsRef.current
        if (points.length > 0) {
          opts.callbacks.onStrokeEnd?.({
            points,
            brush: opts.brush,
            color: opts.color,
            size: opts.size,
            timestamp: Date.now(),
          })
        }
      }

      pointsRef.current = []
      lastEraserPos.current = null
    },
    [opts.brush, opts.color, opts.size, opts.callbacks],
  )

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
    },
    get isDrawing() {
      return isDrawing.current
    },
  }
}
