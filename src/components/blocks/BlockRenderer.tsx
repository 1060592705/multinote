/**
 * 块分发渲染器 — 根据 Block.type 渲染对应的块组件
 */

import type { Block } from '../../types'
import ParagraphBlock from './ParagraphBlock'
import HeadingBlock from './HeadingBlock'
import TodoBlock from './TodoBlock'
import ImageBlock from './ImageBlock'

type Props = {
  block: Block
  isSelected: boolean
  /** 是否只读（查看朋友面板时） */
  readOnly?: boolean
  /** 更新块内容 */
  onChange: (blockId: string, content: Block['content']) => void
  /** 选中块 */
  onSelect: () => void
}

export default function BlockRenderer({ block, isSelected, readOnly, onChange, onSelect }: Props) {
  const handleChange = (content: Block['content']) => {
    onChange(block.id, content)
  }

  switch (block.type) {
    case 'paragraph':
      return (
        <ParagraphBlock
          block={block}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={handleChange}
          onSelect={onSelect}
        />
      )
    case 'h1':
      return (
        <HeadingBlock
          block={block}
          level={1}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={handleChange}
          onSelect={onSelect}
        />
      )
    case 'h2':
      return (
        <HeadingBlock
          block={block}
          level={2}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={handleChange}
          onSelect={onSelect}
        />
      )
    case 'h3':
      return (
        <HeadingBlock
          block={block}
          level={3}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={handleChange}
          onSelect={onSelect}
        />
      )
    case 'todo':
      return (
        <TodoBlock
          block={block}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={handleChange}
          onSelect={onSelect}
        />
      )
    case 'image':
      return (
        <ImageBlock
          block={block}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={handleChange}
          onSelect={onSelect}
        />
      )
    default:
      return (
        <div className="text-sm text-[var(--text-tertiary)] italic px-3 py-2">
          暂不支持的块类型: {block.type}
        </div>
      )
  }
}
