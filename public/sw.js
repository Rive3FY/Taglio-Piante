const CACHE = "rapportini-taglio-v19";

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

/**
 * Appena una richiesta scade si annota l'ora. Per un po' non si riprova ad
 * aspettare la rete su ogni singola richiesta: la linea è quella, e la seconda
 * attesa sarebbe tempo buttato. Senza questa memoria una navigazione costava
 * due scadenze in fila, quella del payload e quella della pagina.
 */
const MEMORIA_LINEA_MS = 10_000;
let lineaSospettaDa = 0;

function lineaSospetta() {
  return Date.now() - lineaSospettaDa < MEMORIA_LINEA_MS;
}

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
 * I payload RSC sono legati alla build e alla navigazione in corso: servirne
 * uno vecchio rompe la pagina. Non si mettono in cache e non si leggono dalla
 * cache. Se non arrivano, Next ripiega da solo su una navigazione intera, e
 * quella la cache ce l'ha.
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
  const esatto = await caches.match(request);
  if (esatto) return esatto;

  // Ripiego sul solo percorso, saltando i payload RSC: servirne uno al posto
  // di una pagina darebbe una schermata bianca.
  const url = new URL(request.url);
  const cache = await caches.open(CACHE);
  const chiavi = await cache.keys();
  const hit = chiavi.find((key) => {
    const cached = new URL(key.url);
    if (cached.searchParams.has("_rsc")) return false;
    return cached.origin === url.origin && cached.pathname === url.pathname;
  });
  return hit ? cache.match(hit) : undefined;
}

function salvaCopia(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  if (new URL(request.url).searchParams.has("_rsc")) return;
  const copia = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copia));
}

/**
 * Aspetta la rete, ma solo per un po': scaduto il tempo vince la copia locale.
 * `interrompi` serve per le richieste il cui risultato tardivo non ci serve
 * più, così non restano socket aperti a consumare batteria.
 */
function fetchConAttesa(request, ms, { interrompi = false, salva = true } = {}) {
  return new Promise((resolve, reject) => {
    const controller = interrompi ? new AbortController() : null;
    let deciso = false;

    const timer = setTimeout(() => {
      if (deciso) return;
      deciso = true;
      lineaSospettaDa = Date.now();
      controller?.abort();
      reject(new Error("rete troppo lenta"));
    }, ms);

    fetch(controller ? new Request(request, { signal: controller.signal }) : request).then(
      (risposta) => {
        clearTimeout(timer);
        lineaSospettaDa = 0;
        // La risposta arrivata dopo la scadenza non si butta: aggiorna la cache
        // per la prossima volta, anche se ormai l'utente vede la copia salvata.
        if (salva) salvaCopia(request, risposta);
        if (deciso) return;
        deciso = true;
        resolve(risposta);
      },
      (errore) => {
        clearTimeout(timer);
        if (deciso) return;
        deciso = true;
        lineaSospettaDa = Date.now();
        reject(errore);
      },
    );
  });
}

/** Gli asset di build hanno l'id nel nome: se ci sono in cache sono quelli giusti. */
async function cacheFirst(request) {
  const cached = await dallaCache(request);
  return cached ?? fetchConAttesa(request, ATTESA_RETE_MS);
}

/** Icone, manifest, modello PDF: si servono subito e si aggiornano in sottofondo. */
async function cacheEPoiAggiorna(request) {
  const cached = await dallaCache(request);
  if (cached) {
    if (!lineaSospetta()) {
      fetch(request)
        .then((risposta) => salvaCopia(request, risposta))
        .catch(() => undefined);
    }
    return cached;
  }
  return fetchConAttesa(request, ATTESA_RETE_MS);
}

/**
 * Per le pagine: se il segnale manca, o se poco fa la rete non ha risposto, si
 * va dritti alla copia locale senza nemmeno provare. Altrimenti si prova la
 * rete, ma con un tetto di attesa.
 */
async function paginaConRipiego(request) {
  if (!self.navigator.onLine || lineaSospetta()) {
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
    // Linea già data per persa: meglio fallire subito e lasciare che Next
    // ripieghi sulla navigazione intera, che la cache serve all'istante.
    if (!self.navigator.onLine || lineaSospetta()) {
      event.respondWith(Promise.resolve(Response.error()));
      return;
    }
    event.respondWith(
      fetchConAttesa(request, ATTESA_RETE_MS, { interrompi: true, salva: false }).catch(() =>
        Response.error(),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(paginaConRipiego(request));
    return;
  }

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
