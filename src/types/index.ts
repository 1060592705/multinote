/**
 * MultiNote 核心类型定义
 */

import type { BlockType, BrushType } from '../lib/constants'

/* ═══════════════════════════════════════════
   笔记本 & 页面
   ═══════════════════════════════════════════ */

export interface Notebook {
  id: string
  name: string
  ownerId: string
  pages: Page[]
  currentPageIndex: number
  createdAt: number
  updatedAt: number
}

export interface Page {
  id: string
  pageNumber: number
  blocks: Block[]
  /** 朋友的涂鸦层（仅朋友笔记本的页面有） */
  doodleLayers: DoodleLayer[]
  /** 页面级手写笔迹（不绑定块，自由绘制） */
  pageHandwriting: HandwritingData
  /** 页面缩略图（base64 data URL） */
  thumbnail: string | null
  /** 是否显示该页的涂鸦 */
  showDoodles: boolean
  createdAt: number
  updatedAt: number
}

/* ═══════════════════════════════════════════
   内容块
   ═══════════════════════════════════════════ */

export interface Block {
  id: string
  type: BlockType
  content: BlockContent
  /** 绑定在块上的手写笔迹 */
  handwriting: HandwritingData | null
  /** 在页面中的顺序位置（从 0 开始） */
  position: number
  style: BlockStyle
  createdAt: number
  updatedAt: number
}

export type BlockContent =
  | ParagraphContent
  | HeadingContent
  | TodoContent
  | ImageContent

export interface ParagraphContent {
  type: 'paragraph'
  text: string
}

export interface HeadingContent {
  type: 'heading'
  level: 1 | 2 | 3
  text: string
}

export interface TodoContent {
  type: 'todo'
  text: string
  checked: boolean
}

export interface ImageContent {
  type: 'image'
  src: string           // base64 data URL 或 blob URL
  alt: string
  width: number
  height: number
}

export interface BlockStyle {
  /** CSS 颜色值，仅对部分块类型生效 */
  color?: string
  /** CSS 背景色 */
  backgroundColor?: string
}

/* ═══════════════════════════════════════════
   手写笔迹
   ═══════════════════════════════════════════ */

export type HandwritingData = Stroke[]

export interface Stroke {
  id: string
  /** 采样点序列 */
  points: Point[]
  brush: BrushType
  color: string
  size: number
  /** 创建时间戳 */
  timestamp: number
  /** 绘制该笔画的用户 ID */
  authorId: string
}

export interface Point {
  /** 相对于块原点的 x 坐标 */
  x: number
  /** 相对于块原点的 y 坐标 */
  y: number
  /** 压感值 0-1 */
  pressure: number
  /** 采样时间戳 */
  timestamp: number
}

/* ═══════════════════════════════════════════
   涂鸦层
   ═══════════════════════════════════════════ */

export interface DoodleLayer {
  id: string
  /** 涂鸦在哪个页面 */
  pageId: string
  /** 涂鸦在哪个块上（null = 页面空白区域） */
  blockId: string | null
  /** 涂鸦作者 */
  authorId: string
  /** 涂鸦笔迹 */
  strokes: Stroke[]
  createdAt: number
  updatedAt: number
}

/* ═══════════════════════════════════════════
   房间
   ═══════════════════════════════════════════ */

export interface RoomConfig {
  roomCode: string
  userId: string
  isHost: boolean
}

export type RoomState = RoomConfig | null

/* ═══════════════════════════════════════════
   协作
   ═══════════════════════════════════════════ */

export interface PeerStatus {
  userId: string
  isOnline: boolean
  /** 对方当前所在的页码 */
  currentPageIndex: number
  /** 对方当前模式：浏览 or 涂鸦 */
  mode: 'browse' | 'doodle'
}
