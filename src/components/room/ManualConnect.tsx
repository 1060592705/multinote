/**
 * ManualConnect — 局域网直连 UI 组件
 *
 * 通过复制粘贴 SDP 文本建立 WebRTC P2P 连接，
 * 同 WiFi 下 mDNS 局域网直连，零外部服务器。
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { Copy, Check, Link, Loader2, Wifi, ArrowRightLeft, AlertCircle, ArrowLeft } from 'lucide-react'
import { useManualSync } from '../../hooks/useManualSync'

/* ── 步骤枚举 ── */

type Step =
  | 'init'          // 输入房间码
  | 'offer-ready'   // 发起方：offer 已生成
  | 'connecting'    // 等待 DataChannel 打开
  | 'offer-done'    // 发起方：已完成连接
  | 'answer-input'  // 接收方：等待粘贴 offer
  | 'answer-ready'  // 接收方：answer 已生成
  | 'answer-done'   // 接收方：已完成连接
  | 'error'         // 错误

/* ── Props ── */

type Props = {
  /** 连接成功后回调 */
  onConnected: (doc: Y.Doc) => void
  /** 返回 */
  onBack: () => void
  /** 预设房间码（从创建/加入房间传入） */
  presetKey?: string
  /** 预设角色（创建方为 offerer，加入方为 answerer） */
  role?: 'offerer' | 'answerer'
}

/* ── 辅助 ── */

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}

