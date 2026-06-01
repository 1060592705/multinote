import { useState } from 'react'
import {
  PanelLeftClose, PanelLeft, ChevronRight,
  FileText, Plus, Trash2
} from 'lucide-react'
import { useNotebookStore } from '../../state/notebook'
import { useUIStore } from '../../state/ui'
import { useToolStore } from '../../state/tool'
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '../../constants'

export default function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const expandedNotebooks = useUIStore((s) => s.expandedNotebooks)
  const toggleNotebook = useUIStore((s) => s.toggleNotebook)
  const isDoodleMode = useToolStore((s) => s.isDoodleMode)
  const editMode = useToolStore((s) => s.editMode)

  const myNotebook = useNotebookStore((s) => s.myNotebook)
  const friendNotebook = useNotebookStore((s) => s.friendNotebook)
  const goToMyPage = useNotebookStore((s) => s.goToMyPage)
  const viewFriendPage = useNotebookStore((s) => s.viewFriendPage)
  const addMyPage = useNotebookStore((s) => s.addMyPage)

  const width = sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH

  // 绘图模式下侧边栏内容禁用点击（防止 Apple Pencil 误触页面导航），折叠按钮不受影响
  const isDrawingMode = isDoodleMode || editMode === 'draw'

  return (
    <div
      className="shrink-0 bg-[var(--bg-primary)] border-r border-[var(--border)]
                 flex flex-col transition-all duration-200 overflow-hidden"
      style={{ width }}
    >
      {/* 顶部：标题 + 折叠按钮（始终可交互） */}
      <div
        className="flex items-center justify-between px-3 h-10 border-b border-[var(--border-light)] shrink-0"
        style={{ pointerEvents: 'auto' }}
      >
        {sidebarOpen && (
          <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wider uppercase">
            大纲
          </span>
        )}
        <button onClick={toggleSidebar} className="btn-icon w-7 h-7 ml-auto">
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
      </div>

      {!sidebarOpen ? (
        /* 折叠态：只显示图标列 */
        <div
          className="flex flex-col items-center py-3 gap-3"
          style={{ pointerEvents: isDrawingMode ? 'none' : 'auto' }}
        >
          <button className="btn-icon" title="我的笔记本">
            <FileText size={18} />
          </button>
          {friendNotebook && (
            <button className="btn-icon" title="朋友的笔记本">
              <FileText size={18} color="var(--accent)" />
            </button>
          )}
          <button onClick={() => addMyPage()} className="btn-icon" title="添加页面">
            <Plus size={18} />
          </button>
        </div>
      ) : (
        /* 展开态：完整大纲 */
        <div
          className="flex-1 overflow-y-auto py-2"
          style={{ pointerEvents: isDrawingMode ? 'none' : 'auto' }}
        >
          {/* 朋友的笔记本 */}
          <NotebookTreeNode
            notebook={friendNotebook}
            label="朋友的笔记本"
            isFriend={true}
            expanded={expandedNotebooks.has(friendNotebook?.id || '')}
            onToggleNotebook={() => friendNotebook && toggleNotebook(friendNotebook.id)}
            onGoToPage={(idx) => friendNotebook && viewFriendPage(idx)}
          />

          {/* 分隔 */}
          {friendNotebook && <div className="border-t border-[var(--border-light)] mx-3 my-2" />}

          {/* 我的笔记本 */}
          <NotebookTreeNode
            notebook={myNotebook}
            label="我的笔记本"
            isFriend={false}
            expanded={expandedNotebooks.has(myNotebook.id)}
            onToggleNotebook={() => toggleNotebook(myNotebook.id)}
            onGoToPage={goToMyPage}
          />

          {/* 添加页面按钮 */}
          <button
            onClick={() => addMyPage()}
            className="flex items-center gap-2 w-full px-6 py-1.5 text-xs
                       text-[var(--text-tertiary)] hover:text-[var(--accent)]
                       hover:bg-[var(--accent-light)] transition-colors"
          >
            <Plus size={14} />
            <span>添加页面</span>
          </button>
        </div>
      )}
    </div>
  )
}

/* ── 笔记本树节点 ── */

function NotebookTreeNode({
  notebook,
  label,
  isFriend,
  expanded,
  onToggleNotebook,
  onGoToPage,
}: {
  notebook: { id: string; name: string; pages: { id: string; pageNumber: number }[] } | null
  label: string
  isFriend: boolean
  expanded: boolean
  onToggleNotebook: () => void
  onGoToPage: (pageIndex: number) => void
}) {
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null)

  if (!notebook) {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <FileText size={14} />
          <span>{label}</span>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] ml-6 mt-0.5">
          {isFriend ? '等待朋友加入...' : '空笔记本'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* 笔记本标题 */}
      <button
        onClick={onToggleNotebook}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium
                   text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]
                   transition-colors text-left"
      >
        <span className="transition-transform" style={{
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
        }}>
          <ChevronRight size={12} />
        </span>
        <FileText size={14} color={isFriend ? 'var(--accent)' : undefined} />
        <span className="truncate">{label}</span>
        <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
          {notebook.pages.length}
        </span>
      </button>

      {/* 页面列表 */}
      {expanded && (
        <div className="ml-4">
          {notebook.pages.map((page, idx) => {
            const isHovered = hoveredPageId === page.id

            return (
              <div key={page.id}>
                <button
                  onClick={() => onGoToPage(idx)}
                  onMouseEnter={() => setHoveredPageId(page.id)}
                  onMouseLeave={() => setHoveredPageId(null)}
                  className="flex items-center gap-2 w-full px-3 py-1 text-xs
                             text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]
                             hover:text-[var(--text-primary)] transition-colors text-left
                             rounded-r-md group"
                >
                  <span className="transition-transform" style={{
                    transform: 'rotate(0deg)',
                    visibility: 'hidden'  // 暂时隐藏，等有锚点后再显示
                  }}>
                    <ChevronRight size={10} />
                  </span>
                  <FileText size={12} className="shrink-0" />
                  <span className="truncate">第 {page.pageNumber} 页</span>

                  {isHovered && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // TODO: 删除页面
                      }}
                      className="ml-auto opacity-0 group-hover:opacity-100
                                 hover:text-[var(--danger)] transition-all"
                      title="删除页面"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </button>

                {/* 页面内锚点（暂时为空，等标题提取功能） */}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
