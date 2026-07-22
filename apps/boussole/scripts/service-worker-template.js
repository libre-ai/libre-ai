const ASSETS={{ASSETS}};
const CACHE={{CACHE}};
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener("fetch",event=>{const url=new URL(event.request.url);if(event.request.method==="GET"&&url.origin===location.origin&&ASSETS.includes(url.pathname)){event.respondWith(caches.match(event.request).then(cached=>cached??fetch(event.request)));}});
