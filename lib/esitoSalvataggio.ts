import type { EsitoSalvataggio } from "@/components/PopupEsitoSalvataggio";

type Listener = (esito: EsitoSalvataggio | null) => void;

let attuale: EsitoSalvataggio | null = null;
const listeners = new Set<Listener>();

function notifica() {
  for (const l of listeners) l(attuale);
}

/** Mostra il popup verde con visto. Se ce n’è già uno, lo sostituisce. */
export function mostraEsito(esito: EsitoSalvataggio) {
  attuale = esito;
  notifica();
}

export function chiudiEsito() {
  if (!attuale) return;
  attuale = null;
  notifica();
}

export function iscriviEsito(listener: Listener) {
  listeners.add(listener);
  listener(attuale);
  return () => {
    listeners.delete(listener);
  };
}
