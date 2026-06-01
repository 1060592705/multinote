/**
 * 手动信令 WebRTC Provider — Yjs 自定义 Provider
 *
 * 替代 y-webrtc 的公共信令服务器，用户通过复制粘贴 SDP 文本交换连接信息。
 * 同 WiFi 下 mDNS 局域网直连，零外部服务器依赖。
 *
 * 参考: maiermic/serverless-webrtc, cjb/serverless-webrtc
 */

import * as Y from 'yjs'
import { Observable } from 'lib0/observable'
import { ICE_SERVERS } from './constants'

/* ═══════════════════════════════════════════
   常量
   ═══════════════════════════════════════════ */

/** 等待 ICE 候选收集完成的最大时间（ms） */
const ICE_GATHER_TIMEOUT = 8000

/* ═══════════════════════════════════════════
   连接 ID 生成
   ═══════════════════════════════════════════ */

let _connectionIdCounter = 0
function generateConnectionId(): string {
  return `conn-${++_connectionIdCounter}-${Math.random().toString(36).slice(2, 6)}`
}

let _providerIdCounter = 0

/* ═══════════════════════════════════════════
   SDP 序列化 & 压缩
   ═══════════════════════════════════════════ */

interface PackedSdp {
  type: 'offer' | 'answer'
  sdp: string
  connId: string
  roomKey: string
}

/** SDP 瘦身：仅保留 data channel 相关行，去掉音视频 codec/RTP/RTCP 等冗余行 */
function stripSdp(sdp: string): string {
  const ignorePatterns = [
    /^a=extmap:/,         // RTP 头部扩展
    /^a=rtcp-fb:/,        // RTCP 反馈
    /^a=rtpmap:/,         // RTP codec 映射
    /^a=fmtp:/,           // 格式参数
    /^a=rtcp-mux/,        // RTCP 复用
    /^a=rtcp-rsize/,      // RTCP 缩小尺寸
    /^a=ssrc:/,           // 同步源标识
    /^a=ssrc-group:/,     // 同步源组
    /^a=msid-semantic:/,  // 媒体流语义
    /^a=max-message-size:/, // 最大消息尺寸（非关键）
  ]
  const lines = sdp.split('\r\n').filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return !ignorePatterns.some((p) => p.test(trimmed))
  })
  return lines.join('\r\n') + '\r\n'
}

/** Uint8Array → base64（分块避免栈溢出） */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 4096
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.slice(i, i + CHUNK))
  }
  return btoa(binary)
}

/** base64 → Uint8Array */
function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 打包 + 压缩：SDP → 去冗余行 → JSON → gzip → base64（前缀 c! 标识压缩格式） */
async function packSdpCompressed(
  desc: RTCSessionDescriptionInit,
  connId: string,
  roomKey: string,
): Promise<string> {
  const payload: PackedSdp = {
    type: desc.type as 'offer' | 'answer',
    sdp: stripSdp(desc.sdp!),
    connId,
    roomKey,
  }
  const json = JSON.stringify(payload)
  const compressed = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer()
  return 'c!' + uint8ToBase64(new Uint8Array(compressed))
}

/**
 * 解包（兼容新旧格式）
 * - `c!` 前缀 → 压缩格式：base64 → gzip 解压 → JSON
 * - 其他 → 旧格式（未压缩 base64 JSON）
 */
async function unpackSdp(packed: string): Promise<PackedSdp | null> {
  const text = packed.trim()

  // 压缩格式（c! 前缀）
  if (text.startsWith('c!')) {
    try {
      const bytes = base64ToUint8(text.slice(2))
      const decompressed = await new Response(
        new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
      ).text()
      const obj = JSON.parse(decompressed)
      if (!obj.type || !obj.sdp || !obj.connId || !obj.roomKey) return null
      if (obj.type !== 'offer' && obj.type !== 'answer') return null
      return obj as PackedSdp
    } catch {
      return null
    }
  }

  // 兼容旧格式（未压缩 base64 JSON）
  try {
    const obj = JSON.parse(atob(text))
    if (!obj.type || !obj.sdp || !obj.connId || !obj.roomKey) return null
    if (obj.type !== 'offer' && obj.type !== 'answer') return null
    return obj as PackedSdp
  } catch {
    return null
  }
}

