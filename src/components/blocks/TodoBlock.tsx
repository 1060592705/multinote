import { useRef, useEffect } from 'react'
import type { Block, TodoContent } from '../../types'

type Props = {
  block: Block
  isSelected: boolean
  readOnly?: boolean
  onChange: (content: TodoContent) => void
  onSelect: () => void
}

export default function TodoBlock({ block, isSelected, readOnly, onChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const content = block.content as unknown as TodoContent

  useEffect(() => {
    if (isSelected && !readOnly && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isSelected, readOnly])

  if (readOnly) {
    return (
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={content.checked || false} readOnly className="mt-0.5 w-4 h-4 shrink-0 pointer-events-none" />
        <span className={`text-sm ${content.checked ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
          {content.text || '待办事项'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={content.checked || false}
        onChange={(e) => onChange({ ...content, type: 'todo', checked: e.target.checked })}
        className="mt-0.5 w-4 h-4 rounded border-[var(--border)]
                   accent-[var(--accent)] cursor-pointer shrink-0"
      />
      <input
        ref={inputRef}
        type="text"
        value={content.text || ''}
        onChange={(e) => onChange({ type: 'todo', text: e.target.value, checked: content.checked || false })}
        onFocus={onSelect}
        placeholder="待办事项..."
        className={`flex-1 bg-transparent text-sm text-[var(--text-primary)]
                    placeholder:text-[var(--text-tertiary)] outline-none
                    ${content.checked ? 'line-through text-[var(--text-tertiary)]' : ''}`}
        style={{ fontFamily: 'inherit' }}
      />
    </div>
  )
}
