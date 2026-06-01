/**
 * 本地存储模块（IndexedDB via Dexie.js）
 *
 * 提供笔记本数据的本地持久化，支持自动保存和恢复。
 */

import Dexie, { type Table } from 'dexie'
import type { Notebook } from '../types'

/* ── 数据库定义 ── */

class MultiNoteDB extends Dexie {
  notebooks!: Table<{ id: string; data: Notebook; updatedAt: number }>

  constructor() {
    super('multinote')
    this.version(1).stores({
      notebooks: '&id, updatedAt',
    })
  }
}

const db = new MultiNoteDB()

/* ── 笔记本存储操作 ── */

/** 保存笔记本到本地 */
export async function saveNotebook(notebook: Notebook): Promise<void> {
  await db.notebooks.put({
    id: notebook.id,
    data: notebook,
    updatedAt: Date.now(),
  })
}

/** 从本地加载笔记本 */
export async function loadNotebook(id: string): Promise<Notebook | null> {
  const entry = await db.notebooks.get(id)
  return entry?.data ?? null
}
