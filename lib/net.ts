/**
 * Sul campo la rete non è accesa o spenta. Quasi sempre è nel terzo stato: il
 * telefono resta agganciato alla cella, `navigator.onLine` dice di sì, ma i
 * pacchetti non passano. Una fetch senza scadenza in quella situazione resta
 * appesa per minuti e blocca tutta la sincronizzazione, quindi ogni chiamata
 * verso il server passa da qui e ogni chiamata ha un tempo massimo.
 */

/** Login e rinnovo token: se non rispondono subito non vale la pena aspettare. */
export const SCADENZA_AUTH = 8_000;
/** Lettura e scrittura righe. */
export const SCADENZA_DATI = 20_000;
/** Firme su Storage: sono immagini, su rete lenta serve più respiro. */
export const SCADENZA_FILE = 45_000;
/** Tempo massimo di un intero giro di sincronizzazione. */
export const SCADENZA_GIRO = 90_000;

export class ErroreRete extends Error {
  constructor(message = "Il server non ha risposto.") {
    super(message);
    this.name = "ErroreRete";
  }
}

const SEGNI_DI_RETE =
  /failed to fetch|fetch failed|networkerror|network error|network request failed|load failed|timeout|timed out|aborted|abort|err_internet|err_network|err_connection|connection closed|socket hang up|non ha risposto/i;

/**
 * Distingue un guaio di linea da un guaio di dati. Il primo si ritenta e basta,
 * il secondo va mostrato all'utente perché ritentarlo all'infinito non lo risolve.
 */
export function eDiRete(errore: unknown): boolean {
  if (errore instanceof ErroreRete) return true;
  if (typeof errore === "object" && errore !== null && "name" in errore) {
    const nome = String((errore as { name?: unknown }).name ?? "");
    if (nome === "AbortError" || nome === "TimeoutError") return true;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const testo = errore instanceof Error ? errore.message : String(errore ?? "");
  return SEGNI_DI_RETE.test(testo);
}

export function messaggioErrore(errore: unknown) {
  if (errore instanceof Error) return errore.message;
  return String(errore ?? "Errore sconosciuto");
}

/* ------------------------------------------------------------------ *
 * Stato della rete
 * ------------------------------------------------------------------ */

/**
 * `instabile` è lo stato che mancava: il dispositivo crede di essere collegato
 * ma l'ultimo scambio col server non è arrivato a destinazione.
 */
export type StatoRete = "offline" | "instabile" | "online";

let stato: StatoRete =
  typeof navigator === "undefined" || navigator.onLine ? "online" : "offline";
let ultimoScambioRiuscito: number | null = null;
const ascoltatori = new Set<() => void>();

function aggiorna(nuovo: StatoRete) {
  if (stato === nuovo) return;
  stato = nuovo;
  for (const cb of ascoltatori) cb();
}

export function statoRete(): StatoRete {
  return stato;
}

export function ultimoContatto(): number | null {
  return ultimoScambioRiuscito;
}

/** Il server ha risposto: anche un 401 o un 500 valgono, la linea c'è. */
export function segnalaScambioRiuscito() {
  ultimoScambioRiuscito = Date.now();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    aggiorna("offline");
    return;
  }
  aggiorna("online");
}

/** La richiesta non è mai arrivata: linea assente o che non passa. */
export function segnalaScambioFallito(errore?: unknown) {
  if (errore !== undefined && !eDiRete(errore)) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    aggiorna("offline");
    return;
  }
  aggiorna("instabile");
}

export function sottoscriviRete(cb: () => void) {
  ascoltatori.add(cb);
  return () => {
    ascoltatori.delete(cb);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => aggiorna("offline"));
  // Al ritorno del segnale si riparte fiduciosi: sarà il primo scambio a dire com'è andata.
  window.addEventListener("online", () => aggiorna("online"));
}

/* ------------------------------------------------------------------ *
 * Scadenze
 * ------------------------------------------------------------------ */

/** Mette un tetto di tempo a una promessa qualsiasi (Dexie, un giro di sync, ...). */
export function conScadenza<T>(promessa: Promise<T>, ms: number, cosa = "L'operazione"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ErroreRete(`${cosa} non ha risposto in tempo.`)), ms);
    promessa.then(
      (valore) => {
        clearTimeout(timer);
        resolve(valore);
      },
      (errore) => {
        clearTimeout(timer);
        reject(errore);
      },
    );
  });
}

function collegaSegnale(controller: AbortController, esterno?: AbortSignal | null) {
  if (!esterno) return;
  if (esterno.aborted) {
    controller.abort(esterno.reason);
    return;
  }
  esterno.addEventListener("abort", () => controller.abort(esterno.reason), { once: true });
}

/**
 * Sostituisce la fetch dentro il client Supabase: da qui passano dati, auth e
 * storage, quindi è l'unico posto dove serve mettere la scadenza. Registra anche
 * l'esito, che è il modo più onesto di sapere se la linea funziona davvero:
 * nessun ping periodico, si guarda il traffico che l'app fa comunque.
 */
export function fetchConScadenza(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  collegaSegnale(controller, init?.signal);

  const timer = setTimeout(
    () => controller.abort(new ErroreRete("Il server non ha risposto in tempo.")),
    ms,
  );

  return fetch(input, { ...init, signal: controller.signal }).then(
    (risposta) => {
      clearTimeout(timer);
      segnalaScambioRiuscito();
      return risposta;
    },
    (errore: unknown) => {
      clearTimeout(timer);
      segnalaScambioFallito(errore);
      throw errore instanceof ErroreRete
        ? errore
        : eDiRete(errore)
          ? new ErroreRete("Nessuna risposta dal server: linea assente o troppo debole.")
          : errore;
    },
  );
}
