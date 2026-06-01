/**
 * EmptyPageHint — 空页面提示组件
 *
 * 当页面无任何内容（块/手写/涂鸦）时显示引导提示。
 */

type Props = {
  isDoodleMode: boolean
}

export default function EmptyPageHint({ isDoodleMode }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-[var(--text-tertiary)] select-none">
      {isDoodleMode ? (
        <>
          <p className="text-sm">🎨 涂鸦模式</p>
          <p className="text-xs mt-1">在此页面上自由书写，笔迹将同步给朋友</p>
        </>
      ) : (
        <>
          <p className="text-sm">📄 空白页面</p>
          <p className="text-xs mt-1">使用顶部工具栏添加内容块，或切换到涂鸦模式</p>
        </>
      )}
    </div>
  )
}
