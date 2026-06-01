import { useState } from 'react'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import type { RoomState } from '../../App'
import { generateRoomCode, generateUserId } from '../../lib/room'

type Props = {
  onJoin: (room: RoomState) => void
  onBack: () => void
}

export default function CreateRoom({ onJoin, onBack }: Props) {
  const [copied, setCopied] = useState(false)

  const [roomCode] = useState(() => generateRoomCode())
  const [userId] = useState(() => generateUserId())

  const handleEnter = () => {
    onJoin({ roomCode, userId, isHost: true })
  }

  const handleCopy = async () => {
    const url = `${window.location.origin}?room=${roomCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: 复制房间码
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="panel max-w-sm w-full mx-4 p-6">
        {/* 返回 */}
        <button onClick={onBack} className="btn-icon mb-4">
          <ArrowLeft size={20} />
        </button>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          创建新房间
        </h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          将房间码或链接分享给朋友，双方即可开始协作
        </p>

        {/* 房间码展示 */}
        <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6 text-center">
          <p className="text-[var(--text-tertiary)] text-xs mb-1">房间码</p>
          <p className="text-3xl font-mono font-bold text-[var(--accent)] tracking-widest select-all">
            {roomCode}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <button onClick={handleCopy} className="btn-accent w-full py-2.5 flex items-center justify-center gap-2">
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? '已复制！' : '复制链接'}
          </button>
          <button onClick={handleEnter} className="w-full py-2.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium">
            进入房间
          </button>
        </div>
      </div>
    </div>
  )
}
