const CACHE = "rapportini-taglio-v17";
const PRECACHE = ["/", "/manifest.json", "/icon.svg", "/scheda-taglio.pdf"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function stessaOrigine(url) {
  return url.origin === self.location.origin;
}

function vaInCache(url) {
  if (!stessaOrigine(url)) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return true;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function matchPerPercorso(request) {
  const exact = await caches.match(request);
  if (exact) return exact;
  const url = new URL(request.url);
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  const hit = keys.find((key) => {
    const cachedUrl = new URL(key.url);
    return cachedUrl.origin === url.origin && cachedUrl.pathname === url.pathname;
  });
  return hit ? cache.match(hit) : undefined;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      cacheFirst(request).catch(async () => {
        const cached = await caches.match(request);
        return cached ?? Response.error();
      }),
    );
    return;
  }

  if (!vaInCache(url)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await matchPerPercorso(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("/");
        return Response.error();
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
