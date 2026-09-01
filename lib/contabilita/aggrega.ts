import type { CampataLavoro, CampataPriorita, Linea, Prestazione, Rapportino } from "@/lib/types";
import { prezzoChiamata } from "./listino";

const STATI_CONTABILI: Rapportino["stato"][] = ["in_attesa", "archiviato"];

export type VoceContabile = {
  prestazioneId: string;
  codice: string;
  descrizione: string;
  unitaMisura: string;
  quantita: number;
  prezzoUnitario: number | null;
  importo: number | null;
};

export type LineaContabile = {
  lineaId: string;
  codiceLinea: string;
  nomeLinea: string;
  rapportini: number;
  voci: VoceContabile[];
  importo: number | null;
};

export type GiornoContabile = {
  data: string;
  rapportini: number;
  voci: VoceContabile[];
  importo: number | null;
};

export type AvanzamentoPriorita = {
  priorita: CampataPriorita;
  totale: number;
  tagliate: number;
  daTagliare: number;
  tralasciate: number;
};

export function meseDaIso(iso: string) {
  return iso.slice(0, 7);
}

export function mesiDisponibili(rapportini: Rapportino[], oggi = new Date()) {
  const set = new Set<string>();
  set.add(`${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`);
  for (const r of rapportini) {
    if (r.dataLavoro) set.add(meseDaIso(r.dataLavoro));
  }
  return [...set].sort().reverse();
}

export function etichettaMese(mese: string) {
  const [y, m] = mese.split("-").map(Number);
  if (!y || !m) return mese;
  const testo = new Date(y, m - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

export function giorniDelMese(mese: string) {
  const [y, m] = mese.split("-").map(Number);
  if (!y || !m) return [];
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${mese}-${String(i + 1).padStart(2, "0")}`);
}

export function ultimoGiornoMese(mese: string) {
  const giorni = giorniDelMese(mese);
  return giorni[giorni.length - 1] ?? "";
}

export function giorniAllaChiusura(mese: string, oggiIso: string) {
  if (meseDaIso(oggiIso) !== mese) return null;
  const ultimo = ultimoGiornoMese(mese);
  const restano = Math.round(
    (new Date(`${ultimo}T00:00:00`).getTime() - new Date(`${oggiIso}T00:00:00`).getTime()) /
      86_400_000,
  );
  return Math.max(0, restano);
}

export function rapportiniDelMese(rapportini: Rapportino[], mese: string) {
  return rapportini.filter(
    (r) => STATI_CONTABILI.includes(r.stato) && r.dataLavoro && meseDaIso(r.dataLavoro) === mese,
  );
}

function vociDaRapportini(
  rapportini: Rapportino[],
  prestazioni: Prestazione[],
): VoceContabile[] {
  const byId = new Map(prestazioni.map((p) => [p.id, p]));
  const qty = new Map<string, number>();
  for (const r of rapportini) {
    for (const riga of r.righe ?? []) {
      if (!riga.quantita || riga.quantita <= 0) continue;
      qty.set(riga.prestazioneId, (qty.get(riga.prestazioneId) ?? 0) + riga.quantita);
    }
  }
  const voci: VoceContabile[] = [];
  for (const p of [...prestazioni].sort((a, b) => a.codice.localeCompare(b.codice, "it"))) {
    const quantita = qty.get(p.id) ?? 0;
    if (quantita <= 0) continue;
    const prezzo = prezzoChiamata(p.codice);
    voci.push({
      prestazioneId: p.id,
      codice: p.codice,
      descrizione: p.descrizione,
      unitaMisura: p.unitaMisura,
      quantita,
      prezzoUnitario: prezzo,
      importo: prezzo == null ? null : Math.round(quantita * prezzo * 100) / 100,
    });
  }
  for (const [id, quantita] of qty) {
    if (byId.has(id)) continue;
    voci.push({
      prestazioneId: id,
      codice: "?",
      descrizione: "Chiamata non in anagrafica",
      unitaMisura: "",
      quantita,
      prezzoUnitario: null,
      importo: null,
    });
  }
  return voci;
}

function sommaImporti(voci: VoceContabile[]) {
  if (voci.some((v) => v.importo == null)) return null;
  return voci.reduce((s, v) => s + (v.importo ?? 0), 0);
}

export function aggregaMese(
  rapportini: Rapportino[],
  prestazioni: Prestazione[],
  linee: Linea[],
  mese: string,
) {
  const delMese = rapportiniDelMese(rapportini, mese);
  const lineeById = new Map(linee.map((l) => [l.id, l]));
  const perLineaMap = new Map<string, Rapportino[]>();
  for (const r of delMese) {
    const list = perLineaMap.get(r.lineaId) ?? [];
    list.push(r);
    perLineaMap.set(r.lineaId, list);
  }

  const perLinea: LineaContabile[] = [...perLineaMap.entries()]
    .map(([lineaId, items]) => {
      const linea = lineeById.get(lineaId);
      const voci = vociDaRapportini(items, prestazioni);
      return {
        lineaId,
        codiceLinea: linea?.codice ?? lineaId,
        nomeLinea: linea?.nome ?? "Linea",
        rapportini: items.length,
        voci,
        importo: sommaImporti(voci),
      };
    })
    .sort((a, b) => a.codiceLinea.localeCompare(b.codiceLinea, "it"));

  const perGiorno: GiornoContabile[] = giorniDelMese(mese).map((data) => {
    const items = delMese.filter((r) => r.dataLavoro === data);
    const voci = vociDaRapportini(items, prestazioni);
    return {
      data,
      rapportini: items.length,
      voci,
      importo: sommaImporti(voci),
    };
  });

  const voci = vociDaRapportini(delMese, prestazioni);
  return {
    mese,
    rapportini: delMese.length,
    voci,
    perLinea,
    perGiorno,
    importo: sommaImporti(voci),
  };
}

export function avanzamentoPriorita(
  campate: CampataLavoro[],
  priorita: CampataPriorita,
): AvanzamentoPriorita {
  const set = campate.filter((c) => c.tipo !== "base" && c.priorita === priorita);
  return {
    priorita,
    totale: set.length,
    tagliate: set.filter((c) => c.stato === "tagliata").length,
    daTagliare: set.filter((c) => c.stato === "da_tagliare").length,
    tralasciate: set.filter((c) => c.stato === "tralasciata").length,
  };
}

export type BasiPerLinea = {
  lineaId: string;
  codiceLinea: string;
  nomeLinea: string;
  tagliate: number;
};

export function conteggioBasiTagliate(campate: CampataLavoro[], mese?: string) {
  const basi = campate.filter((c) => c.tipo === "base" && c.stato === "tagliata");
  const nelMese = mese
    ? basi.filter((c) => c.dataTaglio && c.dataTaglio.slice(0, 7) === mese)
    : basi;
  const perLineaMap = new Map<string, BasiPerLinea>();
  for (const c of nelMese) {
    const voce = perLineaMap.get(c.lineaId) ?? {
      lineaId: c.lineaId,
      codiceLinea: c.codiceLinea,
      nomeLinea: c.nomeLinea,
      tagliate: 0,
    };
    voce.tagliate += 1;
    perLineaMap.set(c.lineaId, voce);
  }
  const perLinea = [...perLineaMap.values()].sort(
    (a, b) => b.tagliate - a.tagliate || a.codiceLinea.localeCompare(b.codiceLinea, "it"),
  );
  return { totale: nelMese.length, perLinea };
}

export function formatEuro(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export function formatQuantita(n: number) {
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}
