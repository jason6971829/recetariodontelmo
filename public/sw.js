const CACHE_NAME = "dontelmo-v41";
// Archivos con hash de Next (/_next/static) nunca cambian: se guardan aparte y sobreviven a las versiones
const STATIC_CACHE = "dontelmo-static-v1";
const IMG_CACHE = "dontelmo-img-v1";
const KEEP = [CACHE_NAME, STATIC_CACHE, IMG_CACHE];
const STATIC_ASSETS = ["/", "/manifest.json"];
// Si la red no contesta en este tiempo (wifi caído, datos malos), se usa lo guardado
const NET_TIMEOUT_MS = 3500;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Primero lo guardado; si no está, red (y se guarda)
async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok || res.type === "opaque") {
      cache.put(request, res.clone());
      if (max) trimCache(cacheName, max);
    }
    return res;
  } catch {
    return new Response("", { status: 504 });
  }
}

// Red con tiempo límite; si falla o tarda, lo guardado
async function networkFirst(request, { navigate = false } = {}) {
  const cache = await caches.open(CACHE_NAME);
  const net = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  try {
    return await Promise.race([net, timeout(NET_TIMEOUT_MS)]);
  } catch {
    const cached = await cache.match(request, { ignoreSearch: navigate });
    if (cached) return cached;
    if (navigate) {
      const home = await cache.match("/");
      if (home) return home;
    }
    // sin copia guardada: esperar a la red aunque tarde
    try { return await net; } catch { return new Response("Sin conexión", { status: 503 }); }
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Fotos (recetas en Supabase Storage, imágenes de Next): guardadas para verse sin internet
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMG_CACHE, 250));
    return;
  }

  // Datos de Supabase, voz y APIs: siempre a la red (la app ya tiene su propia copia local)
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) return;

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 600));
    return;
  }

  // Tipografías de Google
  if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 600));
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request, { navigate: request.mode === "navigate" }));
});