export default function ManualConnect({ onConnected, onBack, presetKey, role: presetRole }: Props) {
  /* ── 状态 ── */
  const [roomKey, setRoomKey] = useState(presetKey || '')
  const [role, setRole] = useState<'offerer' | 'answerer' | null>(presetRole || null)
  // 预设 answerer 角色时直接进入粘贴 offer 步骤
  const [step, setStep] = useState<Step>(presetRole === 'answerer' ? 'answer-input' : 'init')
  const [localSdp, setLocalSdp] = useState('')
  const [remoteSdp, setRemoteSdp] = useState('')
  const [copiedOffer, setCopiedOffer] = useState(false)
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /* ── Yjs Doc — 使用 ref 确保同步读写 ── */
  const docRef = useRef<Y.Doc | null>(null)
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const sync = useManualSync(docRef, roomKey)

  /** 同步创建 Doc：直接写 ref.current + setState（触发重渲染） */
  function ensureDoc(): Y.Doc {
    if (!docRef.current) {
      docRef.current = new Y.Doc()
      setDoc(docRef.current)
    }
    return docRef.current
  }

  /* ── 监听连接状态 ── */
  const connTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (sync.synced && doc) {
      if (connTimerRef.current) clearTimeout(connTimerRef.current)
      setStep(role === 'offerer' ? 'offer-done' : 'answer-done')
      const t = setTimeout(() => onConnected(doc), 800)
      return () => clearTimeout(t)
    }
  }, [sync.synced, doc, role, onConnected])

  // 连接超时（30 秒后仍未建立则提示）
  useEffect(() => {
    if (step !== 'connecting') return
    connTimerRef.current = setTimeout(() => {
      setError('连接超时，请检查双方是否在同一 WiFi 下，或重新发起连接')
      setStep('error')
    }, 30000)
    return () => {
      if (connTimerRef.current) clearTimeout(connTimerRef.current)
    }
  }, [step])

  /* ── 发起方：创建连接 ── */
  const handleCreate = useCallback(async () => {
    if (!roomKey.trim()) {
      setError('请先输入房间码')
      return
    }
    setError('')
    setRole('offerer')
    setLoading(true)

    // 先确保 doc 存在（直接写 ref，不依赖 React 重渲染）
    ensureDoc()

    try {
      const sdp = await sync.createOffer()
      setLocalSdp(sdp)
      setStep('offer-ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建连接失败')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }, [roomKey, sync])

  /* ── 发起方：粘贴 answer 完成连接 ── */
  const handleAcceptAnswer = useCallback(async () => {
    if (!remoteSdp.trim()) {
      setError('请先粘贴对方回传的连接码')
      return
    }
    setError('')
    setLoading(true)

    try {
      await sync.acceptAnswer(remoteSdp.trim())
      setStep('connecting')
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
      setStep('error')
      setLoading(false)
    }
  }, [remoteSdp, sync])

  /* ── 接收方：粘贴 offer → 生成 answer ── */
  const handleAcceptOffer = useCallback(async () => {
    if (!remoteSdp.trim()) {
      setError('请先粘贴对方的连接码')
      return
    }
    if (!roomKey.trim()) {
      setError('请先输入房间码')
      return
    }
    setError('')
    setRole('answerer')
    setLoading(true)

    // 先确保 doc 存在
    ensureDoc()

    try {
      const answerSdp = await sync.acceptOffer(remoteSdp.trim())
      setLocalSdp(answerSdp)
      setStep('connecting')
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受连接失败')
      setStep('error')
      setLoading(false)
    }
  }, [remoteSdp, roomKey, sync])

  /* ── 渲染 ── */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          {role === 'offerer' ? '正在生成连接码...' : '正在生成回传码...'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 返回按钮 */}
      <button onClick={onBack} className="btn-icon">
        <ArrowLeft size={20} />
      </button>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wifi size={18} className="text-[var(--accent)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">离线直连</h3>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          零服务器 · 同 WiFi 直连 · 微信复制粘贴两段文字即连
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* SDP 长度警告（可能被微信截断） */}
      {(step === 'offer-ready' || step === 'answer-input') && remoteSdp.trim().length > 0 && remoteSdp.trim().length < 100 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
          <AlertCircle size={16} />
          <span>连接码过短，可能复制不完整（被微信截断），请让对方重新发送</span>
        </div>
      )}

      {/* 房间码 — 非 init 步骤时始终显示，方便验证和修改 */}
      {step !== 'init' && (
        <div>
          <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1">
            房间码
          </label>
          <input
            type="text"
            value={roomKey}
            onChange={(e) => setRoomKey(e.target.value.toUpperCase())}
            maxLength={10}
            className="w-full px-3 py-2 text-center text-sm tracking-[0.3em] font-mono
                       bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                       text-[var(--text-primary)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      )}

      {/* Step: 输入房间码 + 选择角色 */}
      {step === 'init' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              房间码（双方一致即可）
            </label>
            <input
              type="text"
              value={roomKey}
              onChange={(e) => setRoomKey(e.target.value.toUpperCase())}
              placeholder={presetKey || "例如：COFFEE"}
              maxLength={10}
              className="w-full px-4 py-2.5 text-center text-lg tracking-[0.3em] font-mono
                         bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                         text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            {presetKey && (
              <p className="text-xs text-[var(--accent)] mt-1 text-center">房间码已预填，可手动修改</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={!roomKey.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                         bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Link size={16} />
              发起连接
            </button>
            <button
              onClick={() => setStep('answer-input')}
              disabled={!roomKey.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                         bg-[var(--bg-tertiary)] text-[var(--text-primary)]
                         hover:bg-[var(--border)] disabled:opacity-40
                         disabled:cursor-not-allowed transition-all"
            >
              <ArrowRightLeft size={16} />
              接受连接
            </button>
          </div>
        </div>
      )}

      {/* 发起方：Offer 已生成 */}
      {step === 'offer-ready' && (
        <div className="space-y-4">
          <StepLabel num={1} text="复制这段连接码，微信发给对方" />
          <CopyBox text={localSdp} copied={copiedOffer} onCopy={() => setCopiedOffer(true)} />

          <StepLabel num={2} text="粘贴对方回传的连接码" />
          <textarea
            value={remoteSdp}
            onChange={(e) => setRemoteSdp(e.target.value)}
            placeholder="在这里粘贴..."
            className="w-full h-20 px-3 py-2 text-xs font-mono
                       bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                       text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />

          <button
            onClick={handleAcceptAnswer}
            disabled={!remoteSdp.trim()}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white
                       hover:bg-[var(--accent-hover)] disabled:opacity-40
                       disabled:cursor-not-allowed transition-all"
          >
            完成连接
          </button>
        </div>
      )}

      {/* 等待 DataChannel 连接 */}
      {step === 'connecting' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--text-secondary)]">正在建立 P2P 连接...</p>
          <p className="text-xs text-[var(--text-tertiary)]">请稍候，正在直连对方设备</p>
        </div>
      )}

      {/* 发起方：连接完成 */}
      {step === 'offer-done' && <ConnectedMessage />}

      {/* 接收方：粘贴 Offer */}
      {step === 'answer-input' && (
        <div className="space-y-4">
          <StepLabel num={1} text="粘贴对方发来的连接码" />
          <textarea
            value={remoteSdp}
            onChange={(e) => setRemoteSdp(e.target.value)}
            placeholder="在这里粘贴..."
            className="w-full h-24 px-3 py-2 text-xs font-mono
                       bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                       text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />

          <button
            onClick={handleAcceptOffer}
            disabled={!remoteSdp.trim()}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white
                       hover:bg-[var(--accent-hover)] disabled:opacity-40
                       disabled:cursor-not-allowed transition-all"
          >
            接受连接
          </button>
        </div>
      )}

      {/* 接收方：Answer 已生成（connecting 状态下也显示，方便复制后发送） */}
      {(step === 'answer-ready' || (step === 'connecting' && role === 'answerer' && localSdp)) && (
        <div className="space-y-4">
          <StepLabel num={1} text="复制这段回传码，微信发给对方" />
          <CopyBox text={localSdp} copied={copiedAnswer} onCopy={() => setCopiedAnswer(true)} />
          {step === 'connecting' ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
              <p className="text-xs text-[var(--text-tertiary)]">等待对方粘贴你的回传码，连接即建立</p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-tertiary)] text-center">
              等待对方粘贴你的回传码后，连接即建立
            </p>
          )}
        </div>
      )}

      {/* 接收方：连接完成 */}
      {step === 'answer-done' && <ConnectedMessage />}
    </div>
  )
}

/* ═══════════════════════════════════════════
   子组件
   ═══════════════════════════════════════════ */

function StepLabel({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center justify-center w-5 h-5 rounded-full
                       bg-[var(--accent)] text-white text-[11px] font-semibold">
        {num}
      </span>
      <span className="text-sm text-[var(--text-secondary)]">{text}</span>
    </div>
  )
}

function CopyBox({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: () => void }) {
  const handleCopy = async () => {
    const ok = await copyToClipboard(text)
    if (ok) onCopy()
  }

  return (
    <div className="relative">
      <div className="w-full px-3 py-2.5 text-xs font-mono leading-relaxed
                      bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                      text-[var(--text-tertiary)] break-all max-h-24 overflow-y-auto
                      select-all">
        {text}
      </div>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1
                   bg-[var(--accent)] text-white text-xs rounded-md
                   hover:bg-[var(--accent-hover)] transition-all"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
    </div>
  )
}

function ConnectedMessage() {
  return (
    <div className="text-center space-y-2 py-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
        <Check size={24} className="text-[var(--success)]" />
      </div>
      <p className="text-lg font-medium text-[var(--text-primary)]">连接成功！</p>
      <p className="text-sm text-[var(--text-secondary)]">正在进入笔记本...</p>
    </div>
  )
}
