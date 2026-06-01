import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  pageNumber: number
  totalPages: number
  /** 页码标签（如 "我的笔记本"） */
  label?: string
  /** 对方在线状态 */
  peerOnline?: boolean
  peerPage?: number
  onPrev: () => void
  onNext: () => void
}

export default function PageHeader({
  pageNumber,
  totalPages,
  label,
  peerOnline,
  peerPage,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="flex items-center justify-between h-10 px-3
                    bg-[var(--bg-primary)] border-b border-[var(--border-light)]
                    select-none shrink-0">
      {/* 左侧：标签 + 翻页按钮 */}
      <div className="flex items-center gap-2">
        {label && (
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {label}
          </span>
        )}

        <button
          onClick={onPrev}
          disabled={pageNumber <= 1}
          className="btn-icon w-6 h-6 disabled:opacity-30"
          title="上一页"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="text-xs font-mono text-[var(--text-primary)] min-w-[48px] text-center">
          {pageNumber} / {totalPages}
        </span>

        <button
          onClick={onNext}
          disabled={pageNumber >= totalPages}
          className="btn-icon w-6 h-6 disabled:opacity-30"
          title="下一页"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 右侧：对方状态 */}
      <div className="flex items-center gap-2">
        {peerOnline && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
            </span>
            {peerPage !== undefined && (
              <span className="text-[10px] text-[var(--text-tertiary)]">
                在第 {peerPage} 页
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
