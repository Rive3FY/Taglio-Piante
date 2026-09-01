import { chiaveCampata } from "./normalize";
import type { CampataLavoro, CampataPriorita } from "@/lib/types";
import type { RigaImportBruta, RigaImportScartata } from "./parse";

export type AzioneImport =
  | "nuova"
  | "invariata"
  | "priorita"
  | "gia_lavorata"
  | "duplicato";

export type VoceAnteprimaImport = {
  chiave: string;
  originale: string;
  normalizzata: string;
  codiceLinea: string;
  nomeLinea: string;
  priorita: CampataPriorita;
  azione: AzioneImport;
  nota?: string;
};

export type AnteprimaImport = {
  voci: VoceAnteprimaImport[];
  scartate: RigaImportScartata[];
  nuove: number;
  esistenti: number;
  duplicati: number;
  prioritaAggiornata: number;
  giaLavorate: number;
  lineeNuove: string[];
};

const PESI: Record<CampataPriorita, number> = { differibile: 1, urgente: 2 };

function prioritaVince(a: CampataPriorita, b: CampataPriorita) {
  return PESI[a] >= PESI[b] ? a : b;
}

export function costruisciAnteprima(
  righe: RigaImportBruta[],
  scartate: RigaImportScartata[],
  esistenti: CampataLavoro[],
  codiciLineaNoti: Set<string>,
): AnteprimaImport {
  const perChiave = new Map<string, VoceAnteprimaImport>();
  let duplicati = 0;

  for (const r of righe) {
    const chiave = chiaveCampata(r.codiceLinea, r.normalizzata);
    const gia = perChiave.get(chiave);
    if (gia) {
      duplicati += 1;
      const priorita = prioritaVince(gia.priorita, r.priorita);
      perChiave.set(chiave, {
        ...gia,
        priorita,
        azione: "duplicato",
        nota:
          gia.priorita !== r.priorita
            ? `Stessa campata più volte nel file: si tiene ${priorita.toUpperCase()}.`
            : "Riga ripetuta nel file, ignorata in importazione.",
      });
      continue;
    }
    perChiave.set(chiave, {
      chiave,
      originale: r.originale,
      normalizzata: r.normalizzata,
      codiceLinea: r.codiceLinea,
      nomeLinea: r.nomeLinea,
      priorita: r.priorita,
      azione: "nuova",
    });
  }

  const indiceEsistenti = new Map(esistenti.map((c) => [chiaveCampata(c.codiceLinea, c.normalizzata), c]));
  const lineeNuove = new Set<string>();

  for (const voce of perChiave.values()) {
    if (!codiciLineaNoti.has(voce.codiceLinea)) lineeNuove.add(voce.codiceLinea);
    const presente = indiceEsistenti.get(voce.chiave);
    if (!presente) {
      if (voce.azione !== "duplicato") voce.azione = "nuova";
      continue;
    }
    if (presente.stato !== "da_tagliare") {
      voce.azione = "gia_lavorata";
      voce.nota = `Già ${presente.stato.replace("_", " ")}: lo stato e lo storico restano, si aggiorna solo la priorità se serve.`;
      continue;
    }
    if (presente.priorita && presente.priorita !== voce.priorita) {
      voce.azione = "priorita";
      voce.nota = `Priorità da ${presente.priorita} a ${voce.priorita}.`;
    } else {
      voce.azione = "invariata";
    }
  }

  const voci = [...perChiave.values()].sort((a, b) =>
    a.codiceLinea.localeCompare(b.codiceLinea, "it") ||
    a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }),
  );

  return {
    voci,
    scartate,
    nuove: voci.filter((v) => !indiceEsistenti.has(v.chiave)).length,
    esistenti: voci.filter((v) => indiceEsistenti.has(v.chiave)).length,
    duplicati,
    prioritaAggiornata: voci.filter((v) => v.azione === "priorita").length,
    giaLavorate: voci.filter((v) => v.azione === "gia_lavorata").length,
    lineeNuove: [...lineeNuove].sort(),
  };
}
