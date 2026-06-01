import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import RoomGate from './components/room/RoomGate'
import Sidebar from './components/layout/Sidebar'
import Toolbar from './components/layout/Toolbar'
import DualPane from './components/layout/DualPane'
import CanvasScaler from './components/layout/CanvasScaler'
import MobileNav from './components/layout/MobileNav'
import { useUIStore } from './store/useUIStore'
import { useYjsSync } from './hooks/useYjsSync'
import { useLanSync } from './hooks/useLanSync'
import { useAutoSave } from './hooks/useAutoSave'
import { useCanvasScale } from './hooks/useCanvasScale'
import { getRoomFromURL, generateUserId } from './lib/room'

export type RoomState = {
  roomCode: string
  userId: string
  isHost: boolean
} | null

/** 局域网直连状态 */
interface LanState {
  doc: Y.Doc
  userId: string
}

export default function App() {
  const [room, setRoom] = useState<RoomState>(null)
  const [lan, setLan] = useState<LanState | null>(null)
  const setDarkMode = useUIStore((s) => s.setDarkMode)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setDarkMode(mq.matches)
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setDarkMode])

  useEffect(() => {
    const urlRoomCode = getRoomFromURL()
    if (urlRoomCode) {
      // URL 带房间码 → 自动加入，跳过首页
      setRoom({
        roomCode: urlRoomCode.toUpperCase(),
        userId: generateUserId(),
        isHost: false,
      })
    }
  }, [])

  /** 局域网直连回调 */
  const handleLanConnect = (doc: Y.Doc, userId: string) => {
    setLan({ doc, userId })
  }

  if (!room && !lan) {
    return <RoomGate onJoin={setRoom} onLanConnect={handleLanConnect} />
  }

  if (lan) {
    return <LanRoomApp lan={lan} />
  }

  return <RoomApp room={room!} />
}

/** WebRTC 模式主界面 */
function RoomApp({ room }: { room: NonNullable<RoomState> }) {
  useYjsSync(room.roomCode, room.userId)
  useAutoSave(room.userId)
  return <RoomUI />
}

/** 局域网直连模式主界面 */
function LanRoomApp({ lan }: { lan: LanState }) {
  const userIdRef = useRef(lan.userId)
  userIdRef.current = lan.userId
  useLanSync(lan.doc, lan.userId, null)
  useAutoSave(lan.userId)
  return <RoomUI />
}

/** 主界面 UI（WebRTC 和 LAN 共用） */
function RoomUI() {
  const {
    scale, userZoom,
    isDual, screenWide, zoomBy, resetZoom, containerRef,
  } = useCanvasScale()

  // 同步 scale 到 UI store，供 usePointerHandler 坐标修正使用
  const setCanvasScale = useUIStore((s) => s.setCanvasScale)
  useEffect(() => {
    setCanvasScale(scale)
  }, [scale, setCanvasScale])

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-secondary)]">
      <Toolbar
        scale={scale}
        userZoom={userZoom}
        onResetZoom={resetZoom}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden sm:block shrink-0">
          <Sidebar />
        </div>
        <CanvasScaler
          scale={scale}
          isDual={isDual}
          containerRef={containerRef}
          onWheelZoom={zoomBy}
        >
          <DualPane isDual={isDual} screenWide={screenWide} />
        </CanvasScaler>
      </div>
      <MobileNav />
    </div>
  )
}
