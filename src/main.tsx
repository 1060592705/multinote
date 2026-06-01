import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/* ── 全局错误捕获（调试用 — 定位后删除） ── */
function showErrorBox(source: string, message: string, stack?: string) {
  // 移除旧错误框
  const old = document.getElementById('global-error-box')
  if (old) old.remove()

  const box = document.createElement('div')
  box.id = 'global-error-box'
  box.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #dc2626; color: #fff; padding: 16px 20px;
    font-family: 'Courier New', monospace; font-size: 13px;
    line-height: 1.6; white-space: pre-wrap; max-height: 50vh;
    overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,.3);
  `
  box.textContent = `[${source}]\n${message}\n\n${stack || '(no stack)'}`
  document.body.prepend(box)
}

window.addEventListener('error', (event) => {
  const msg = event.message || String(event.error?.message || '')
  const stack = event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`
  showErrorBox('window.onerror', msg, stack)
  event.preventDefault()
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const msg = reason?.message || String(reason || '')
  const stack = reason?.stack || ''
  showErrorBox('unhandledrejection', msg, stack)
  event.preventDefault()
})

console.log('[debug] Global error handlers installed')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
