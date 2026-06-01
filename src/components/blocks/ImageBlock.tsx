import { useRef, useState } from 'react'
import { ImageIcon, Upload, X } from 'lucide-react'
import type { Block, ImageContent } from '../../types'

type Props = {
  block: Block
  isSelected: boolean
  readOnly?: boolean
  onChange: (content: ImageContent) => void
  onSelect: () => void
}

export default function ImageBlock({ block, isSelected, readOnly, onChange, onSelect }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const content = block.content as unknown as ImageContent

  if (readOnly) {
    if (content.src) {
      return (
        <img src={content.src} alt={content.alt || '图片'} className="max-w-full rounded-md" style={{ maxHeight: '400px', objectFit: 'contain' }} />
      )
    }
    return <p className="text-sm text-[var(--text-tertiary)] italic">🖼️ 图片</p>
  }

  const hasImage = content.src && content.src.length > 0

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        onChange({
          type: 'image',
          src: reader.result as string,
          alt: file.name,
          width: img.width,
          height: img.height,
        })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (hasImage) {
    return (
      <div className="relative group" onClick={onSelect}>
        <img
          src={content.src}
          alt={content.alt || '图片'}
          className="max-w-full rounded-md"
          style={{ maxHeight: '400px', objectFit: 'contain' }}
        />
        {isSelected && (
          <button
            onClick={() => onChange({ type: 'image', src: '', alt: '', width: 0, height: 0 })}
            className="absolute top-1 right-1 w-6 h-6 bg-[var(--danger)] text-white
                       rounded-full flex items-center justify-center shadow-md
                       hover:opacity-90 transition-opacity"
          >
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => {
        onSelect()
        fileInputRef.current?.click()
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${isDragging
          ? 'border-[var(--accent)] bg-[var(--accent-light)]'
          : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)]'
        }
        ${isSelected ? 'ring-2 ring-[var(--accent)]' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-2 text-[var(--text-tertiary)]">
        {isDragging ? (
          <>
            <Upload size={24} className="text-[var(--accent)]" />
            <p className="text-sm text-[var(--accent)]">松开以添加图片</p>
          </>
        ) : (
          <>
            <ImageIcon size={24} />
            <p className="text-sm">点击或拖拽添加图片</p>
          </>
        )}
      </div>
    </div>
  )
}
