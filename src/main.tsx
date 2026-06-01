import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('[debug v2] main.tsx loaded, deploying global error fallback')

// 二次保障：补充 React 侧的全局捕获（index.html 的脚本优先）
// 某些 React 18 错误可能不会冒泡到 window.onerror
window.addEventListener('error', (event) => {
  if (event.error) {
    console.error('[fallback] window.error event:', event.error.message)
    console.error('[fallback] stack:', event.error.stack)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[fallback] unhandledrejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
