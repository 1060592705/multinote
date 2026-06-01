import { useState, Component, type ReactNode } from 'react'
import * as Y from 'yjs'
import { ArrowLeft, Copy, Check, Wifi } from 'lucide-react'
import type { RoomState } from '../../App'
import { generateRoomCode, generateUserId } from '../../lib/room'
import ManualConnect from './ManualConnect'

/* ── 调试用错误边界 ── */
class EB extends Component<{ children: ReactNode; name: string }, { err: Error | null }> {
  constructor(props: { children: ReactNode; name: string }) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (this.state.err) return <div className="p-3 rounded bg-red-600 text-white text-xs font-mono whitespace-pre-wrap">[{this.props.name}]\n{this.state.err.message}\n\n{this.state.err.stack?.split('\n').slice(0,10).join('\n')}</div>
    return this.props.children
  }
}

type Props = {
  onJoin: (room: RoomState) => void
  onBack: () => void
  onLanConnect: (doc: Y.Doc, userId: string, roomKey: string) => void
}

type ConnMode = 'online' | 'lan'

export default function CreateRoom({ onJoin, onBack, onLanConnect }: Props) {
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<ConnMode>('online')

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

        {/* ── 连接方式切换 ── */}
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

        {/* ── 在线模式 ── */}
        {mode === 'online' && (
          <div className="space-y-3">
            <button onClick={handleCopy} className="btn-accent w-full py-2.5 flex items-center justify-center gap-2">
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? '已复制！' : '复制链接'}
            </button>
            <button onClick={handleEnter} className="w-full py-2.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium">
              进入房间
            </button>
          </div>
        )}

        {/* ── 局域网模式 ── */}
        {mode === 'lan' && (
          <EB name="CreateRoom→ManualConnect">
            <ManualConnect
              onConnected={(doc) => {
                const lanUserId = `lan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                onLanConnect(doc, lanUserId, roomCode)
              }}
              onBack={() => setMode('online')}
              presetKey={roomCode}
            />
          </EB>
        )}
      </div>
    </div>
  )
}
