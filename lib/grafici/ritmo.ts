import { rapportinoEChiuso, type Rapportino } from "@/lib/types";

export type ScalaRitmo = "giorno" | "settimana" | "mese";

export type ColonnaRitmo = {
  chiave: string;
  etichetta: string;
  titolo: string;
  rapportini: number;
};

const MESI_CORTI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MESI_LUNGHI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export const FINESTRA_RITMO = 12;
export const FINESTRA_GIORNI = 14;
const GIORNI_SETTIMANA = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoLocale(data: Date) {
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export function dataLocale(iso: string) {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  return new Date(anno || 1970, (mese || 1) - 1, giorno || 1);
}

/** Lunedì della settimana che contiene la data, in ora locale. */
export function lunediIso(iso: string) {
  const data = dataLocale(iso);
  const offset = (data.getDay() + 6) % 7;
  data.setDate(data.getDate() - offset);
  return isoLocale(data);
}

export function inizioFinestraMesi(oggi = new Date(), quanti = FINESTRA_RITMO) {
  const primo = new Date(oggi.getFullYear(), oggi.getMonth() - (quanti - 1), 1);
  return isoLocale(primo);
}

function ultimiMesi(oggi: Date, quanti: number) {
  const chiavi: string[] = [];
  for (let i = quanti - 1; i >= 0; i--) {
    const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    chiavi.push(`${data.getFullYear()}-${pad(data.getMonth() + 1)}`);
  }
  return chiavi;
}

function ultimeSettimane(oggi: Date, quanti: number) {
  const lunedi = dataLocale(lunediIso(isoLocale(oggi)));
  const chiavi: string[] = [];
  for (let i = quanti - 1; i >= 0; i--) {
    const data = new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() - i * 7);
    chiavi.push(isoLocale(data));
  }
  return chiavi;
}

function ultimiGiorni(oggi: Date, quanti: number) {
  const chiavi: string[] = [];
  for (let i = quanti - 1; i >= 0; i--) {
    chiavi.push(isoLocale(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - i)));
  }
  return chiavi;
}

function titoloGiorno(chiave: string) {
  const data = dataLocale(chiave);
  const testo = `${GIORNI_SETTIMANA[data.getDay()]} ${data.getDate()} ${MESI_LUNGHI[data.getMonth()]} ${data.getFullYear()}`;
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function etichettaMese(chiave: string, mostraAnno: boolean) {
  const [anno, mese] = chiave.split("-").map(Number);
  const nome = MESI_CORTI[(mese || 1) - 1] ?? chiave;
  return mostraAnno ? `${nome} ${String(anno).slice(2)}` : nome;
}

function titoloMese(chiave: string) {
  const [anno, mese] = chiave.split("-").map(Number);
  const nome = MESI_LUNGHI[(mese || 1) - 1] ?? chiave;
  const testo = `${nome} ${anno}`;
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function etichettaData(chiave: string) {
  const data = dataLocale(chiave);
  return `${data.getDate()} ${MESI_CORTI[data.getMonth()]}`;
}

function titoloSettimana(chiave: string) {
  const data = dataLocale(chiave);
  const nome = MESI_LUNGHI[data.getMonth()];
  return `Settimana dal ${data.getDate()} ${nome} ${data.getFullYear()}`;
}

/**
 * Una colonna per periodo (14 giorni, 12 settimane o 12 mesi), con i soli rapportini archiviati di quel periodo.
 * I periodi senza fogli restano a zero, così il ritmo si legge anche quando ci si ferma.
 */
export function colonneRitmo(
  rapportini: Rapportino[],
  scala: ScalaRitmo,
  oggi = new Date(),
): ColonnaRitmo[] {
  const conteggi = new Map<string, number>();
  for (const r of rapportini) {
    if (!rapportinoEChiuso(r.stato) || !r.dataLavoro) continue;
    const chiave =
      scala === "mese"
        ? r.dataLavoro.slice(0, 7)
        : scala === "settimana"
          ? lunediIso(r.dataLavoro)
          : r.dataLavoro.slice(0, 10);
    conteggi.set(chiave, (conteggi.get(chiave) ?? 0) + 1);
  }

  if (scala === "giorno") {
    return ultimiGiorni(oggi, FINESTRA_GIORNI).map((chiave) => ({
      chiave,
      etichetta: etichettaData(chiave),
      titolo: titoloGiorno(chiave),
      rapportini: conteggi.get(chiave) ?? 0,
    }));
  }

  if (scala === "mese") {
    const chiavi = ultimiMesi(oggi, FINESTRA_RITMO);
    const annoInizio = chiavi[0]?.slice(0, 4);
    return chiavi.map((chiave, i) => ({
      chiave,
      etichetta: etichettaMese(
        chiave,
        i === 0 || chiave.endsWith("-01") || chiave.slice(0, 4) !== annoInizio,
      ),
      titolo: titoloMese(chiave),
      rapportini: conteggi.get(chiave) ?? 0,
    }));
  }

  return ultimeSettimane(oggi, FINESTRA_RITMO).map((chiave) => ({
    chiave,
    etichetta: etichettaData(chiave),
    titolo: titoloSettimana(chiave),
    rapportini: conteggi.get(chiave) ?? 0,
  }));
}
