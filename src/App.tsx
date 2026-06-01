import { useState, useEffect } from 'react'
import RoomGate from './components/room/RoomGate'
import Sidebar from './components/layout/Sidebar'
import Toolbar from './components/layout/Toolbar'
import DualPane from './components/layout/DualPane'
import CanvasScaler from './components/layout/CanvasScaler'
import MobileNav from './components/layout/MobileNav'
import { useUIStore } from './store/useUIStore'
import { useYjsSync } from './hooks/useYjsSync'
import { useAutoSave } from './hooks/useAutoSave'
import { useCanvasScale } from './hooks/useCanvasScale'
import { getRoomFromURL, generateUserId } from './lib/room'

export type RoomState = {
  roomCode: string
  userId: string
  isHost: boolean
} | null

export default function App() {
  const [room, setRoom] = useState<RoomState>(null)
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

  if (!room) {
    return <RoomGate onJoin={setRoom} />
  }

  return <RoomApp room={room} />
}

/** 进入房间后的主界面 */
function RoomApp({ room }: { room: NonNullable<RoomState> }) {
  useYjsSync(room.roomCode, room.userId)
  useAutoSave(room.userId)

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
        {/* 侧边栏：flex 行内推挤画布，transition-all 实现滑动动效 */}
        <div className="hidden sm:block shrink-0">
          <Sidebar />
        </div>
        {/* 画布区域：flex-1 被推挤时自动重计算缩放 */}
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
