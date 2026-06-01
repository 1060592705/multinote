/**
 * RoomGate — 房间入口
 *
 * 新流程：先选连接方式 → 再设置房间码 + 创建/加入
 * 在线模式直接进入房间，LAN 模式进入 ManualConnect 直连。
 */

import { useState } from 'react'
import * as Y from 'yjs'
import { ArrowLeft, Copy, Check, Wifi, Globe, RefreshCw } from 'lucide-react'
import type { RoomState } from '../../App'
import { generateRoomCode, generateUserId } from '../../lib/room'
import ManualConnect from './ManualConnect'

/* ── 类型 ── */

type ConnMode = 'online' | 'lan'
type RoomAction = 'create' | 'join'
type Step = 'choose-mode' | 'room-entry' | 'lan-connect'

type Props = {
  onJoin: (room: RoomState) => void
  onLanConnect: (doc: Y.Doc, userId: string, roomKey: string) => void
}

/* ── 辅助 ── */

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'; ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}

/* ═══════════════════════════════════════════
   RoomGate
   ═══════════════════════════════════════════ */

export default function RoomGate({ onJoin, onLanConnect }: Props) {
  /* ── 状态 ── */
  const [step, setStep] = useState<Step>('choose-mode')
  const [connMode, setConnMode] = useState<ConnMode>('online')
  const [roomCode, setRoomCode] = useState('')
  const [action, setAction] = useState<RoomAction | null>(null)
  const [copied, setCopied] = useState(false)
  const [userId] = useState(() => generateUserId())

  /* ── 操作 ── */

  const handleGenerate = () => {
    setRoomCode(generateRoomCode())
  }

  const handleCopy = async () => {
    if (!roomCode.trim()) return
    const url = `${window.location.origin}?room=${roomCode.trim().toUpperCase()}`
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const goRoomEntry = (mode: ConnMode) => {
    setConnMode(mode)
    setStep('room-entry')
  }

  const handleCreate = () => {
    const code = roomCode.trim().toUpperCase()
    if (connMode === 'online') {
      onJoin({ roomCode: code, userId, isHost: true })
    } else {
      setAction('create')
      setStep('lan-connect')
    }
  }

  const handleJoin = () => {
    const code = roomCode.trim().toUpperCase()
    if (connMode === 'online') {
      onJoin({ roomCode: code, userId, isHost: false })
    } else {
      setAction('join')
      setStep('lan-connect')
    }
  }

  const valid = roomCode.trim().length >= 4

  /* ═══════════════════════════════════════════
     Step: 选择连接方式
     ═══════════════════════════════════════════ */

  if (step === 'choose-mode') {
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

          {/* 连接方式按钮 */}
          <div className="space-y-3">
            <button
              onClick={() => goRoomEntry('online')}
              className="btn-accent w-full py-3 text-base flex items-center justify-center gap-2"
            >
              <Globe size={18} />
              在线连接
            </button>
            <button
              onClick={() => goRoomEntry('lan')}
              className="w-full py-3 text-base rounded-lg border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors duration-150 font-medium active:scale-95 flex items-center justify-center gap-2"
            >
              <Wifi size={18} />
              局域网直连
            </button>
          </div>

          <p className="text-[var(--text-tertiary)] text-xs mt-6">
            无需注册 · 纯本地存储 · 点对点加密
          </p>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     Step: 设置房间码 + 创建/加入
     ═══════════════════════════════════════════ */

  if (step === 'room-entry') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--bg-secondary)]">
        <div className="panel max-w-sm w-full mx-4 p-6">

          {/* 返回 */}
          <button onClick={() => setStep('choose-mode')} className="btn-icon mb-4">
            <ArrowLeft size={20} />
          </button>

          {/* 标题 + 模式标记 */}
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {connMode === 'online' ? '在线连接' : '局域网直连'}
            </h2>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              connMode === 'online'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-purple-50 text-[var(--accent)]'
            }`}>
              {connMode === 'online' ? <Globe size={11} className="inline mr-0.5" /> : <Wifi size={11} className="inline mr-0.5" />}
              {connMode === 'online' ? 'Online' : 'LAN'}
            </span>
          </div>

          <p className="text-[var(--text-secondary)] text-sm mb-6">
            {connMode === 'online'
              ? '输入房间码，创建或加入一个在线协作房间'
              : '输入相同的房间码，创建或加入局域网连接'}
          </p>

          {/* 房间码输入 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              房间码
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="输入或生成房间码"
              maxLength={10}
              autoFocus
              className="w-full px-4 py-3 text-center text-2xl tracking-[0.3em] font-mono
                         bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                         text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* 生成 + 复制 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={handleGenerate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                         bg-[var(--bg-tertiary)] text-[var(--text-secondary)]
                         hover:bg-[var(--border)] transition-all text-sm"
            >
              <RefreshCw size={14} />
              随机生成
            </button>
            <button
              onClick={handleCopy}
              disabled={!valid}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                         bg-[var(--bg-tertiary)] text-[var(--text-secondary)]
                         hover:bg-[var(--border)] disabled:opacity-40
                         disabled:cursor-not-allowed transition-all text-sm"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '已复制' : '复制链接'}
            </button>
          </div>

          {/* 创建 + 加入 */}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={!valid}
              className="flex-1 py-2.5 rounded-lg bg-[var(--accent)] text-white
                         hover:bg-[var(--accent-hover)] disabled:opacity-40
                         disabled:cursor-not-allowed transition-all font-medium"
            >
              {connMode === 'online' ? '创建房间' : '发起连接'}
            </button>
            <button
              onClick={handleJoin}
              disabled={!valid}
              className="flex-1 py-2.5 rounded-lg border-2 border-[var(--accent)]
                         text-[var(--accent)] hover:bg-[var(--accent-light)]
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all font-medium"
            >
              {connMode === 'online' ? '加入房间' : '接受连接'}
            </button>
          </div>

        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     Step: 局域网直连 (ManualConnect)
     ═══════════════════════════════════════════ */

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="panel max-w-sm w-full mx-4 p-6">
        <ManualConnect
          onConnected={(doc) => {
            const lanUserId = `lan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            onLanConnect(doc, lanUserId, roomCode.trim().toUpperCase())
          }}
          onBack={() => setStep('room-entry')}
          presetKey={roomCode.trim().toUpperCase()}
          defaultRole={action === 'create' ? 'offerer' : 'answerer'}
        />
      </div>
    </div>
  )
}
