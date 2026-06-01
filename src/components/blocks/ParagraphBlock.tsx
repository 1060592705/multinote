import { useRef, useEffect } from 'react'
import type { Block, ParagraphContent } from '../../types'

type Props = {
  block: Block
  isSelected: boolean
  readOnly?: boolean
  onChange: (content: ParagraphContent) => void
  onSelect: () => void
}

export default function ParagraphBlock({ block, isSelected, readOnly, onChange, onSelect }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const content = block.content as unknown as ParagraphContent

  useEffect(() => {
    if (isSelected && !readOnly && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isSelected, readOnly])

  if (readOnly) {
    return (
      <p className="text-sm text-[var(--text-primary)] leading-relaxed min-h-[24px] whitespace-pre-wrap">
        {content.text || ' '}
      </p>
    )
  }

  return (
    <textarea
      ref={inputRef}
      value={content.text || ''}
      onChange={(e) => onChange({ type: 'paragraph', text: e.target.value })}
      onFocus={onSelect}
      placeholder="输入文本..."
      rows={1}
      className="w-full resize-none bg-transparent text-sm text-[var(--text-primary)]
                 placeholder:text-[var(--text-tertiary)] outline-none
                 leading-relaxed min-h-[24px]"
      style={{ fontFamily: 'inherit' }}
      onInput={(e) => {
        const target = e.target as HTMLTextAreaElement
        target.style.height = 'auto'
        target.style.height = target.scrollHeight + 'px'
      }}
    />
  )
}
