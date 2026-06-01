import { useRef, useEffect } from 'react'
import type { Block, HeadingContent } from '../../types'

type Props = {
  block: Block
  level: 1 | 2 | 3
  isSelected: boolean
  readOnly?: boolean
  onChange: (content: HeadingContent) => void
  onSelect: () => void
}

const STYLES: Record<number, string> = {
  1: 'text-[28px] font-bold leading-tight',
  2: 'text-[22px] font-semibold leading-tight',
  3: 'text-[18px] font-semibold leading-snug',
}

const PLACEHOLDERS: Record<number, string> = {
  1: '标题 1',
  2: '标题 2',
  3: '标题 3',
}

export default function HeadingBlock({ block, level, isSelected, readOnly, onChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const content = block.content as unknown as HeadingContent

  useEffect(() => {
    if (isSelected && !readOnly && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isSelected, readOnly])

  if (readOnly) {
    const Tag = `h${level}` as keyof JSX.IntrinsicElements
    return (
      <Tag className={`text-[var(--text-primary)] ${STYLES[level]}`}>
        {content.text || PLACEHOLDERS[level]}
      </Tag>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={content.text || ''}
      onChange={(e) => onChange({ type: 'heading', level, text: e.target.value })}
      onFocus={onSelect}
      placeholder={PLACEHOLDERS[level]}
      className={`w-full bg-transparent text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)] outline-none
                  ${STYLES[level]}`}
      style={{ fontFamily: 'inherit' }}
    />
  )
}
