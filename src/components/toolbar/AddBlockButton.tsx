/**
 * 添加块按钮 — 工具栏中的 + 按钮，点击展开块类型选择菜单
 */

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { BlockType } from '../../constants'
import type { Block } from '../../types'

type Props = {
  onAddBlock: (block: Block) => void
}

const MENU_ITEMS: { type: BlockType; label: string; icon: string }[] = [
  { type: 'paragraph', label: '段落', icon: '¶' },
  { type: 'h1', label: '标题 1', icon: 'H1' },
  { type: 'h2', label: '标题 2', icon: 'H2' },
  { type: 'h3', label: '标题 3', icon: 'H3' },
  { type: 'todo', label: '待办事项', icon: '☑' },
  { type: 'image', label: '图片', icon: '🖼' },
]

function createBlock(type: BlockType, position: number): Block {
  const base = {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    handwriting: null,
    position,
    style: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  switch (type) {
    case 'paragraph':
      return { ...base, content: { type: 'paragraph' as const, text: '' } }
    case 'h1':
      return { ...base, content: { type: 'heading' as const, level: 1, text: '' } }
    case 'h2':
      return { ...base, content: { type: 'heading' as const, level: 2, text: '' } }
    case 'h3':
      return { ...base, content: { type: 'heading' as const, level: 3, text: '' } }
    case 'todo':
      return { ...base, content: { type: 'todo' as const, text: '', checked: false } }
    case 'image':
      return { ...base, content: { type: 'image' as const, src: '', alt: '', width: 0, height: 0 } }
    default:
      return { ...base, content: { type: 'paragraph' as const, text: '' } }
  }
}

export default function AddBlockButton({ onAddBlock }: Props) {
  const [open, setOpen] = useState(false)
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setBtnRect(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (type: BlockType) => {
    const block = createBlock(type, 0)
    onAddBlock(block)
    setOpen(false)
    setBtnRect(null)
  }

  const handleToggle = () => {
    if (!open) {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) setBtnRect(rect)
    } else {
      setBtnRect(null)
    }
    setOpen(!open)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="btn-icon"
        title="添加内容块"
      >
        <Plus size={18} />
      </button>

      {open && btnRect && (
        <div
          className="bg-[var(--bg-primary)] border border-[var(--border)]
                     rounded-lg shadow-lg py-1 min-w-[140px] z-50"
          style={{
            position: 'fixed',
            top: btnRect.bottom + 4,
            left: Math.min(btnRect.left, window.innerWidth - 160),
          }}
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.type}
              onClick={() => handleSelect(item.type)}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm
                         text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]
                         hover:text-[var(--text-primary)] transition-colors text-left"
            >
              <span className="w-6 text-center text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
