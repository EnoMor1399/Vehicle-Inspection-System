const CACHE_NAME = "rsl-vims-v4-static";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json?v=4",
  "/pwa/icon/192",
  "/pwa/icon/512",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // A single optional asset failure must never prevent the service worker
    // from installing. Broken precache URLs previously blocked PWA install.
    await Promise.allSettled(
      PRECACHE_URLS.map(async (url) => {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      })
    );
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));

    if (self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.enable();
      } catch {
        // Navigation preload is an optimization only.
      }
    }

    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Protected/API responses stay network-only so authenticated operational
  // records are not retained in the service-worker cache on shared devices.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: "offline", message: "A network connection is required for this request." }),
        { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      ))
    );
    return;
  }

  // Next.js hashed static assets are immutable and safe for cache-first reuse.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }))
    );
    return;
  }

  // Icons and manifest resources use stale-while-revalidate so installation
  // starts quickly while newer branding metadata can replace cached copies.
  if (url.pathname.startsWith("/pwa/icon/") || url.pathname === "/manifest.json") {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const networkPromise = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => cached);

      return cached || networkPromise;
    })());
    return;
  }

  // Never cache authenticated HTML pages. Navigation preload can reduce launch
  // latency without persisting protected page content.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        return (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
      }
    })());
  }
});
