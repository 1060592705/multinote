import { useState } from 'react'
import { ArrowLeft, LogIn } from 'lucide-react'
import type { RoomState } from '../../App'
import { generateUserId } from '../../net/room'

type Props = {
  onJoin: (room: RoomState) => void
  onBack: () => void
}

export default function JoinRoom({ onJoin, onBack }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const normalized = code.trim().toUpperCase()

  const handleJoin = () => {
    if (normalized.length < 4) {
      setError('房间码至少 4 位')
      return
    }
    onJoin({
      roomCode: normalized,
      userId: generateUserId(),
      isHost: false,
    })
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="panel max-w-sm w-full mx-4 p-6">
        <button onClick={onBack} className="btn-icon mb-4">
          <ArrowLeft size={20} />
        </button>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          加入已有房间
        </h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          输入朋友分享的房间码即可加入
        </p>

        {/* 输入框 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            房间码
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="输入房间码，如 ABC123"
            maxLength={10}
            autoFocus
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)]
                       bg-[var(--bg-primary)] text-[var(--text-primary)]
                       placeholder:text-[var(--text-tertiary)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                       focus:border-transparent text-lg font-mono tracking-widest
                       text-center transition-all"
          />
          {error && (
            <p className="text-[var(--danger)] text-sm mt-2">{error}</p>
          )}
        </div>

        <button
          onClick={handleJoin}
          disabled={normalized.length < 4}
          className="btn-accent w-full py-2.5 flex items-center justify-center gap-2
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LogIn size={18} />
          加入房间
        </button>
      </div>
    </div>
  )
}
