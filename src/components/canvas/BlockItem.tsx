/**
 * BlockItem — 单个内容块渲染组件
 *
 * 负责块的选择、尺寸测量、操作菜单、内容渲染、
 * 以及块级 HandwritingCanvas 的挂载。
 */

import { useRef, useEffect, useState } from 'react'
import type { Block, BlockContent } from '../../types'
import HandwritingCanvas from './HandwritingCanvas'
import BlockRenderer from '../blocks/BlockRenderer'
import BlockMenu from '../blocks/BlockMenu'
import { createEmptyBlock } from './blockUtils'

type Props = {
  block: Block
  pageIndex: number
  isSelected: boolean
  isDoodleMode: boolean
  readOnly: boolean
  targetNotebook: 'my' | 'friend'
  onClick: () => void
  onUpdateBlock: (blockId: string, content: BlockContent) => void
  onDeleteBlock: (blockId: string) => void
  onAddBlockAfter: (afterBlockId: string, block: Block) => void
}

export default function BlockItem({
  block,
  pageIndex,
  isSelected,
  isDoodleMode,
  readOnly,
  targetNotebook,
  onClick,
  onUpdateBlock,
  onDeleteBlock,
  onAddBlockAfter,
}: Props) {
  const blockRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = blockRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(el)
    const rect = el.getBoundingClientRect()
    setDimensions({ width: rect.width, height: rect.height })
    return () => observer.disconnect()
  }, [])

  const canWrite = isSelected && !readOnly

  return (
    <div
      ref={blockRef}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{ pointerEvents: 'auto' }}
      className={`relative group rounded-md transition-all duration-150 border
                 ${isSelected
                   ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                   : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                 }`}
    >
      {/* 块操作菜单（仅自己的笔记本、hover 时显示） */}
      {!readOnly && (
        <BlockMenu
          onAdd={(type) => {
            const newBlock = createEmptyBlock(type)
            onAddBlockAfter(block.id, newBlock)
          }}
          onDelete={() => onDeleteBlock(block.id)}
          onDragStart={() => {}}
        />
      )}

      {/* 块内容 */}
      <div className="px-3 py-2 min-h-[24px]">
        <BlockRenderer
          block={block}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={(blockId, content) => onUpdateBlock(blockId, content)}
          onSelect={onClick}
        />
      </div>

      {/* 手写 Canvas（块级，z-index: 10/11） */}
      {dimensions.width > 0 && dimensions.height > 0 && !readOnly && (
        <HandwritingCanvas
          blockId={block.id}
          pageIndex={pageIndex}
          strokes={block.handwriting}
          width={dimensions.width}
          height={dimensions.height}
          readOnly={!canWrite}
          isDoodle={isDoodleMode}
          targetNotebook={targetNotebook}
        />
      )}
    </div>
  )
}