/* ═══════════════════════════════════════════
   ManualSignalingProvider
   ═══════════════════════════════════════════ */

export type ConnectionRole = 'offerer' | 'answerer' | null

/** ICE 候选收集诊断信息 */
export interface IceStats {
  candidates: number
  host: number
  srflx: number
  relay: number
  gatheringComplete: boolean
  durationMs: number
}

export interface ConnectionState {
  status: 'idle' | 'gathering' | 'ready' | 'connecting' | 'connected' | 'disconnected' | 'error'
  role: ConnectionRole
  localSdp: string | null       // 打包后的本地 SDP，供复制
  error: string | null
  iceStats: IceStats | null     // ICE 候选收集诊断
}

/**
 * 手动信令 Yjs Provider
 *
 * 用法:
 *   1. 双方创建 ManualSignalingProvider(doc, roomKey)
 *   2. A 调用 createOffer() → 获得 SDP 文本 → 复制发给 B
 *   3. B 调用 acceptOffer(sdpText) → 获得 answer SDP 文本 → 复制发给 A
 *   4. A 调用 acceptAnswer(sdpText) → 连接建立
 *   5. Yjs 自动通过 DataChannel 同步
 */
export class ManualSignalingProvider extends Observable<string> {
  /* ── 公共只读状态 ── */
  readonly doc: Y.Doc
  readonly roomKey: string
  readonly connId: string

  private _state: ConnectionState = {
    status: 'idle',
    role: null,
    localSdp: null,
    error: null,
    iceStats: null,
  }

  get state(): Readonly<ConnectionState> {
    return this._state
  }

  /* ── WebRTC 内部状态 ── */
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private _synced: boolean = false
  private _disposed: boolean = false
  private _creatingOffer: boolean = false
  private _providerId: number
  private _offerSeq: number = 0

  /** ICE 收集诊断 */
  private _iceCandidates: { type: string; address: string }[] = []
  private _iceStartTime: number = 0

  /** ICE 收集超时定时器 */
  private _iceTimer: ReturnType<typeof setTimeout> | null = null

  get synced(): boolean {
    return this._synced
  }

  /* ── 构造函数 ── */

  constructor(doc: Y.Doc, roomKey: string) {
    super()
    this.doc = doc
    this.roomKey = roomKey
    this.connId = generateConnectionId()
    this._providerId = ++_providerIdCounter
    console.log(`[MS] Provider #${this._providerId} created | room=${roomKey}`)
  }

  /* ═══════════════════════════════════════════
     公开 API
     ═══════════════════════════════════════════ */

  /** 更新状态并通知观察者 */
  private setState(patch: Partial<ConnectionState>) {
    this._state = { ...this._state, ...patch }
    this.emit('state', [this._state])
  }

  /**
   * 创建 Offer（发起方调用）
   * 返回打包后的 SDP 文本，调用方显示给用户复制
   */
  async createOffer(): Promise<string> {
    if (this._disposed) throw new Error('Provider disposed')
    if (this._creatingOffer) throw new Error('正在创建连接，请稍候...')
    this._creatingOffer = true
    this._offerSeq++
    this.setState({ role: 'offerer', status: 'gathering' })

    const pc = this.createPeerConnection()

    try {
      // 创建数据通道（发起方）
      this.dc = pc.createDataChannel('yjs-sync', {
        ordered: true,
      })
      this.setupDataChannel(this.dc)

      // 创建 Offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 等待 ICE 候选收集完成
      const packed = await this.waitForIceComplete(pc)
      this.setState({ status: 'ready', localSdp: packed })
      return packed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[MS] createOffer failed:', msg)
      this.setState({ status: 'error', error: msg })
      throw err
    } finally {
      this._creatingOffer = false
    }
  }

