const CACHE_NAME = "dontelmo-v3";
const STATIC_ASSETS = ["/", "/manifest.json"];

// Instalar: cachear assets estáticos (NO skipWaiting aquí)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// La página le dice cuándo tomar el control
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activar: limpiar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network first, fallback a cache solo si está offline
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.url.includes("supabase.co") || request.url.includes("/api/tts")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === "navigate" || request.destination === "script" || request.destination === "style")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") return caches.match("/");
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
