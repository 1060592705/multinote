// MultiNote Service Worker — 离线缓存 + PWA

const CACHE = 'multinote-v2'
const ASSETS = [
  '/multinote/',
  '/multinote/index.html',
  '/multinote/manifest.json',
  '/multinote/favicon.svg',
]

// 安装：预缓存核心资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 请求：缓存优先（对 JS/CSS/图片） + 网络回退
self.addEventListener('fetch', (e) => {
  // 跳过 WebSocket / chrome-extension
  if (e.request.url.startsWith('ws') || e.request.url.startsWith('chrome-extension')) return

  e.respondWith(
    caches.match(e.request).then((cached) => {
      // 缓存命中直接返回
      if (cached) return cached

      // 否则请求网络并缓存（仅 GET）
      return fetch(e.request).then((resp) => {
        if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp
        if (e.request.method !== 'GET') return resp

        const clone = resp.clone()
        caches.open(CACHE).then((cache) => {
          cache.put(e.request, clone)
        })
        return resp
      }).catch(() => {
        // 离线且未缓存：返回空
        return new Response('', { status: 408 })
      })
    })
  )
})
