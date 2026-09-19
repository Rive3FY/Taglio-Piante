const CACHE = "rapportini-taglio-v18";

/**
 * Pagine che devono aprirsi anche se non sono mai state visitate su questo
 * dispositivo. Vengono scaricate all'installazione, una per una: se una non
 * risponde le altre si installano lo stesso.
 */
const PRECACHE = [
  "/",
  "/operatore",
  "/operatore/campate",
  "/tecnico",
  "/manifest.json",
  "/icon.svg",
  "/scheda-taglio.pdf",
];

/**
 * Con poca linea la rete non dice «no», resta in silenzio. Oltre questa soglia
 * si smette di aspettarla e si serve la copia locale: era questo il motivo per
 * cui toccando un link non succedeva niente per parecchi secondi.
 */
const ATTESA_RETE_MS = 2500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
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

/**
 * I payload RSC sono legati alla build: servirne uno vecchio rompe la pagina.
 * Restano fuori dalla cache, e se non arrivano il router di Next ripiega da solo
 * su una navigazione intera, che invece la cache ce l'ha.
 */
function eRsc(request, url) {
  return url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";
}

function vaInCache(url) {
  if (!stessaOrigine(url)) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return true;
}

async function dallaCache(request) {
  const esatto = await caches.match(request, { ignoreSearch: false });
  if (esatto) return esatto;
  const url = new URL(request.url);
  const cache = await caches.open(CACHE);
  const chiavi = await cache.keys();
  const hit = chiavi.find((key) => {
    const cached = new URL(key.url);
    return cached.origin === url.origin && cached.pathname === url.pathname;
  });
  return hit ? cache.match(hit) : undefined;
}

function salvaCopia(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  const copia = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copia));
}

/** Aspetta la rete, ma solo per un po': scaduto il tempo vince la copia locale. */
function fetchConAttesa(request, ms) {
  return new Promise((resolve, reject) => {
    let deciso = false;
    const timer = setTimeout(() => {
      if (deciso) return;
      deciso = true;
      reject(new Error("rete troppo lenta"));
    }, ms);
    fetch(request).then(
      (risposta) => {
        clearTimeout(timer);
        // La risposta arrivata dopo la scadenza non si butta: aggiorna la cache
        // per la prossima volta, anche se ormai l'utente vede la copia salvata.
        salvaCopia(request, risposta);
        if (deciso) return;
        deciso = true;
        resolve(risposta);
      },
      (errore) => {
        clearTimeout(timer);
        if (deciso) return;
        deciso = true;
        reject(errore);
      },
    );
  });
}

async function cacheFirst(request) {
  const cached = await dallaCache(request);
  if (cached) return cached;
  const risposta = await fetch(request);
  salvaCopia(request, risposta);
  return risposta;
}

/** Icone, manifest, modello PDF: si servono subito e si aggiornano in sottofondo. */
async function cacheEPoiAggiorna(request) {
  const cached = await dallaCache(request);
  if (cached) {
    fetch(request)
      .then((risposta) => salvaCopia(request, risposta))
      .catch(() => undefined);
    return cached;
  }
  return fetchConAttesa(request, ATTESA_RETE_MS);
}

/**
 * Per le pagine: senza segnale si va dritti alla copia locale senza nemmeno
 * provare, con segnale si prova la rete ma con un tetto di attesa.
 */
async function paginaConRipiego(request) {
  if (!self.navigator.onLine) {
    const subito = (await dallaCache(request)) ?? (await caches.match("/"));
    if (subito) return subito;
  }

  try {
    return await fetchConAttesa(request, ATTESA_RETE_MS);
  } catch {
    const cached = (await dallaCache(request)) ?? (await caches.match("/"));
    return cached ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!stessaOrigine(url)) return;

  if (eRsc(request, url)) {
    event.respondWith(fetchConAttesa(request, ATTESA_RETE_MS).catch(() => Response.error()));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(paginaConRipiego(request));
    return;
  }

  // Gli asset di build hanno l'id nel nome: se ci sono in cache sono quelli giusti.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      cacheFirst(request).catch(async () => (await dallaCache(request)) ?? Response.error()),
    );
    return;
  }

  if (!vaInCache(url)) return;

  event.respondWith(
    cacheEPoiAggiorna(request).catch(
      async () => (await dallaCache(request)) ?? Response.error(),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
