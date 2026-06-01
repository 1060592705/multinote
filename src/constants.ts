/**
 * 全局常量定义
 */

/* ── 画布 ── */
export const PAGE_WIDTH = 720        // B5 逻辑宽度 @1x (px)
export const PAGE_PX = 40           // 页面水平内边距
export const PAGE_PY = 48           // 页面垂直内边距
export const PAGE_MIN_HEIGHT = 500  // 空页面最小高度
export const PANE_GAP = 24          // 双页缝隙宽度

/* ── 布局 ── */
export const SIDEBAR_WIDTH = 280
export const SIDEBAR_COLLAPSED_WIDTH = 48
export const TOOLBAR_HEIGHT = 48
export const MOBILE_NAV_HEIGHT = 56

/* ── 笔刷 ── */
export const DEFAULT_BRUSH_COLOR = '#1A1A1A'
export const DEFAULT_BRUSH_SIZE = 3
export const MIN_BRUSH_SIZE = 1
export const MAX_BRUSH_SIZE = 20
export const PRESSURE_VARIANCE = 0.6   // 压感对粗细的影响幅度

/* ── 颜色预设 ── */
export const COLOR_PRESETS = [
  '#1A1A1A', // 黑色
  '#666666', // 深灰
  '#999999', // 灰色
  '#A78BFA', // 紫色
  '#EF4444', // 红色
  '#F59E0B', // 橙色
  '#22C55E', // 绿色
  '#3B82F6', // 蓝色
  '#EC4899', // 粉色
  '#8B5CF6', // 深紫
]

/* ── 笔刷类型 ── */
export const BRUSH_TYPES = ['pen', 'ballpoint', 'highlighter', 'eraser'] as const
export type BrushType = typeof BRUSH_TYPES[number]

/* ── 块类型 ── */
export const BLOCK_TYPES = [
  'paragraph',
  'h1',
  'h2',
  'h3',
  'todo',
  'image',
  'quote',
  'divider',
  'table',
  'drawing',
] as const
export type BlockType = typeof BLOCK_TYPES[number]

/* ── 存储 ── */
export const AUTO_SAVE_DELAY = 5000  // 自动保存防抖间隔 (ms)

/* ── 同步 ── */
/** WebRTC 信令服务器（用于 P2P 连接协商） */
export const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com',
]

/** WebRTC ICE 服务器（STUN），用于 NAT 穿透 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:443' },
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.ekiga.net:3478' },
  { urls: 'stun:stun.voipbuster.com:3478' },
]

/** WebRTC P2P 连接超时（毫秒） */
export const CONNECTION_TIMEOUT = 30000
