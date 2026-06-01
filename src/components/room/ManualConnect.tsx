/**
 * ManualConnect — 局域网直连 UI 组件
 *
 * 通过复制粘贴 SDP 文本建立 WebRTC P2P 连接，
 * 同 WiFi 下 mDNS 局域网直连，零外部服务器。
 */

import { useState, useCallback, useEffect } from 'react'
import * as Y from 'yjs'
import { Copy, Check, Link, Loader2, Wifi, ArrowRightLeft, AlertCircle } from 'lucide-react'
import { useManualSync } from '../../hooks/useManualSync'

/* ── 步骤枚举 ── */

type Step =
  | 'init'          // 输入房间码
  | 'offer-ready'   // 发起方：offer 已生成，等待复制 + 等待 answer
  | 'offer-done'    // 发起方：已完成连接
  | 'answer-input'  // 接收方：等待粘贴 offer
  | 'answer-ready'  // 接收方：answer 已生成，等待复制
  | 'answer-done'   // 接收方：已完成连接
  | 'error'         // 错误

/* ── Props ── */

type Props = {
  /** 连接成功后回调，传入 Y.Doc（用于后续 Yjs 同步） */
  onConnected: (doc: Y.Doc) => void
  /** 返回首页 */
  onBack: () => void
}

/* ── 辅助 ── */

/** 复制文本到剪贴板 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 回退方案
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

export default function ManualConnect({ onConnected, onBack }: Props) {
  /* ── 状态 ── */
  const [roomKey, setRoomKey] = useState('')
  const [role, setRole] = useState<'offerer' | 'answerer' | null>(null)
  const [step, setStep] = useState<Step>('init')
  const [localSdp, setLocalSdp] = useState('')
  const [remoteSdp, setRemoteSdp] = useState('')
  const [copiedOffer, setCopiedOffer] = useState(false)
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /* ── Yjs Doc & Provider ── */
  const [doc, setDoc] = useState<Y.Doc | null>(null)

  // 只在实际需要连接时创建 doc 和 provider
  const sync = useManualSync(doc, roomKey)

  /* ── 创建 Y.Doc ── */
  useEffect(() => {
    if (role) {
      const d = new Y.Doc()
      setDoc(d)
      return () => { d.destroy() }
    }
  }, [role])

  /* ── 监听连接状态 ── */
  useEffect(() => {
    if (sync.synced && doc) {
      setStep(role === 'offerer' ? 'offer-done' : 'answer-done')
      // 延迟回调，让 UI 先显示"已连接"
      const t = setTimeout(() => onConnected(doc), 800)
      return () => clearTimeout(t)
    }
  }, [sync.synced, doc, role, onConnected])

  /* ── 发起方：创建连接 ── */
  const handleCreate = useCallback(async () => {
    if (!roomKey.trim()) {
      setError('请先输入房间码')
      return
    }
    setError('')
    setRole('offerer')
    setLoading(true)

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
      // synced 会通过 useEffect 自动触发 onConnected
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败，请检查粘贴的码是否正确')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }, [remoteSdp, sync])

  /* ── 接收方：粘贴 offer 并生成 answer ── */
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

    try {
      const answerSdp = await sync.acceptOffer(remoteSdp.trim())
      setLocalSdp(answerSdp)
      setStep('answer-ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受连接失败，请检查粘贴的码和房间码')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }, [remoteSdp, roomKey, sync])

  /* ── 渲染 ── */

  // 加载中
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[var(--bg-primary)]">
        <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          {role === 'offerer' ? '正在建立连接...' : '正在处理...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[var(--bg-primary)] p-6">
      <div className="w-full max-w-md">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-light)] mb-4">
            <Wifi size={28} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
            局域网直连
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            零服务器 · 同 WiFi 直连 · 通过微信复制粘贴连接码
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-red-50 text-red-600 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: 输入房间码 */}
        {step === 'init' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                房间码（双方输入一致即可）
              </label>
              <input
                type="text"
                value={roomKey}
                onChange={(e) => setRoomKey(e.target.value.toUpperCase())}
                placeholder="例如：COFFEE"
                maxLength={10}
                className="w-full px-4 py-2.5 text-center text-lg tracking-[0.3em] font-mono
                           bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                           text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1.5 text-center">
                这是防止同一 WiFi 下多组人互相干扰的密码
              </p>
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

        {/* Step: 发起方 — Offer 已生成 */}
        {step === 'offer-ready' && (
          <div className="space-y-4">
            <StepLabel num={1} text="复制这段连接码，发给对方" />
            <CopyBox text={localSdp} copied={copiedOffer} onCopy={() => setCopiedOffer(true)} />

            <StepLabel num={2} text="粘贴对方回传的连接码" />
            <textarea
              value={remoteSdp}
              onChange={(e) => setRemoteSdp(e.target.value)}
              placeholder="在这里粘贴对方回传的码..."
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

        {/* Step: 发起方 — 连接完成 */}
        {step === 'offer-done' && <ConnectedMessage />}

        {/* Step: 接收方 — 粘贴 Offer */}
        {step === 'answer-input' && (
          <div className="space-y-4">
            <StepLabel num={1} text="粘贴对方发来的连接码" />
            <textarea
              value={remoteSdp}
              onChange={(e) => setRemoteSdp(e.target.value)}
              placeholder="在这里粘贴对方发来的码..."
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

        {/* Step: 接收方 — Answer 已生成 */}
        {step === 'answer-ready' && (
          <div className="space-y-4">
            <StepLabel num={2} text="复制这段回传码，发给对方" />
            <CopyBox text={localSdp} copied={copiedAnswer} onCopy={() => setCopiedAnswer(true)} />
            <p className="text-xs text-[var(--text-tertiary)] text-center">
              等待对方粘贴你的回传码后，连接即建立
            </p>
          </div>
        )}

        {/* Step: 接收方 — 连接完成 */}
        {step === 'answer-done' && <ConnectedMessage />}

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
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
