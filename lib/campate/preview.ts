import { chiaveCampata } from "./normalize";
import { annoDi, anniTaglioPrecedenti, etichettaAnniTaglio } from "./anno";
import type { CampataLavoro, CampataPriorita } from "@/lib/types";
import type { RigaImportBruta, RigaImportScartata } from "./parse";

export type AzioneImport = "nuova" | "invariata" | "gia_lavorata" | "duplicato";

export type VoceAnteprimaImport = {
  chiave: string;
  originale: string;
  normalizzata: string;
  codiceLinea: string;
  nomeLinea: string;
  priorita: CampataPriorita;
  distInt?: number;
  estInt?: number;
  nordInt?: number;
  azione: AzioneImport;
  nota?: string;
  anniTaglioPrecedenti?: number[];
};

export type AnteprimaImport = {
  voci: VoceAnteprimaImport[];
  scartate: RigaImportScartata[];
  nuove: number;
  esistenti: number;
  duplicati: number;
  doppiaPriorita: number;
  giaLavorate: number;
  giaTagliateAnniScorsi: number;
  lineeNuove: string[];
};

export function costruisciAnteprima(
  righe: RigaImportBruta[],
  scartate: RigaImportScartata[],
  esistenti: CampataLavoro[],
  codiciLineaNoti: Set<string>,
  annoPiano: number,
): AnteprimaImport {
  const listaRighe = Array.isArray(righe) ? righe : [];
  const listaEsistenti = Array.isArray(esistenti) ? esistenti : [];
  const perChiave = new Map<string, VoceAnteprimaImport>();
  let duplicati = 0;

  for (const r of listaRighe) {
    const chiave = chiaveCampata(r.codiceLinea, r.normalizzata, r.priorita);
    const gia = perChiave.get(chiave);
    if (gia) {
      duplicati += 1;
      perChiave.set(chiave, {
        ...gia,
        distInt: gia.distInt ?? r.distInt,
        estInt: gia.estInt ?? r.estInt,
        nordInt: gia.nordInt ?? r.nordInt,
        azione: "duplicato",
        nota: "Stessa linea, campata e priorità ripetuta nel file: si importa una sola volta.",
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
      distInt: r.distInt,
      estInt: r.estInt,
      nordInt: r.nordInt,
      azione: "nuova",
    });
  }

  const coppie = new Set<string>();
  const viste = new Map<string, CampataPriorita>();
  for (const voce of perChiave.values()) {
    const fisica = `${voce.codiceLinea}|${voce.normalizzata}`;
    const altra = viste.get(fisica);
    if (altra && altra !== voce.priorita) {
      coppie.add(fisica);
      voce.nota = `Stessa campata presente anche come ${altra.toUpperCase()}: restano due interventi distinti.`;
    } else {
      viste.set(fisica, voce.priorita);
    }
  }
  for (const voce of perChiave.values()) {
    const fisica = `${voce.codiceLinea}|${voce.normalizzata}`;
    if (!coppie.has(fisica) || voce.nota) continue;
    voce.nota = "Stessa campata con l’altra priorità: restano due interventi distinti.";
  }

  const delloStessoAnno = listaEsistenti.filter((c) => c.tipo !== "base" && annoDi(c) === annoPiano);
  const indiceEsistenti = new Map(
    delloStessoAnno.map((c) => [chiaveCampata(c.codiceLinea, c.normalizzata, c.priorita), c]),
  );
  const lineeNuove = new Set<string>();

  for (const voce of perChiave.values()) {
    if (!codiciLineaNoti.has(voce.codiceLinea)) lineeNuove.add(voce.codiceLinea);
    const presente = indiceEsistenti.get(voce.chiave);
    if (presente) {
      if (presente.stato !== "da_tagliare") {
        voce.azione = "gia_lavorata";
        voce.nota = `Già ${presente.stato.replace("_", " ")} in questo piano: stato e storico restano se aggiorni solo le distanze.`;
      } else if (
        (voce.distInt != null && presente.distInt !== voce.distInt) ||
        (voce.estInt != null && presente.estInt !== voce.estInt) ||
        (voce.nordInt != null && presente.nordInt !== voce.nordInt)
      ) {
        voce.azione = "invariata";
        voce.nota =
          presente.distInt == null && presente.estInt == null
            ? "Aggiorna distanza e coordinate dal file."
            : "Aggiorna distanza e dati dal file.";
      } else {
        voce.azione = "invariata";
      }
    }
    const anni = anniTaglioPrecedenti(listaEsistenti, voce.codiceLinea, voce.normalizzata, annoPiano);
    if (anni.length === 0) continue;
    voce.anniTaglioPrecedenti = anni;
    const badge = `${etichettaAnniTaglio(anni)}: resta da tagliare in questo piano.`;
    voce.nota = voce.nota ? `${voce.nota} ${badge}` : badge;
  }

  const voci = [...perChiave.values()].sort(
    (a, b) =>
      a.codiceLinea.localeCompare(b.codiceLinea, "it") ||
      a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }) ||
      a.priorita.localeCompare(b.priorita),
  );

  return {
    voci,
    scartate,
    nuove: voci.filter((v) => !indiceEsistenti.has(v.chiave)).length,
    esistenti: voci.filter((v) => indiceEsistenti.has(v.chiave)).length,
    duplicati,
    doppiaPriorita: coppie.size,
    giaLavorate: voci.filter((v) => v.azione === "gia_lavorata").length,
    giaTagliateAnniScorsi: voci.filter((v) => (v.anniTaglioPrecedenti?.length ?? 0) > 0).length,
    lineeNuove: [...lineeNuove].sort(),
  };
}

/** Campate già in elenco a cui il file può attaccare Dist int, senza reimportare. */
export function conteggioDistanzeDaFile(
  voci: VoceAnteprimaImport[],
  esistenti: CampataLavoro[],
  annoPiano: number,
) {
  const indice = new Map(
    esistenti
      .filter((c) => c.tipo !== "base" && annoDi(c) === annoPiano)
      .map((c) => [chiaveCampata(c.codiceLinea, c.normalizzata, c.priorita), c]),
  );
  let nelFile = 0;
  let aggiornabili = 0;
  for (const voce of voci) {
    if (voce.azione === "duplicato") continue;
    if (voce.distInt == null && voce.estInt == null) continue;
    nelFile += 1;
    const presente = indice.get(voce.chiave);
    if (!presente) continue;
    if (
      (voce.distInt != null && presente.distInt !== voce.distInt) ||
      (voce.estInt != null && presente.estInt !== voce.estInt) ||
      (voce.nordInt != null && presente.nordInt !== voce.nordInt)
    ) {
      aggiornabili += 1;
    }
  }
  return { nelFile, aggiornabili };
}
