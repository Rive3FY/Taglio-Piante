import type { CampataLavoro } from "@/lib/types";
import { campataDaAttenzionare, campataDaRiprendere, campataETagliata } from "@/lib/types";

export type UnisciCampataOpts = {
  /** Fogli in cancellazione: la chiusura remota di quei fogli non deve ririchiedere la campata. */
  fogliEliminati?: Set<string>;
};

function campiTaglio(c: CampataLavoro) {
  return {
    stato: c.stato,
    dataTaglio: c.dataTaglio,
    operatore: c.operatore,
    rapportinoId: c.rapportinoId,
    daNonTagliare: c.daNonTagliare,
    daNonTagliareBy: c.daNonTagliareBy,
  };
}

function campiRinvio(c: CampataLavoro) {
  return {
    rinvioMese: c.rinvioMese,
    rinvioAnno: c.rinvioAnno,
    rinvioNote: c.rinvioNote,
    rinvioBy: c.rinvioBy,
    rinvioFattaIl: c.rinvioFattaIl,
    rinvioFattaBy: c.rinvioFattaBy,
  };
}

function campiAttenzione(c: CampataLavoro) {
  return {
    attenzionare: c.attenzionare,
    attenzionareBy: c.attenzionareBy,
    attenzionareFattaIl: c.attenzionareFattaIl,
    attenzionareFattaBy: c.attenzionareFattaBy,
  };
}

function chiusuraValida(c: CampataLavoro, fogliEliminati?: Set<string>) {
  if (c.rapportinoId && fogliEliminati?.has(c.rapportinoId)) return false;
  return campataETagliata(c) || Boolean(c.rapportinoId);
}

function unisciNote(a?: string, b?: string) {
  const x = a?.trim() ?? "";
  const y = b?.trim() ?? "";
  if (!x) return y || undefined;
  if (!y || x.includes(y)) return x || undefined;
  if (y.includes(x)) return y;
  return `${x}\n${y}`;
}

function piuNuovo(a: CampataLavoro, b: CampataLavoro) {
  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b;
}

/**
 * Due telefoni possono toccare la stessa campata in modi diversi: un foglio chiude
 * il taglio, l’altro mette «da riprendere». L’upsert intero perdeva uno dei due.
 * Si tiene la chiusura se c’è, e il promemoria se almeno un lato lo ha ancora.
 */
export function unisciCampataLocaleRemoto(
  locale: CampataLavoro,
  remoto: CampataLavoro,
  opts?: UnisciCampataOpts,
): CampataLavoro {
  const fogli = opts?.fogliEliminati;
  const localePiuNuovo = piuNuovo(locale, remoto) === locale;
  const base = localePiuNuovo ? locale : remoto;

  const localeChiusa = chiusuraValida(locale, fogli);
  const remotoChiusa = chiusuraValida(remoto, fogli);
  const taglio =
    localeChiusa && !remotoChiusa
      ? campiTaglio(locale)
      : remotoChiusa && !localeChiusa
        ? campiTaglio(remoto)
        : campiTaglio(base);

  const rinvioLocale = campataDaRiprendere(locale);
  const rinvioRemoto = campataDaRiprendere(remoto);
  let rinvio = campiRinvio(base);
  if (rinvioLocale && !rinvioRemoto) {
    rinvio = localePiuNuovo || remotoChiusa ? campiRinvio(locale) : campiRinvio(remoto);
  } else if (rinvioRemoto && !rinvioLocale) {
    rinvio = !localePiuNuovo || localeChiusa ? campiRinvio(remoto) : campiRinvio(locale);
  }

  const attLocale = campataDaAttenzionare(locale);
  const attRemoto = campataDaAttenzionare(remoto);
  let attenzione = campiAttenzione(base);
  if (attLocale && !attRemoto) {
    attenzione = localePiuNuovo || remotoChiusa ? campiAttenzione(locale) : campiAttenzione(remoto);
  } else if (attRemoto && !attLocale) {
    attenzione = !localePiuNuovo || localeChiusa ? campiAttenzione(remoto) : campiAttenzione(locale);
  }

  const combinato =
    taglio.stato !== base.stato ||
    taglio.rapportinoId !== base.rapportinoId ||
    taglio.daNonTagliare !== base.daNonTagliare ||
    rinvio.rinvioMese !== base.rinvioMese ||
    rinvio.rinvioFattaIl !== base.rinvioFattaIl ||
    attenzione.attenzionare !== base.attenzionare ||
    attenzione.attenzionareFattaIl !== base.attenzionareFattaIl;

  const latest = Math.max(
    new Date(locale.updatedAt).getTime(),
    new Date(remoto.updatedAt).getTime(),
  );

  return {
    ...base,
    ...taglio,
    ...rinvio,
    ...attenzione,
    note: unisciNote(locale.note, remoto.note),
    syncStatus: locale.syncStatus === "error" || locale.syncStatus === "pending" ? "pending" : "synced",
    updatedAt: combinato ? new Date().toISOString() : new Date(latest).toISOString(),
  };
}
