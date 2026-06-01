/**
 * 笔刷渲染引擎
 *
 * 负责笔迹平滑、不同笔刷的渲染逻辑、橡皮擦命中检测。
 */

import type { Stroke, Point } from '../types'
import { PRESSURE_VARIANCE, MIN_BRUSH_SIZE } from './constants'

/* ═══════════════════════════════════════════
   平滑处理
   ═══════════════════════════════════════════ */

/** 对原始采样点做二次贝塞尔平滑，返回插值后的渲染点 */
export function smoothPoints(points: Point[]): Point[] {
  if (points.length < 2) return points

  const smoothed: Point[] = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    // 中点插值法：在当前点和前后点的中点之间做贝塞尔
    const midX1 = (prev.x + curr.x) / 2
    const midY1 = (prev.y + curr.y) / 2
    const midP1 = (prev.pressure + curr.pressure) / 2

    const midX2 = (curr.x + next.x) / 2
    const midY2 = (curr.y + next.y) / 2
    const midP2 = (curr.pressure + next.pressure) / 2

    // 在 mid1 → curr → mid2 之间生成插值点
    const steps = 4 // 子分段数
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const oneMinusT = 1 - t
      const oneMinusT2 = oneMinusT * oneMinusT

      smoothed.push({
        x: oneMinusT2 * midX1 + 2 * oneMinusT * t * curr.x + t2 * midX2,
        y: oneMinusT2 * midY1 + 2 * oneMinusT * t * curr.y + t2 * midY2,
        pressure: oneMinusT2 * midP1 + 2 * oneMinusT * t * curr.pressure + t2 * midP2,
        timestamp: curr.timestamp,
      })
    }
  }

  smoothed.push(points[points.length - 1])
  return smoothed
}

/* ═══════════════════════════════════════════
   线宽计算
   ═══════════════════════════════════════════ */

/** 根据压感和基础尺寸计算实际线宽 */
export function computeLineWidth(pressure: number, baseSize: number): number {
  // 压感映射：pressure 0→1 映射为 baseSize*(1-variance) 到 baseSize*(1+variance)
  const minWidth = Math.max(MIN_BRUSH_SIZE, baseSize * (1 - PRESSURE_VARIANCE))
  const maxWidth = baseSize * (1 + PRESSURE_VARIANCE)
  return minWidth + (maxWidth - minWidth) * pressure
}

/* ═══════════════════════════════════════════
   笔刷渲染
   ═══════════════════════════════════════════ */

/** 钢笔：压感粗细 + 圆形笔头 + 轻微透明度 */
export function renderPenStroke(
  ctx: CanvasRenderingContext2D,
  smoothed: Point[],
  color: string,
  baseSize: number,
): void {
  if (smoothed.length < 1) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (smoothed.length === 1) {
    // 单点：画一个圆
    const p = smoothed[0]
    const w = computeLineWidth(p.pressure, baseSize)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  // 逐段绘制，每段使用不同的线宽（模拟压感）
  for (let i = 1; i < smoothed.length; i++) {
    const prev = smoothed[i - 1]
    const curr = smoothed[i]
    const w = computeLineWidth(curr.pressure, baseSize)

    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.globalAlpha = 0.95

    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(curr.x, curr.y)
    ctx.stroke()
  }

  ctx.restore()
}

/** 圆珠笔：均匀粗细，深色不透明 */
export function renderBallpointStroke(
  ctx: CanvasRenderingContext2D,
  smoothed: Point[],
  color: string,
  baseSize: number,
): void {
  if (smoothed.length < 1) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = baseSize
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.moveTo(smoothed[0].x, smoothed[0].y)
  for (let i = 1; i < smoothed.length; i++) {
    ctx.lineTo(smoothed[i].x, smoothed[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

/** 荧光笔：半透明 + 宽扁 + multiply 混合模式 */
export function renderHighlighterStroke(
  ctx: CanvasRenderingContext2D,
  smoothed: Point[],
  color: string,
  baseSize: number,
): void {
  if (smoothed.length < 1) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = baseSize * 2.5 // 比普通笔粗
  ctx.globalAlpha = 0.35
  ctx.globalCompositeOperation = 'multiply'

  ctx.beginPath()
  ctx.moveTo(smoothed[0].x, smoothed[0].y)
  for (let i = 1; i < smoothed.length; i++) {
    ctx.lineTo(smoothed[i].x, smoothed[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

/* ═══════════════════════════════════════════
   笔画渲染入口
   ═══════════════════════════════════════════ */

/** 渲染单条 Stroke 到指定 Canvas Context */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  const smoothed = smoothPoints(stroke.points)

  switch (stroke.brush) {
    case 'pen':
      renderPenStroke(ctx, smoothed, stroke.color, stroke.size)
      break
    case 'ballpoint':
      renderBallpointStroke(ctx, smoothed, stroke.color, stroke.size)
      break
    case 'highlighter':
      renderHighlighterStroke(ctx, smoothed, stroke.color, stroke.size)
      break
    case 'eraser':
      // 橡皮不渲染
      break
  }
}

/** 渲染一批笔画 */
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
): void {
  for (const stroke of strokes) {
    renderStroke(ctx, stroke)
  }
}

/* ═══════════════════════════════════════════
   橡皮擦命中检测
   ═══════════════════════════════════════════ */

const ERASER_HIT_RADIUS = 12

/** 判断一条笔画是否与某个点（橡皮位置）相交 */
export function hitTestStroke(
  stroke: Stroke,
  point: { x: number; y: number },
): boolean {
  for (const p of stroke.points) {
    const dx = p.x - point.x
    const dy = p.y - point.y
    if (dx * dx + dy * dy <= ERASER_HIT_RADIUS * ERASER_HIT_RADIUS) {
      return true
    }
  }
  return false
}

/** 判断一条笔画是否与线段（橡皮拖动路径）相交 */
export function hitTestStrokeLine(
  stroke: Stroke,
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
): boolean {
  for (const p of stroke.points) {
    if (pointToSegmentDistance(p, lineStart, lineEnd) <= ERASER_HIT_RADIUS) {
      return true
    }
  }
  return false
}

/** 点到线段的最短距离 */
function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    // a 和 b 是同一点
    const d = Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
    return d
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)
}
