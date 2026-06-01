import { useState } from 'react'
import * as Y from 'yjs'
import { ArrowLeft, LogIn, Wifi } from 'lucide-react'
import type { RoomState } from '../../App'
import { generateUserId } from '../../net/room'
import ManualConnect from './ManualConnect'

type Props = {
  onJoin: (room: RoomState) => void
  onBack: () => void
  onLanConnect: (doc: Y.Doc, userId: string, roomKey: string) => void
}

type ConnMode = 'online' | 'lan'

export default function JoinRoom({ onJoin, onBack, onLanConnect }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<ConnMode>('online')

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

        {/* 输入框（在线模式时需要，LAN 模式时用作预设） */}
        {mode === 'online' && (
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
        )}

        {/* 连接方式切换 */}
        <div className="flex mb-6 bg-[var(--bg-tertiary)] rounded-lg p-1">
          <button
            onClick={() => setMode('online')}
            className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
              mode === 'online'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm font-medium'
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            在线连接
          </button>
          <button
            onClick={() => setMode('lan')}
            className={`flex-1 py-1.5 text-sm rounded-md transition-all flex items-center justify-center gap-1 ${
              mode === 'lan'
                ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm font-medium'
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            <Wifi size={13} />
            局域网直连
          </button>
        </div>

        {/* 在线模式 */}
        {mode === 'online' && (
          <button
            onClick={handleJoin}
            disabled={normalized.length < 4}
            className="btn-accent w-full py-2.5 flex items-center justify-center gap-2
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogIn size={18} />
            加入房间
          </button>
        )}

        {/* 局域网模式 — 输入房间码后粘贴对方的 offer */}
        {mode === 'lan' && (
          <ManualConnect
            onConnected={(doc) => {
              const lanUserId = `lan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              onLanConnect(doc, lanUserId, normalized || 'LAN')
            }}
            onBack={() => setMode('online')}
            presetKey={normalized || undefined}
            role="answerer"
          />
        )}
      </div>
    </div>
  )
}
