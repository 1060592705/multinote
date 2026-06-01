import { useNotebookStore } from '../../state/notebook'
import { useUIStore } from '../../state/ui'
import { PAGE_WIDTH, PANE_GAP } from '../../constants'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PageCanvas from '../canvas/PageCanvas'
import PageHeader from '../canvas/PageHeader'

type Props = {
  isDual: boolean
  /** 屏幕是否够宽（用于显示折叠按钮，不受面板展开/折叠影响） */
  screenWide: boolean
}

export default function DualPane({ isDual, screenWide }: Props) {
  const myNotebook = useNotebookStore((s) => s.myNotebook)
  const friendNotebook = useNotebookStore((s) => s.friendNotebook)
  const peerStatus = useNotebookStore((s) => s.peerStatus)
  const showFriendDoodles = useNotebookStore((s) => s.showFriendDoodles)
  const goToMyPage = useNotebookStore((s) => s.goToMyPage)
  const viewFriendPage = useNotebookStore((s) => s.viewFriendPage)
  const selectBlock = useUIStore((s) => s.selectBlock)
  const friendPanelOpen = useUIStore((s) => s.friendPanelOpen)
  const toggleFriendPanel = useUIStore((s) => s.toggleFriendPanel)

  const myPage = myNotebook.pages[myNotebook.currentPageIndex]
  const friendPage = friendNotebook?.pages[friendNotebook.currentPageIndex]

  const handleMyPrev = () => goToMyPage(myNotebook.currentPageIndex - 1)
  const handleMyNext = () => goToMyPage(myNotebook.currentPageIndex + 1)

  const handleFriendPrev = () => {
    if (friendNotebook) viewFriendPage(friendNotebook.currentPageIndex - 1)
  }
  const handleFriendNext = () => {
    if (friendNotebook) viewFriendPage(friendNotebook.currentPageIndex + 1)
  }

  const showFriendPanel = isDual && friendPanelOpen

  return (
    <div className="flex items-stretch">
      {/* ── 左栏：朋友的当前页 ── */}
      <div
        className="shrink-0 flex flex-col rounded-lg overflow-hidden transition-all duration-300"
        style={{
          width: showFriendPanel ? PAGE_WIDTH : 0,
          opacity: showFriendPanel ? 1 : 0,
          boxShadow: showFriendPanel ? '0 4px 24px rgba(0,0,0,0.06)' : 'none',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {showFriendPanel && (
          <>
            <PageHeader
              pageNumber={friendNotebook ? (friendNotebook.currentPageIndex + 1) : 1}
              totalPages={friendNotebook?.pages.length || 1}
              label={friendNotebook?.name || '朋友的笔记本'}
              peerOnline={peerStatus?.isOnline}
              peerPage={peerStatus?.currentPageIndex}
              onPrev={handleFriendPrev}
              onNext={handleFriendNext}
            />

            {friendPage ? (
              <PageCanvas
                page={friendPage}
                pageIndex={friendNotebook!.currentPageIndex}
                targetNotebook="friend"
                showDoodles={showFriendDoodles}
                isDoodleMode={true}
                readOnly={true}
                onBlockSelect={(id) => selectBlock(id)}
              />
            ) : (
              <div
                className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] min-h-[400px] select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                <div className="text-center">
                  <p className="text-lg mb-2">📔</p>
                  <p className="text-sm">等待朋友分享笔记本...</p>
                  <p className="text-xs mt-1">朋友加入房间后将自动显示</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 折叠按钮（独占一列，屏幕够宽时始终可见） ── */}
      {screenWide && (
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: PANE_GAP }}
        >
          <button
            onClick={toggleFriendPanel}
            className="w-5 h-12 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--border)]
                       text-[var(--text-tertiary)] hover:text-[var(--text-primary)]
                       flex items-center justify-center transition-all duration-200
                       border border-[var(--border-light)] shadow-sm z-10"
            title={friendPanelOpen ? '折叠朋友面板' : '展开朋友面板'}
          >
            {friendPanelOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
      )}

      {/* ── 右栏：我的当前页 ── */}
      <div
        className="shrink-0 flex flex-col rounded-lg overflow-hidden transition-all duration-300"
        style={{
          width: PAGE_WIDTH,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <PageHeader
          pageNumber={myPage ? myNotebook.currentPageIndex + 1 : 1}
          totalPages={myNotebook.pages.length}
          label="我的笔记本"
          onPrev={handleMyPrev}
          onNext={handleMyNext}
        />

        {myPage ? (
          <PageCanvas
            page={myPage}
            pageIndex={myNotebook.currentPageIndex}
            targetNotebook="my"
            showDoodles={showFriendDoodles}
            isDoodleMode={false}
            readOnly={false}
            onBlockSelect={(id) => selectBlock(id)}
          />
        ) : (
          <div
            className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] min-h-[400px] select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <p className="text-sm">没有页面</p>
          </div>
        )}
      </div>
    </div>
  )
}
