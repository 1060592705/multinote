/**
 * PageCanvas — 页面画布容器
 *
 * 管理页面级滚动、纸张渲染、块列表、页面级手写层。
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import type { Page, Block, BlockContent } from '../../types'
import { PAGE_WIDTH, PAGE_PX, PAGE_PY, PAGE_MIN_HEIGHT } from '../../constants'
import { useNotebookStore } from '../../state/notebook'
import { useToolStore } from '../../state/tool'
import HandwritingCanvas from './HandwritingCanvas'
import BlockItem from './BlockItem'
import EmptyPageHint from './EmptyPageHint'

type Props = {
  page: Page
  pageIndex: number
  showDoodles?: boolean
  isDoodleMode?: boolean
  targetNotebook: 'my' | 'friend'
  onBlockSelect?: (blockId: string | null) => void
  readOnly?: boolean
}

export default function PageCanvas({
  page,
  pageIndex,
  showDoodles = true,
  isDoodleMode = false,
  targetNotebook,
  onBlockSelect,
  readOnly = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [paperSize, setPaperSize] = useState({ w: PAGE_WIDTH, h: PAGE_MIN_HEIGHT })

  const updateBlock = useNotebookStore((s) => s.updateBlock)
  const removeBlock = useNotebookStore((s) => s.removeBlock)
  const insertBlockAfter = useNotebookStore((s) => s.insertBlockAfter)
  const editMode = useToolStore((s) => s.editMode)

  // 绘图模式：涂鸦模式（朋友面板）或自己面板的 draw 模式
  // 此模式下笔触用于绘制，块不可选中/编辑，防止误触
  const isDrawingMode = isDoodleMode || editMode === 'draw'

  /* ── 页面切换 / 进入绘图模式时重置选中 ── */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setSelectedBlockId(null)
    onBlockSelect?.(null)
  }, [page.id, isDrawingMode])

  /* ── 测量纸张尺寸 ── */
  useEffect(() => {
    const el = paperRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setPaperSize({ w: e.contentRect.width, h: e.contentRect.height })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [page.id])

  const contentMinHeight = Math.max(
    PAGE_MIN_HEIGHT - PAGE_PY * 2,
    page.blocks.length * 80,
  )

  /* ── 选中逻辑（绘图模式下禁用以防误触） ── */
  const handleBlockSelect = useCallback(
    (blockId: string) => {
      if (isDrawingMode) return
      setSelectedBlockId(blockId)
      onBlockSelect?.(blockId)
    },
    [onBlockSelect, isDrawingMode],
  )

  const handlePaperClick = useCallback(() => {
    if (isDrawingMode) return
    setSelectedBlockId(null)
    onBlockSelect?.(null)
  }, [onBlockSelect, isDrawingMode])

  const handleUpdateBlock = useCallback(
    (blockId: string, content: BlockContent) => {
      updateBlock(pageIndex, blockId, (b) => ({ ...b, content, updatedAt: Date.now() }))
    },
    [pageIndex, updateBlock],
  )

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      removeBlock(pageIndex, blockId)
      if (selectedBlockId === blockId) setSelectedBlockId(null)
    },
    [pageIndex, removeBlock, selectedBlockId],
  )

  const handleAddBlockAfter = useCallback(
    (afterBlockId: string, block: Block) => {
      insertBlockAfter(pageIndex, afterBlockId, block)
    },
    [pageIndex, insertBlockAfter],
  )

  /* ── 内容判定 ── */
  const hasAnyContent =
    page.blocks.length > 0 ||
    (page.pageHandwriting?.length || 0) > 0 ||
    (showDoodles && page.doodleLayers.length > 0)

  const pageCanvasEnabled = isDoodleMode || !readOnly || hasAnyContent

  const pageStrokes = showDoodles
    ? [
        ...(page.pageHandwriting || []),
        ...page.doodleLayers.flatMap((d) => d.strokes),
      ]
    : page.pageHandwriting

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <div
        ref={paperRef}
        className="paper-texture mx-0 my-4 relative select-none"
        style={{
          width: '100%',
          minHeight: `${contentMinHeight + PAGE_PY * 2}px`,
          padding: `${PAGE_PY}px ${PAGE_PX}px`,
          borderRadius: '2px',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onClick={handlePaperClick}
      >
        {/* ── 页面级手写 Canvas（双 Canvas 架构，z-index: 5/6） ── */}
        {paperSize.w > 0 && paperSize.h > 0 && pageCanvasEnabled && (
          <HandwritingCanvas
            blockId={`page-${page.id}`}
            pageIndex={pageIndex}
            strokes={pageStrokes}
            width={paperSize.w}
            height={paperSize.h}
            readOnly={readOnly && !isDoodleMode}
            isDoodle={isDoodleMode}
            pageLevel={true}
            targetNotebook={targetNotebook}
          />
        )}

        {/* ── 块列表 ── */}
        <div
          className="space-y-4 min-h-[200px] relative z-[6]"
          style={{ pointerEvents: 'none' }}
        >
          {page.blocks.length === 0 && !hasAnyContent ? (
            <EmptyPageHint isDoodleMode={isDoodleMode} />
          ) : (
            page.blocks
              .sort((a, b) => a.position - b.position)
              .map((block) => (
                <BlockItem
                  key={block.id}
                  block={block}
                  pageIndex={pageIndex}
                  isSelected={selectedBlockId === block.id}
                  isDoodleMode={isDoodleMode}
                  readOnly={readOnly}
                  targetNotebook={targetNotebook}
                  onClick={() => handleBlockSelect(block.id)}
                  onUpdateBlock={handleUpdateBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onAddBlockAfter={handleAddBlockAfter}
                />
              ))
          )}
        </div>

        {/* ── 底部提示 ── */}
        {!readOnly && !hasAnyContent && (
          <div className="mt-8 pt-4 border-t border-dashed border-[var(--border-light)] relative z-[6]">
            <p className="text-xs text-center text-[var(--text-tertiary)]">
              点击 + 按钮添加内容块，或切换到涂鸦模式自由绘制
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
