/**
 * ManualConnect — 局域网直连 UI 组件
 *
 * 通过复制粘贴 SDP 文本建立 WebRTC P2P 连接，
 * 同 WiFi 下 mDNS 局域网直连，零外部服务器。
 */

import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from 'react'
import * as Y from 'yjs'
import { Copy, Check, Link, Loader2, Wifi, ArrowRightLeft, AlertCircle, ArrowLeft } from 'lucide-react'
import { useManualSync } from '../../hooks/useManualSync'

/* ── 调试用 — 定位后删除 ── */
class EB extends Component<{ children: ReactNode; name: string }, { err: Error | null }> {
  constructor(props: { children: ReactNode; name: string }) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (this.state.err) return <div className="p-3 rounded bg-red-600 text-white text-xs font-mono whitespace-pre-wrap">[{this.props.name}]\n{this.state.err.message}\n\n{this.state.err.stack?.split('\n').slice(0,10).join('\n')}</div>
    return this.props.children
  }
}

/* ── 步骤枚举 ── */

type Step =
  | 'init'          // 输入房间码
  | 'offer-ready'   // 发起方：offer 已生成
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
  /** 预设房间码 */
  presetKey?: string
  /** 预选角色（跳过角色选择），'answerer' 会直接进入粘贴 offer 步骤 */
  defaultRole?: 'offerer' | 'answerer'
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

