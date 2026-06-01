/**
 * 移动端底部导航栏
 *
 * 在手机竖屏时显示，切换"我的 / 朋友的"页面。
 */

import { User, Users, Pen } from 'lucide-react'
import { useUIStore } from '../../state/ui'
import { useToolStore } from '../../state/tool'
import { MOBILE_NAV_HEIGHT } from '../../constants'

export default function MobileNav() {
  const mobileView = useUIStore((s) => s.mobileView)
  const setMobileView = useUIStore((s) => s.setMobileView)
  const isDoodleMode = useToolStore((s) => s.isDoodleMode)
  const toggleDoodleMode = useToolStore((s) => s.toggleDoodleMode)

  return (
    <div
      className="sm:hidden flex items-center justify-around bg-[var(--bg-primary)]
                 border-t border-[var(--border)] shrink-0"
      style={{ height: MOBILE_NAV_HEIGHT }}
    >
      {/* 朋友的 */}
      <button
        onClick={() => setMobileView('friend')}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors
          ${mobileView === 'friend'
            ? 'text-[var(--accent)]'
            : 'text-[var(--text-tertiary)]'
          }`}
      >
        <Users size={20} />
        <span className="text-[10px]">朋友的</span>
      </button>

      {/* 涂鸦模式 */}
      <button
        onClick={toggleDoodleMode}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors
          ${isDoodleMode
            ? 'text-[var(--accent)] bg-[var(--accent-light)]'
            : 'text-[var(--text-tertiary)]'
          }`}
      >
        <Pen size={20} />
        <span className="text-[10px]">{isDoodleMode ? '涂鸦中' : '浏览'}</span>
      </button>

      {/* 我的 */}
      <button
        onClick={() => setMobileView('my')}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors
          ${mobileView === 'my'
            ? 'text-[var(--accent)]'
            : 'text-[var(--text-tertiary)]'
          }`}
      >
        <User size={20} />
        <span className="text-[10px]">我的</span>
      </button>
    </div>
  )
}
