import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('[debug v2] main.tsx loaded, deploying global error fallback')

// ═══════════════════════════════════════════
// WebSocket 信令服务器连接过滤
//
// y-webrtc 的公共信令服务器 (signaling.yjs.dev, *.herokuapp.com)
// 在中国大陆被 GFW 屏蔽，WebSocket 连接会失败并产生大量重复 console 错误。
// 拦截 WebSocket 构造：每个被墙 URL 只让第一次尝试正常失败（浏览器记一条日志），
// 后续同 URL 的重复连接尝试返回哑 WebSocket，不产生额外日志。
// ═══════════════════════════════════════════

const _BlockedWsUrls = new Set<string>()
const _BlockedWsPatterns = [
  'signaling.yjs.dev',
  'y-webrtc-signaling-eu.herokuapp.com',
  'y-webrtc-signaling-us.herokuapp.com',
]

function _isBlockedSignaling(url: string): boolean {
  return _BlockedWsPatterns.some((p) => url.includes(p))
}

const _NativeWebSocket = window.WebSocket

// 哑 WebSocket：立即关闭，不产生网络请求
class _SilentWebSocket extends EventTarget {
  readonly url: string
  readonly readyState: number = 3 // CLOSED
  readonly CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  binaryType: BinaryType = 'blob'
  bufferedAmount: number = 0
  extensions: string = ''
  protocol: string = ''
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onopen: ((ev: Event) => void) | null = null

  constructor(url: string) {
    super()
    this.url = url
    // 异步触发 close 事件（y-webrtc 用 onclose 检测连接失败）
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close', { code: 1006, reason: 'blocked', wasClean: false }))
    }, 0)
  }
  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {}
  close(): void {}
  addEventListener() { return super.addEventListener.apply(this, arguments as any) }
  removeEventListener() { return super.removeEventListener.apply(this, arguments as any) }
  dispatchEvent(event: Event): boolean { return super.dispatchEvent(event) }
}

;(window as any).WebSocket = function WebSocketWrapper(url: string, protocols?: string | string[]) {
  if (_isBlockedSignaling(url)) {
    if (_BlockedWsUrls.has(url)) {
      // 已失败过的 URL → 返回哑 WebSocket，不产生日志
      return new _SilentWebSocket(url)
    }
    // 第一次尝试 → 使用真实 WebSocket（让浏览器记录一次失败）
    _BlockedWsUrls.add(url)
  }
  return new (_NativeWebSocket as any)(url, protocols)
} as any
;(window as any).WebSocket.prototype = _NativeWebSocket.prototype
;(window as any).WebSocket.CONNECTING = 0
;(window as any).WebSocket.OPEN = 1
;(window as any).WebSocket.CLOSING = 2
;(window as any).WebSocket.CLOSED = 3

// 二次保障：补充 React 侧的全局捕获（index.html 的脚本优先）
// 某些 React 18 错误可能不会冒泡到 window.onerror
window.addEventListener('error', (event) => {
  if (event.error) {
    console.error('[fallback] window.error event:', event.error.message)
    console.error('[fallback] stack:', event.error.stack)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[fallback] unhandledrejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
