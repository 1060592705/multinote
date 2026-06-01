/**
 * GoodNotes 风格工具栏
 *
 * 顶栏：撤销/重做 | 笔 橡皮 | ...... | 模式切换
 * 笔展开面板：笔类型 + 颜色（画布下压）
 * 粗度弹窗：悬浮不压缩画布
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Pen, Circle, Highlighter, Eraser, Undo2, Redo2, Pencil, Keyboard, Eye, EyeOff, PanelLeftOpen, PanelLeftClose, ZoomIn, RotateCcw } from 'lucide-react'
import { useToolStore } from '../../state/tool'
import { useNotebookStore } from '../../state/notebook'
import { useUIStore } from '../../state/ui'
import { COLOR_PRESETS, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE } from '../../constants'
import type { BrushType } from '../../constants'
import AddBlockButton from '../toolbar/AddBlockButton'

/* ── 笔刷按钮定义 ── */

const BRUSH_OPTIONS: { type: BrushType; icon: React.ReactNode; label: string }[] = [
  { type: 'pen', icon: <Pen size={20} />, label: '钢笔' },
  { type: 'ballpoint', icon: <Circle size={20} />, label: '圆珠笔' },
  { type: 'highlighter', icon: <Highlighter size={20} />, label: '荧光笔' },
]

/* ── Props ── */

type Props = {
  scale: number
  userZoom: number
  onResetZoom: () => void
}