export default function ManualConnect({ onConnected, onBack, presetKey, defaultRole }: Props) {
  /* ── 状态 ── */
  const [roomKey, setRoomKey] = useState(presetKey || '')
  const [role, setRole] = useState<'offerer' | 'answerer' | null>(null)
  const [step, setStep] = useState<Step>('init')
  const [localSdp, setLocalSdp] = useState('')
  const [remoteSdp, setRemoteSdp] = useState('')
  const [copiedOffer, setCopiedOffer] = useState(false)
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /* ── 同步锁：ref 立即生效，防止 tap/click 事件竞态绕过 loading state ── */
  const lockRef = useRef(false)

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
  useEffect(() => {
    if (sync.synced && doc) {
      setStep(role === 'offerer' ? 'offer-done' : 'answer-done')
      const t = setTimeout(() => onConnected(doc), 800)
      return () => clearTimeout(t)
    }
  }, [sync.synced, doc, role, onConnected])

  /* ── defaultRole：预选角色 ── */
  useEffect(() => {
    if (defaultRole === 'answerer' && step === 'init' && roomKey.trim()) {
      setRole('answerer')
      setStep('answer-input')
    }
  }, [defaultRole, step, roomKey])

  /* ── 发起方：创建连接 ── */
  const handleCreate = useCallback(async () => {
    if (loading || lockRef.current) return
    lockRef.current = true
    if (!roomKey.trim()) {
      setError('请先输入房间码')
      lockRef.current = false
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
      lockRef.current = false
    }
  }, [roomKey, sync, loading])

  /* ── 恢复：连接状态异常时重新生成 offer ── */
  const handleRetry = useCallback(async () => {
    if (loading || lockRef.current) return
    lockRef.current = true
    setError('')
    setLoading(true)

    try {
      const sdp = await sync.createOffer()
      setLocalSdp(sdp)
      setRemoteSdp('') // 清空旧 answer
      setStep('offer-ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新发起失败')
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }, [sync, loading])

  /* ── 发起方：粘贴 answer 完成连接 ── */
  const handleAcceptAnswer = useCallback(async () => {
    if (loading || lockRef.current) return
    lockRef.current = true
    if (!remoteSdp.trim()) {
      setError('请先粘贴对方回传的连接码')
      lockRef.current = false
      return
    }
    setError('')
    setLoading(true)
    ensureDoc()

    try {
      await sync.acceptAnswer(remoteSdp.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
      setStep('error')
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }, [remoteSdp, sync, loading])

  /* ── 接收方：粘贴 offer → 生成 answer ── */
  const handleAcceptOffer = useCallback(async () => {
    if (loading || lockRef.current) return
    lockRef.current = true
    if (!remoteSdp.trim()) {
      setError('请先粘贴对方的连接码')
      lockRef.current = false
      return
    }
    if (!roomKey.trim()) {
      setError('请先输入房间码')
      lockRef.current = false
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
      setStep('answer-ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受连接失败')
      setStep('error')
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }, [remoteSdp, roomKey, sync, loading])

  /* ── 渲染 ── */

  if (loading) {
    return (
      <EB name="ManualConnect(loading)">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            {role === 'offerer' ? '正在建立连接...' : '正在处理...'}
          </p>
        </div>
      </EB>
    )
  }

  return (
    <EB name="ManualConnect(main)">
    <div className="space-y-5">
      {/* 返回按钮 */}
      <button onClick={onBack} className="btn-icon">
        <ArrowLeft size={20} />
      </button>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wifi size={18} className="text-[var(--accent)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">局域网直连</h3>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          零服务器 · 同 WiFi 直连 · 微信复制粘贴两段文字即连
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          {/* 连接状态异常时可一键重新发起 */}
          {error.includes('连接状态异常') && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm
                         hover:bg-[var(--accent-hover)] disabled:opacity-40
                         disabled:cursor-not-allowed transition-all"
            >
              重新发起连接
            </button>
          )}
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
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                         read-only:opacity-60"
            />
            {presetKey && (
              <p className="text-xs text-[var(--accent)] mt-1 text-center">使用房间码作为连接密钥</p>
            )}
          </div>

          <div className="flex gap-3">
            {defaultRole !== 'answerer' && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!roomKey.trim() || loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Link size={16} />
                发起连接
              </button>
            )}
            {defaultRole !== 'offerer' && (
              <button
                onClick={() => setStep('answer-input')}
                disabled={!roomKey.trim() || loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-[var(--bg-tertiary)] text-[var(--text-primary)]
                           hover:bg-[var(--border)] disabled:opacity-40
                           disabled:cursor-not-allowed transition-all"
              >
                <ArrowRightLeft size={16} />
                接受连接
              </button>
            )}
          </div>
        </div>
      )}

      {/* 发起方：Offer 已生成 */}
      {step === 'offer-ready' && (
        <div className="space-y-4">
          <RoomCodeBadge roomKey={roomKey} />
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
            type="button"
            onClick={handleAcceptAnswer}
            disabled={!remoteSdp.trim() || loading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white
                       hover:bg-[var(--accent-hover)] disabled:opacity-40
                       disabled:cursor-not-allowed transition-all"
          >
            完成连接
          </button>
        </div>
      )}

      {/* 发起方：连接完成 */}
      {step === 'offer-done' && <ConnectedMessage />}

      {/* 接收方：粘贴 Offer */}
      {step === 'answer-input' && (
        <div className="space-y-4">
          <RoomCodeBadge roomKey={roomKey} />
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
            type="button"
            onClick={handleAcceptOffer}
            disabled={!remoteSdp.trim() || loading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white
                       hover:bg-[var(--accent-hover)] disabled:opacity-40
                       disabled:cursor-not-allowed transition-all"
          >
            接受连接
          </button>
        </div>
      )}

      {/* 接收方：Answer 已生成 */}
      {step === 'answer-ready' && (
        <div className="space-y-4">
          <RoomCodeBadge roomKey={roomKey} />
          <StepLabel num={2} text="复制这段回传码，微信发给对方" />
          <CopyBox text={localSdp} copied={copiedAnswer} onCopy={() => setCopiedAnswer(true)} />
          <p className="text-xs text-[var(--text-tertiary)] text-center">
            等待对方粘贴你的回传码后，连接即建立
          </p>
        </div>
      )}

      {/* 接收方：连接完成 */}
      {step === 'answer-done' && <ConnectedMessage />}
    </div>
  </EB>
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

function RoomCodeBadge({ roomKey }: { roomKey: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                    bg-[var(--accent)]/10 border border-[var(--accent)]/30">
      <span className="text-xs text-[var(--text-tertiary)]">房间码</span>
      <span className="text-lg font-bold font-mono tracking-[0.2em] text-[var(--accent)]">
        {roomKey}
      </span>
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