  /**
   * 接受 Offer（接收方调用）
   * 传入对方复制的 SDP 文本，返回 answer SDP 文本
   */
  async acceptOffer(packedSdp: string): Promise<string> {
    if (this._disposed) throw new Error('Provider disposed')
    if (this._creatingOffer) throw new Error('正在处理连接，请稍候...')
    this._creatingOffer = true

    const unpacked = await unpackSdp(packedSdp)
    if (!unpacked) throw new Error('无效的连接码')
    if (unpacked.type !== 'offer') throw new Error('需要 offer 类型的连接码')
    if (unpacked.roomKey !== this.roomKey) throw new Error('房间码不匹配')

    this.setState({ role: 'answerer', status: 'connecting' })

    const pc = this.createPeerConnection()

    try {
      // 先注册 ondatachannel（必须在 setRemoteDescription 之前，否则可能错过事件）
      pc.ondatachannel = (event) => {
        this.dc = event.channel
        this.setupDataChannel(this.dc)
      }

      // 设置远程 Offer（触发 ICE 连接建立）
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: unpacked.sdp }),
      )

      // 创建 Answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // 等待 ICE 候选收集完成
      const packed = await this.waitForIceComplete(pc)
      this.setState({ status: 'ready', localSdp: packed })
      return packed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.setState({ status: 'error', error: msg })
      throw err
    } finally {
      this._creatingOffer = false
    }
  }

  /**
   * 接受 Answer（发起方调用）
   * 传入对方回传的 answer SDP 文本，完成连接
   */
  async acceptAnswer(packedSdp: string): Promise<void> {
    if (this._disposed) throw new Error('Provider disposed')
    if (!this.pc) throw new Error('尚未创建连接，请先调用 createOffer()')

    const sigState = this.pc.signalingState
    const hasRemote = !!this.pc.remoteDescription

    // 幂等处理：如果已接受过 answer（pc 已是 stable 且有 remote description），直接返回
    if (sigState === 'stable' && hasRemote) {
      return
    }

    // 状态守卫：pc 必须处于 have-local-offer
    if (sigState !== 'have-local-offer') {
      throw new Error(
        `连接状态异常 (${sigState})，请点击"发起连接"重新生成连接码`
      )
    }

    const unpacked = await unpackSdp(packedSdp)
    if (!unpacked) throw new Error('无效的连接码')
    if (unpacked.type !== 'answer') throw new Error('需要 answer 类型的连接码')
    if (unpacked.roomKey !== this.roomKey) throw new Error('房间码不匹配')

    this.setState({ status: 'connecting' })

    try {
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: unpacked.sdp }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.setState({ status: 'error', error: msg })
      throw err
    }
  }

  /** 断开连接并清理资源 */
  destroy(): void {
    this._disposed = true
    this._synced = false

    if (this._iceTimer) {
      clearTimeout(this._iceTimer)
      this._iceTimer = null
    }

    if (this.dc) {
      this.dc.close()
      this.dc = null
    }

    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    this.setState({ status: 'disconnected', localSdp: null })
    // 调用 Observable 父类的 destroy 清理事件监听
    super.destroy?.()
  }

  /* ═══════════════════════════════════════════
     内部方法
     ═══════════════════════════════════════════ */

  /** 创建 RTCPeerConnection，配置 STUN 服务器辅助 NAT 穿透 */
  private createPeerConnection(): RTCPeerConnection {
    // 清理旧连接
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    // 清理旧的 ICE 定时器（重试场景）
    if (this._iceTimer) {
      clearTimeout(this._iceTimer)
      this._iceTimer = null
    }

    // 重置 ICE 诊断
    this._iceCandidates = []
    this._iceStartTime = Date.now()

    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    })

    // 收集 ICE 候选诊断信息
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate
        this._iceCandidates.push({
          type: candidate.type || 'unknown',
          address: candidate.address || '(hidden)',
        })
        // 实时更新 ICE 统计
        this.setState({ iceStats: this._buildIceStats() })
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return
      const iceState = this.pc.iceConnectionState
      if (iceState === 'checking' || iceState === 'connected' || iceState === 'completed') {
        // ICE 有进展，更新统计
        this.setState({ iceStats: this._buildIceStats() })
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return
      const state = this.pc.connectionState
      if (state === 'connected') {
        this.setState({ status: 'connected', iceStats: this._buildIceStats() })
        this.emit('connect', [])
      } else if (state === 'disconnected' || state === 'failed') {
        const iceStats = this._buildIceStats()
        console.warn(`[MS] Connection ${state} | ice=${this.pc?.iceConnectionState} | candidates=${iceStats.host}h/${iceStats.srflx}s/${iceStats.relay}r`)
        this.setState({ status: 'disconnected', iceStats })
        this._synced = false
        this.emit('disconnect', [])
        // 连接彻底失败时发出专门事件，携带诊断信息
        if (state === 'failed') {
          this.emit('connection-failed', [iceStats])
        }
      }
    }

    return this.pc
  }

  /** 构建当前 ICE 统计 */
  private _buildIceStats(): IceStats {
    const host = this._iceCandidates.filter((c) => c.type === 'host').length
    const srflx = this._iceCandidates.filter((c) => c.type === 'srflx').length
    const relay = this._iceCandidates.filter((c) => c.type === 'relay').length
    return {
      candidates: this._iceCandidates.length,
      host,
      srflx,
      relay,
      gatheringComplete: this.pc?.iceGatheringState === 'complete',
      durationMs: Date.now() - this._iceStartTime,
    }
  }

  /** 设置数据通道的事件处理 */
  private setupDataChannel(channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer'

    channel.onopen = () => {
      console.log('[ManualSignaling] DataChannel opened')
      this._synced = true
      this.syncStep1() // 发送初始状态
      this.emit('synced', [{ synced: true }])
    }

    channel.onclose = () => {
      console.log('[ManualSignaling] DataChannel closed')
      this._synced = false
    }

    channel.onmessage = (event) => {
      // 接收 Yjs 更新
      // origin=this → attachDocSync 过滤掉远程回传的更新，避免回声循环
      if (event.data instanceof ArrayBuffer) {
        const update = new Uint8Array(event.data)
        Y.applyUpdate(this.doc, update, this)
      }
    }

    channel.onerror = (event) => {
      console.error('[ManualSignaling] DataChannel error:', event)
    }
  }

  /** 同步步骤1：发送完整文档状态 */
  private syncStep1(): void {
    if (!this.dc || this.dc.readyState !== 'open') return
    const stateUpdate = Y.encodeStateAsUpdate(this.doc)
    this.dc.send(stateUpdate.buffer)
  }

  /** 同步步骤2：发送增量更新（在 doc.on('update') 中触发） */
  private syncStep2(update: Uint8Array, _origin: unknown): void {
    if (!this.dc || this.dc.readyState !== 'open') return
    // 不发送本地产生的更新回自己（避免循环）
    // y-webrtc 通过 origin 参数区分本地/远程更新
    this.dc.send(update.buffer)
  }

  /** 等待 ICE 候选收集完成，返回压缩打包后的 SDP */
  private waitForIceComplete(pc: RTCPeerConnection): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false

      const packNow = async () => {
        if (settled) return
        settled = true
        if (this._iceTimer) { clearTimeout(this._iceTimer); this._iceTimer = null }
        if (!pc.localDescription || !pc.localDescription.sdp) {
          reject(new Error('本地 SDP 为空'))
          return
        }
        try {
          const packed = await packSdpCompressed(pc.localDescription, this.connId, this.roomKey)
          resolve(packed)
        } catch (err) {
          reject(err)
        }
      }

      // 某些浏览器同步完成 ICE 收集
      if (pc.iceGatheringState === 'complete') {
        packNow()
        return
      }

      // 监听 ICE 候选：event.candidate === null 表示收集完成
      const origHandler = pc.onicecandidate
      pc.onicecandidate = (event) => {
        origHandler?.call(pc, event)
        if (event.candidate === null) {
          packNow()
        }
      }

      // 超时兜底（移动端 ICE 可能较慢，给 10 秒）
      this._iceTimer = setTimeout(() => {
        if (!settled) {
          console.warn('[ManualSignaling] ICE gathering timeout, using current SDP')
          packNow()
        }
      }, ICE_GATHER_TIMEOUT)
    })
  }
}

/* ═══════════════════════════════════════════
   Hook 辅助
   ═══════════════════════════════════════════ */

/** 挂载 Yjs doc 的 update 监听——当有远程连接时，远程更新通过 DC 发送，本地更新通过 doc.on('update') 发送 */
export function attachDocSync(provider: ManualSignalingProvider): () => void {
  const handler = (update: Uint8Array, origin: unknown) => {
    // 只发送本地产生的更新（origin 为 null 或本地操作）
    // ManualSignalingProvider 内部方法产生的更新 origin 为 provider 自身
    if (origin === provider) return
    if (!provider.synced) return
    provider['syncStep2'](update, origin)
  }

  provider.doc.on('update', handler)

  return () => {
    provider.doc.off('update', handler)
  }
}
