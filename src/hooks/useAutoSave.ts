/**
 * 自动保存 Hook
 *
 * 监听 Zustand store 中我的笔记本变化，防抖后写入 IndexedDB。
 * 页面加载时从 IndexedDB 恢复数据。
 */

import { useEffect, useRef } from 'react'
import { useNotebookStore } from '../store/useNotebookStore'
import { saveNotebook, loadNotebook } from '../lib/storage'
import { AUTO_SAVE_DELAY } from '../lib/constants'

export function useAutoSave(userId: string) {
  const myNotebook = useNotebookStore((s) => s.myNotebook)
  const setMyNotebook = useNotebookStore((s) => s.setMyNotebook)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(false)

  /* ── 页面加载时恢复 ── */
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const restoreId = `nb-${userId}`
    loadNotebook(restoreId).then((data) => {
      if (data) {
        setMyNotebook(data)
      }
    }).catch(() => {
      // 首次使用，无本地数据，忽略
    })
  }, [userId, setMyNotebook])

  /* ── 防抖自动保存 ── */
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      const nb = useNotebookStore.getState().myNotebook
      saveNotebook({
        ...nb,
        id: `nb-${userId}`,
      }).catch(() => {
        // 存储失败（如配额满），静默忽略
      })
    }, AUTO_SAVE_DELAY)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [myNotebook, userId])
}
