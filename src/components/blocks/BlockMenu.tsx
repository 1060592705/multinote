/**
 * 块操作菜单 — 仅在 hover 时显示，不跟随选中态
 */

import { Plus, Trash2, GripVertical } from 'lucide-react'
import type { BlockType } from '../../lib/constants'

type Props = {
  onAdd: (type: BlockType) => void
  onDelete: () => void
  onDragStart: () => void
}

const BLOCK_TYPE_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: 'paragraph', label: '段落', icon: '¶' },
  { type: 'h1', label: '标题 1', icon: 'H1' },
  { type: 'h2', label: '标题 2', icon: 'H2' },
  { type: 'h3', label: '标题 3', icon: 'H3' },
  { type: 'todo', label: '待办', icon: '☑' },
  { type: 'image', label: '图片', icon: '🖼' },
]

export default function BlockMenu({ onAdd, onDelete, onDragStart }: Props) {
  return (
    <div
      className="absolute -left-2 top-0 -translate-x-full
                 opacity-0 group-hover:opacity-100 transition-opacity
                 flex items-center gap-0.5
                 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-md
                 px-1 py-1 z-20"
    >
      {/* 拖拽手柄 */}
      <button
        onPointerDown={(e) => {
          e.preventDefault()
          onDragStart()
        }}
        className="btn-icon w-7 h-7 cursor-grab active:cursor-grabbing"
        title="拖拽移动"
      >
        <GripVertical size={14} />
      </button>

      {/* 分隔 */}
      <div className="w-px h-5 bg-[var(--border)]" />

      {/* 添加块按钮 */}
      <div className="relative group/menu">
        <button className="btn-icon w-7 h-7" title="在下方添加块">
          <Plus size={14} />
        </button>

        {/* 下拉菜单 */}
        <div className="absolute left-0 top-full mt-1 hidden group-hover/menu:flex flex-col
                        bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg
                        shadow-lg py-1 min-w-[120px] z-30">
          {BLOCK_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onAdd(opt.type)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs
                         text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]
                         hover:text-[var(--text-primary)] transition-colors text-left"
            >
              <span className="w-5 text-center">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 删除 */}
      <button
        onClick={onDelete}
        className="btn-icon w-7 h-7 hover:text-[var(--danger)]"
        title="删除块"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
