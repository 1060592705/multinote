/**
 * 画布缩放容器
 *
 * 对子内容应用 CSS transform:scale()，实现画布整体等比缩放。
 * 使用视觉尺寸外层容器避免布局溢出产生滚动条。
 */

import { type ReactNode } from 'react'
import { LOGICAL_WIDTH_DUAL, LOGICAL_WIDTH_SINGLE } from '../../hooks/useCanvasScale'

type Props = {
  children: ReactNode
  scale: number
  isDual: boolean
  containerRef: React.MutableRefObject<HTMLDivElement | null>
  onWheelZoom?: (delta: number) => void
}

export default function CanvasScaler({ children, scale, isDual, containerRef, onWheelZoom }: Props) {
  const logicalWidth = isDual ? LOGICAL_WIDTH_DUAL : LOGICAL_WIDTH_SINGLE
  const visualWidth = logicalWidth * scale

  // Ctrl+滚轮手动缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      // deltaY > 0 向下滚 = 缩小, < 0 向上滚 = 放大
      // 乘法缩放: 每次滚轮 tick 约 5% 变化
      const delta = -e.deltaY * 0.005
      onWheelZoom?.(delta)
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden"
      onWheel={handleWheel}
    >
      {/* 视觉尺寸容器：宽度 = 逻辑宽度 × 缩放，确保无横向溢出 */}
      <div
        className="mx-auto h-full"
        style={{ width: visualWidth, overflow: 'hidden' }}
      >
        {/* 缩放内容：transform-origin: top left 确保缩放后填入视觉容器 */}
        <div
          style={{
            width: logicalWidth,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
