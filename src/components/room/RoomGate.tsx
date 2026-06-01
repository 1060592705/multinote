import { useState } from 'react'
import * as Y from 'yjs'
import type { RoomState } from '../../App'
import CreateRoom from './CreateRoom'
import JoinRoom from './JoinRoom'
import ManualConnect from './ManualConnect'

type Props = {
  onJoin: (room: RoomState) => void
  onLanConnect: (doc: Y.Doc, userId: string, roomKey: string) => void
}

export default function RoomGate({ onJoin, onLanConnect }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join' | 'lan'>('choose')

  if (mode === 'create') {
    return (
      <CreateRoom
        onJoin={onJoin}
        onBack={() => setMode('choose')}
      />
    )
  }

  if (mode === 'join') {
    return (
      <JoinRoom
        onJoin={onJoin}
        onBack={() => setMode('choose')}
      />
    )
  }

  if (mode === 'lan') {
    return (
      <ManualConnect
        onConnected={(doc) => {
          const userId = `lan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          onLanConnect(doc, userId, '')
        }}
        onBack={() => setMode('choose')}
      />
    )
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="text-center max-w-sm w-full px-8">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-16 h-16 bg-[var(--accent)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">MN</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">MultiNote</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            双人实时协作手写笔记本
          </p>
        </div>

        {/* 按钮 */}
        <div className="space-y-3">
          <button
            onClick={() => setMode('create')}
            className="btn-accent w-full py-3 text-base"
          >
            创建新房间
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full py-3 text-base rounded-lg border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors duration-150 font-medium active:scale-95"
          >
            加入已有房间
          </button>
          <div className="pt-2 border-t border-[var(--border-light)]">
            <button
              onClick={() => setMode('lan')}
              className="w-full py-3 text-base rounded-lg border-2 border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-150 font-medium active:scale-95"
            >
              🔗 局域网直连
            </button>
            <p className="text-[var(--text-tertiary)] text-xs mt-1">同一 WiFi 下零延迟直连</p>
          </div>
        </div>

        <p className="text-[var(--text-tertiary)] text-xs mt-6">
          无需注册 · 纯本地存储 · 点对点加密
        </p>
      </div>
    </div>
  )
}
