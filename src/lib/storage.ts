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
  settings!: Table<{ key: string; value: unknown }>

  constructor() {
    super('multinote')

    this.version(1).stores({
      notebooks: '&id, updatedAt',
      settings: '&key',
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

/** 删除本地笔记本 */
export async function deleteNotebook(id: string): Promise<void> {
  await db.notebooks.delete(id)
}

/** 获取所有本地笔记本的 ID 列表 */
export async function listNotebookIds(): Promise<string[]> {
  const all = await db.notebooks.toArray()
  return all.map((n) => n.id)
}

/* ── 设置存储 ── */

/** 保存应用设置 */
export async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/** 读取应用设置 */
export async function loadSetting<T>(key: string): Promise<T | null> {
  const entry = await db.settings.get(key)
  return (entry?.value as T) ?? null
}

/** 删除设置 */
export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key)
}
