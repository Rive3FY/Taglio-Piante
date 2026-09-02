import type { CampataLavoro, CampataPriorita, Linea, Prestazione, Rapportino } from "@/lib/types";
import { rapportinoEChiuso } from "@/lib/types";
import { arrotondaEuro, importoVoce, prezzoChiamata } from "./listino";

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
    (r) => rapportinoEChiuso(r.stato) && r.dataLavoro && meseDaIso(r.dataLavoro) === mese,
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
      importo: importoVoce(quantita, p.codice, p.unitaMisura),
    });
  }
  for (const [id, quantita] of qty) {
    if (byId.has(id)) continue;
    voci.push({
      prestazioneId: id,
      codice: "?",
      descrizione: "Prestazione non in anagrafica",
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
  return arrotondaEuro(voci.reduce((s, v) => s + (v.importo ?? 0), 0));
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
  const tagliate = set.filter((c) => c.stato === "tagliata" || c.stato === "tralasciata" || c.daNonTagliare).length;
  return {
    priorita,
    totale: set.length,
    tagliate,
    daTagliare: set.length - tagliate,
    tralasciate: 0,
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

export function rapportiniContabiliFinoA(rapportini: Rapportino[], finoA: string) {
  return rapportini.filter(
    (r) => rapportinoEChiuso(r.stato) && r.dataLavoro && r.dataLavoro <= finoA,
  );
}

export function lineeConPrestazioni(
  rapportini: Rapportino[],
  linee: Linea[],
  finoA: string,
) {
  const usati = rapportiniContabiliFinoA(rapportini, finoA);
  const lineeById = new Map(linee.map((l) => [l.id, l]));
  const ids = [...new Set(usati.map((r) => r.lineaId))];
  return ids
    .map((id) => {
      const linea = lineeById.get(id);
      const dellaLinea = usati.filter((r) => r.lineaId === id);
      const ultima = dellaLinea.reduce(
        (max, r) => (r.dataLavoro > max ? r.dataLavoro : max),
        dellaLinea[0]?.dataLavoro ?? "",
      );
      return {
        lineaId: id,
        codiceLinea: linea?.codice ?? id,
        nomeLinea: linea?.nome ?? "Linea",
        rapportini: dellaLinea.length,
        ultimaData: ultima,
      };
    })
    .sort((a, b) => a.codiceLinea.localeCompare(b.codiceLinea, "it"));
}

export function aggregaPrestazioniLinea(
  rapportini: Rapportino[],
  prestazioni: Prestazione[],
  linea: Linea | undefined,
  lineaId: string,
  finoA: string,
): LineaContabile & { ultimaData: string } {
  const items = rapportiniContabiliFinoA(rapportini, finoA).filter((r) => r.lineaId === lineaId);
  const voci = vociDaRapportini(items, prestazioni);
  const ultimaData = items.reduce(
    (max, r) => (r.dataLavoro > max ? r.dataLavoro : max),
    items[0]?.dataLavoro ?? "",
  );
  return {
    lineaId,
    codiceLinea: linea?.codice ?? lineaId,
    nomeLinea: linea?.nome ?? "Linea",
    rapportini: items.length,
    voci,
    importo: sommaImporti(voci),
    ultimaData,
  };
}
