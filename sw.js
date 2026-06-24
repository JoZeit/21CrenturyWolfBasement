// Service Worker — 地下室系统离线缓存
var CACHE = 'wolf-basement-v1'
var FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'src/wolf-data.js',
  'src/wolf-storage.js',
  'src/wolf-state.js',
  'src/wolf-views.js',
  'src/wolf-events.js',
  'src/wolf-main.js',
]

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(FILES)
    })
  )
})

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request)
    })
  )
})
