/**
 * SDP 编解码工具
 *
 * 用于局域网直连模式中的 SDP 文本压缩与解压。
 * 流程：原始 SDP → 去冗余行 → JSON → gzip → base64 (c! 前缀)
 * 兼容旧格式：直接 base64(JSON)
 */

/* ── 类型 ── */

export interface PackedSdp {
  type: 'offer' | 'answer'
  sdp: string
  connId: string
  roomKey: string
}

/* ── SDP 瘦身 ── */

/** 去掉音视频 codec/RTP/RTCP 等冗余行（data channel 不需要） */
function stripSdp(sdp: string): string {
  const ignorePatterns = [
    /^a=extmp:/,
    /^a=rtcp-fb:/,
    /^a=rtpmap:/,
    /^a=fmtp:/,
    /^a=rtcp-mux/,
    /^a=rtcp-rsize/,
    /^a=ssrc:/,
    /^a=ssrc-group:/,
    /^a=msid-semantic:/,
    /^a=max-message-size:/,
  ]
  const lines = sdp.split('\r\n').filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return !ignorePatterns.some((p) => p.test(trimmed))
  })
  return lines.join('\r\n') + '\r\n'
}

/* ── Base64 编解码（分块避免栈溢出） ── */

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 4096
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.slice(i, i + CHUNK))
  }
  return btoa(binary)
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/* ── 公开 API ── */

/** 打包 + 压缩：SDP → 去冗余 → JSON → gzip → base64（c! 前缀） */
export async function packSdp(desc: RTCSessionDescriptionInit, connId: string, roomKey: string): Promise<string> {
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
 * - `c!` 前缀 → gzip 解压 → JSON
 * - 其他 → 直接 base64 decode → JSON
 */
export async function unpackSdp(packed: string): Promise<PackedSdp | null> {
  const text = packed.trim()

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

  try {
    const obj = JSON.parse(atob(text))
    if (!obj.type || !obj.sdp || !obj.connId || !obj.roomKey) return null
    if (obj.type !== 'offer' && obj.type !== 'answer') return null
    return obj as PackedSdp
  } catch {
    return null
  }
}
