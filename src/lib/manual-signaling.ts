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

/* ═══════════════════════════════════════════
   常量
   ═══════════════════════════════════════════ */

/** 等待 ICE 候选收集完成的最大时间（ms） */
const ICE_GATHER_TIMEOUT = 5000

/* ═══════════════════════════════════════════
   连接 ID 生成
   ═══════════════════════════════════════════ */

let _connectionIdCounter = 0
function generateConnectionId(): string {
  return `conn-${++_connectionIdCounter}-${Math.random().toString(36).slice(2, 6)}`
}

/* ═══════════════════════════════════════════
   SDP 序列化
   ═══════════════════════════════════════════ */

interface PackedSdp {
  type: 'offer' | 'answer'
  sdp: string
  connId: string
  /** 发起方标识：双方必须有相同的 roomKey 才能连接 */
  roomKey: string
}

/** 将 RTCSessionDescription 打包为可复制的文本 */
function packSdp(
  desc: RTCSessionDescriptionInit,
  connId: string,
  roomKey: string,
): string {
  const payload: PackedSdp = {
    type: desc.type as 'offer' | 'answer',
    sdp: desc.sdp!,
    connId,
    roomKey,
  }
  return btoa(JSON.stringify(payload))
}

/** 从复制文本中解包 SDP */
function unpackSdp(packed: string): PackedSdp | null {
  try {
    const obj = JSON.parse(atob(packed.trim()))
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

export interface ConnectionState {
  status: 'idle' | 'gathering' | 'ready' | 'connecting' | 'connected' | 'disconnected' | 'error'
  role: ConnectionRole
  localSdp: string | null       // 打包后的本地 SDP，供复制
  error: string | null
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
  }

  get state(): Readonly<ConnectionState> {
    return this._state
  }

  /* ── WebRTC 内部状态 ── */
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private _synced: boolean = false
  private _disposed: boolean = false

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
      this.setState({ status: 'error', error: msg })
      throw err
    }
  }

  /**
   * 接受 Offer（接收方调用）
   * 传入对方复制的 SDP 文本，返回 answer SDP 文本
   */
  async acceptOffer(packedSdp: string): Promise<string> {
    if (this._disposed) throw new Error('Provider disposed')

    const unpacked = unpackSdp(packedSdp)
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
    }
  }

  /**
   * 接受 Answer（发起方调用）
   * 传入对方回传的 answer SDP 文本，完成连接
   */
  async acceptAnswer(packedSdp: string): Promise<void> {
    if (this._disposed) throw new Error('Provider disposed')
    if (!this.pc) throw new Error('尚未创建连接，请先调用 createOffer()')

    const unpacked = unpackSdp(packedSdp)
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

  /** 创建 RTCPeerConnection（纯局域网，无 STUN/TURN） */
  private createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      this.pc.close()
    }

    this.pc = new RTCPeerConnection({
      // 不配置 iceServers —— 纯局域网 mDNS 直连，不依赖任何外部服务器
      iceServers: [],
    })

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return
      const state = this.pc.connectionState
      if (state === 'connected') {
        this.setState({ status: 'connected' })
        this.emit('connect', [])
      } else if (state === 'disconnected' || state === 'failed') {
        this.setState({ status: 'disconnected' })
        this._synced = false
        this.emit('disconnect', [])
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      // ICE 连接状态变化时记录，用于调试
      console.log('[ManualSignaling] ICE state:', this.pc?.iceConnectionState)
    }

    return this.pc
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

  /** 等待 ICE 候选收集完成，返回包含完整候选的打包 SDP */
  private waitForIceComplete(pc: RTCPeerConnection): Promise<string> {
    return new Promise((resolve, reject) => {
      const packNow = () => {
        if (!pc.localDescription || !pc.localDescription.sdp) {
          reject(new Error('本地 SDP 为空'))
          return
        }
        resolve(packSdp(pc.localDescription, this.connId, this.roomKey))
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

      // 5 秒超时兜底
      this._iceTimer = setTimeout(() => {
        console.warn('[ManualSignaling] ICE gathering timeout, using current SDP')
        packNow()
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
