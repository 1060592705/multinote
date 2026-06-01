import { useState } from 'react'
import * as Y from 'yjs'
import { ArrowLeft, Wifi } from 'lucide-react'
import type { RoomState } from '../../App'
import { generateRoomCode, generateUserId } from '../../net/room'
import ManualConnect from './ManualConnect'

type Props = {
  onJoin: (room: RoomState) => void
  onBack: () => void
  onLanConnect: (doc: Y.Doc, userId: string, roomKey: string) => void
}

type ConnMode = 'online' | 'lan'

export default function CreateRoom({ onJoin, onBack, onLanConnect }: Props) {
  const [mode, setMode] = useState<ConnMode>('online')

  const [roomCode] = useState(() => generateRoomCode())
  const [userId] = useState(() => generateUserId())

  const handleEnter = () => {
    onJoin({ roomCode, userId, isHost: true })
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="panel max-w-sm w-full mx-4 p-6">
        <button onClick={onBack} className="btn-icon mb-4">
          <ArrowLeft size={20} />
        </button>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          创建新房间
        </h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          进入房间后可将房间码分享给朋友
        </p>

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
            自动连接
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
            离线直连
          </button>
        </div>

        {/* 自动连接 */}
        {mode === 'online' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-tertiary)]">同一 WiFi 下自动 P2P 直连</p>
            <button onClick={handleEnter} className="btn-accent w-full py-3 text-base">
              创建房间
            </button>
          </div>
        )}

        {/* 离线直连 */}
        {mode === 'lan' && (
          <ManualConnect
            onConnected={(doc) => {
              const lanUserId = `lan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              onLanConnect(doc, lanUserId, roomCode)
            }}
            onBack={() => setMode('online')}
            presetKey={roomCode}
          />
        )}
      </div>
    </div>
  )
}
