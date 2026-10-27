// 網頁存手機：開啟時直接用手機上的副本（秒開、沒訊號也能開），背景再抓新版；
// 新版和副本不同時通知頁面顯示「有新版本」提示條。只管兩個網頁本身，GitHub資料與照片另有暫存。
const CACHE = "eco-pages-v5"; // 改這個檔的邏輯時要升版號（shared.js 的 ECO_PAGES_CACHE 要同名）
// 離線包：圖磚由頁面「下載離線包」寫進 eco-tiles；地圖/PDF元件（cdnjs，網址含版號不會變）第一次用到就存
const TILES = "eco-tiles", LIBS = "eco-libs";
const PAGES = ["index.html", "habitat.html", "shared.css", "shared.js"]; // 兩個頁面＋兩個頁面共用的樣式與程式

self.addEventListener("install", e => {
  // 網址加參數：GitHub Pages 的 CDN 對同一網址的舊副本會留約 10 分鐘（no-store 只管瀏覽器、管不到 CDN），加參數才抓得到剛上傳的新版
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PAGES.map(async p => { const r = await fetch(p + "?swbust=" + Date.now(), { cache: "no-store" }); if (r.ok) await c.put(p, r); }))));
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
  const u = new URL(req.url);
  if (u.searchParams.has("swbypass")) return; // ↻ 檢查新版時直接抓網路
  // 國土測繪中心圖磚：有下載過就用手機上的（山區沒訊號也看得到），沒有才上網抓
  if (u.hostname === "wmts.nlsc.gov.tw") {
    e.respondWith(caches.open(TILES).then(c => c.match(req.url, { ignoreVary: true })).then(hit => hit || fetch(req)));
    return;
  }
  // 地圖/PDF元件：用手機上的副本，沒有就抓（cors模式，存起來才不會是看不到內容的opaque回應）
  if (u.hostname === "cdnjs.cloudflare.com" && /\/ajax\/libs\/(leaflet|pdf\.js|jszip)\//.test(u.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(LIBS);
      const hit = await c.match(req.url, { ignoreVary: true });
      if (hit) return hit;
      try { const res = await fetch(req.url, { mode: "cors" }); if (res.ok) await c.put(req.url, res.clone()); return res; }
      catch (err) { return fetch(req); }
    })());
    return;
  }
  const page = pageOf(req.url);
  if (!page) return; // GitHub API、照片、外部元件都不經過這裡

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(page);
    // 舊副本的內容要在交給頁面之前先讀出來（交出去後body會被頁面讀走，不能再讀）
    const old = hit ? await hit.clone().text() : null;
    const update = fetch(page + "?swbust=" + Date.now(), { cache: "no-store" }).then(async res => {
      if (!res.ok) return res;
      const fresh = await res.clone().text();
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