export default function Toolbar({ scale, userZoom, onResetZoom }: Props) {
  /* ── Store ── */
  const activeBrush = useToolStore((s) => s.activeBrush)
  const setBrush = useToolStore((s) => s.setBrush)
  const color = useToolStore((s) => s.color)
  const setColor = useToolStore((s) => s.setColor)
  const size = useToolStore((s) => s.size)
  const setSize = useToolStore((s) => s.setSize)
  const editMode = useToolStore((s) => s.editMode)
  const toggleEditMode = useToolStore((s) => s.toggleEditMode)
  const isDoodleMode = useToolStore((s) => s.isDoodleMode)
  const toggleDoodleMode = useToolStore((s) => s.toggleDoodleMode)

  const showFriendDoodles = useNotebookStore((s) => s.showFriendDoodles)
  const toggleFriendDoodles = useNotebookStore((s) => s.toggleFriendDoodles)
  const addBlock = useNotebookStore((s) => s.addBlock)
  const currentPageIndex = useNotebookStore((s) => s.myNotebook.currentPageIndex)
  const undo = useNotebookStore((s) => s.undo)
  const redo = useNotebookStore((s) => s.redo)

  const selectedPageIndex = useUIStore((s) => s.selectedPageIndex)
  const isLeftPane = selectedPageIndex !== null
  const toggleFriendPanel = useUIStore((s) => s.toggleFriendPanel)
  const friendPanelOpen = useUIStore((s) => s.friendPanelOpen)

  /* ── 本地状态 ── */
  const [brushPanelOpen, setBrushPanelOpen] = useState(false)
  const [sizePopoverOpen, setSizePopoverOpen] = useState(false)
  const penBtnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const isDrawingMode = isLeftPane ? isDoodleMode : editMode === 'draw'
  const isPenTool = activeBrush !== 'eraser'

  /* ── 点击笔按钮 ── */
  const handlePenClick = useCallback(() => {
    if (!isPenTool) {
      // 当前是橡皮 → 切回钢笔 + 展开面板
      setBrush('pen')
      setBrushPanelOpen(true)
      setSizePopoverOpen(false)
    } else if (!brushPanelOpen) {
      // 笔已激活 → 展开面板
      setBrushPanelOpen(true)
      setSizePopoverOpen(false)
    } else {
      // 面板已展开 → 切换粗度弹窗
      setSizePopoverOpen(!sizePopoverOpen)
    }
  }, [isPenTool, brushPanelOpen, sizePopoverOpen, setBrush])

  /* ── 选择笔刷类型 ── */
  const handleSelectBrush = useCallback((type: BrushType) => {
    setBrush(type)
    setBrushPanelOpen(false)
    setSizePopoverOpen(false)
  }, [setBrush])

  /* ── 点击橡皮 ── */
  const handleEraserClick = useCallback(() => {
    setBrush('eraser')
    setBrushPanelOpen(false)
    setSizePopoverOpen(false)
  }, [setBrush])

  /* ── 点击外部关闭 ── */
  useEffect(() => {
    if (!brushPanelOpen && !sizePopoverOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (penBtnRef.current?.contains(target)) return
      setBrushPanelOpen(false)
      setSizePopoverOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [brushPanelOpen, sizePopoverOpen])

  return (
    <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border)] select-none">
      {/* ── 第一行：主工具栏 ── */}
      <div className="flex items-center gap-2 px-3 h-12">
        {/* 撤销/重做 */}
        <button onClick={undo} className="btn-icon" title="撤销">
          <Undo2 size={18} />
        </button>
        <button onClick={redo} className="btn-icon" title="重做">
          <Redo2 size={18} />
        </button>

        <div className="w-px h-6 bg-[var(--border)] mx-1" />

        {/* ── 绘图工具（仅绘图模式） ── */}
        {isDrawingMode && (
          <>
            {/* 笔按钮 */}
            <button
              ref={penBtnRef}
              onClick={handlePenClick}
              className={isPenTool ? 'btn-icon-active' : 'btn-icon'}
              title="笔"
            >
              <Pen size={18} />
            </button>

            {/* 橡皮按钮 */}
            <button
              onClick={handleEraserClick}
              className={activeBrush === 'eraser' ? 'btn-icon-active' : 'btn-icon'}
              title="橡皮"
            >
              <Eraser size={18} />
            </button>

            <div className="w-px h-6 bg-[var(--border)] mx-1" />
          </>
        )}

        {/* ── 右侧区域 ── */}
        <div className="flex-1" />

        {/* 添加内容块（输入模式） */}
        {!isDrawingMode && (
          <AddBlockButton
            onAddBlock={(block) => addBlock(currentPageIndex, block)}
          />
        )}

        {/* 编辑/涂鸦模式切换（自己笔记本） */}
        {!isLeftPane && (
          <button
            onClick={toggleEditMode}
            className={editMode === 'draw' ? 'btn-icon-active' : 'btn-icon'}
            title={editMode === 'draw' ? '涂鸦模式' : '输入模式'}
          >
            {editMode === 'draw' ? <Pencil size={18} /> : <Keyboard size={18} />}
          </button>
        )}

        {/* 涂鸦模式开关（朋友面板） */}
        {isLeftPane && (
          <button
            onClick={toggleDoodleMode}
            className={isDoodleMode ? 'btn-icon-active' : 'btn-icon'}
            title={isDoodleMode ? '涂鸦中' : '浏览中'}
          >
            <Pen size={18} />
          </button>
        )}

        {/* 朋友面板折叠 */}
        <button
          onClick={toggleFriendPanel}
          className="btn-icon"
          title={friendPanelOpen ? '折叠朋友面板' : '展开朋友面板'}
        >
          {friendPanelOpen ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {/* 显示朋友涂鸦 */}
        <button
          onClick={toggleFriendDoodles}
          className={showFriendDoodles ? 'btn-icon-active' : 'btn-icon'}
          title={showFriendDoodles ? '显示朋友涂鸦' : '隐藏朋友涂鸦'}
        >
          {showFriendDoodles ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        {/* 缩放显示 */}
        <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] min-w-[60px]">
          <ZoomIn size={13} />
          <span>{Math.round(scale * 100)}%</span>
          {userZoom !== 1 && (
            <button onClick={onResetZoom} className="btn-icon w-5 h-5" title="重置缩放">
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── 第二行：笔刷展开面板（画布下压） ── */}
      {brushPanelOpen && isDrawingMode && (
        <div
          ref={panelRef}
          className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]"
        >
          {/* 笔刷类型选择 */}
          <div className="flex items-center gap-1">
            {BRUSH_OPTIONS.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => handleSelectBrush(type)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all
                  ${activeBrush === type
                    ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                title={label}
              >
                {icon}
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-10 bg-[var(--border)]" />

          {/* 颜色选择 */}
          <div className="flex items-center gap-1">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform active:scale-90"
                style={{
                  backgroundColor: c,
                  borderColor: c === color ? 'var(--accent)' : 'transparent',
                  transform: c === color ? 'scale(1.2)' : 'scale(1)',
                }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 粗度悬浮弹窗（不压缩画布） ── */}
      {sizePopoverOpen && isDrawingMode && penBtnRef.current && (
        <div
          className="absolute bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-lg p-3 z-50"
          style={{
            top: penBtnRef.current.getBoundingClientRect().bottom + 4,
            left: penBtnRef.current.getBoundingClientRect().left,
          }}
        >
          <div className="flex items-center gap-3 min-w-[140px]">
            <span className="text-[11px] text-[var(--text-secondary)]">粗细</span>
            <input
              type="range"
              min={MIN_BRUSH_SIZE}
              max={MAX_BRUSH_SIZE}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="flex-1 h-1 accent-[var(--accent)] cursor-pointer"
            />
            <span className="text-[11px] text-[var(--text-tertiary)] w-8">{size}px</span>
          </div>
        </div>
      )}
    </div>
  )
}
