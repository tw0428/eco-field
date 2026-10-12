// 網頁存手機：開啟時直接用手機上的副本（秒開、沒訊號也能開），背景再抓新版；
// 新版和副本不同時通知頁面顯示「有新版本」提示條。只管兩個網頁本身，GitHub資料與照片另有暫存。
const CACHE = "eco-pages-v1";
const PAGES = ["index.html", "habitat.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PAGES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("eco-pages-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// /eco-field/ 與 /eco-field/index.html 視為同一頁；?openExternalBrowser=1 等參數不影響
function pageOf(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return null;
  const scope = new URL("./", self.location).pathname;
  if (!u.pathname.startsWith(scope)) return null;
  const p = u.pathname.slice(scope.length) || "index.html";
  return PAGES.includes(p) ? p : null;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const page = pageOf(req.url);
  if (!page) return; // GitHub API、照片、外部元件都不經過這裡

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(page);
    const update = fetch(page, { cache: "no-store" }).then(async res => {
      if (!res.ok) return res;
      const fresh = await res.clone().text();
      const old = hit ? await hit.clone().text() : null;
      await cache.put(page, res.clone());
      if (old !== null && old !== fresh) {
        for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ type: "update", page });
      }
      return res;
    }).catch(() => null);

    if (hit) { e.waitUntil(update); return hit; }
    return (await update) || new Response("目前沒有網路，且手機上還沒有這個頁面的副本。", { status: 503, headers: { "Content-Type": "text/plain;charset=utf-8" } });
  })());
});
