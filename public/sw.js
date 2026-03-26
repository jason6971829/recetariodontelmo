const CACHE_NAME = "dontelmo-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

// Instalar: cachear assets estáticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // No cachear API calls de Supabase ni TTS
  if (request.url.includes("supabase.co") || request.url.includes("/api/tts")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachear respuestas exitosas de navegación y assets
        if (response.ok && (request.mode === "navigate" || request.destination === "script" || request.destination === "style")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: usar cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Si es navegación, devolver la página principal cacheada
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
