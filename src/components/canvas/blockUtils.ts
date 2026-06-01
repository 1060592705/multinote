/**
 * Block 工具函数
 */

import type { Block } from '../../types'

/** 根据类型创建一个空 Block（尚未插入页面） */
export function createEmptyBlock(type: Block['type']): Block {
  const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const base = {
    id,
    type,
    handwriting: null,
    position: 0,
    style: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  switch (type) {
    case 'paragraph':
      return { ...base, content: { type: 'paragraph' as const, text: '' } }
    case 'h1':
      return { ...base, content: { type: 'heading' as const, level: 1 as const, text: '' } }
    case 'h2':
      return { ...base, content: { type: 'heading' as const, level: 2 as const, text: '' } }
    case 'h3':
      return { ...base, content: { type: 'heading' as const, level: 3 as const, text: '' } }
    case 'todo':
      return { ...base, content: { type: 'todo' as const, text: '', checked: false } }
    case 'image':
      return { ...base, content: { type: 'image' as const, src: '', alt: '', width: 0, height: 0 } }
    default:
      return { ...base, content: { type: 'paragraph' as const, text: '' } }
  }
}
