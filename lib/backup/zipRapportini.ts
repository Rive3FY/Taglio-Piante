"use client";

import JSZip from "jszip";
import { fillOfficialScheda } from "@/lib/fillScheda";
import { scaricaBlob } from "@/lib/download";
import { formatDate, todayIso } from "@/lib/format";
import { etichettaMese, rapportiniDelMese } from "@/lib/contabilita/aggrega";
import { bytesVistaCampate } from "@/lib/campate/export";
import { isBaseLavoro } from "@/lib/campate/basi";
import type { CampataLavoro, Linea, Prestazione, Rapportino } from "@/lib/types";

export type FoglioBackup = {
  item: Rapportino;
  linea?: Linea;
  mese: string;
};

export function fogliPerBackup(rapportini: Rapportino[], linee: Linea[], mesi: string[]) {
  const lineaById = new Map(linee.map((l) => [l.id, l]));
  const fogli: FoglioBackup[] = [];
  for (const mese of [...mesi].sort()) {
    const delMese = rapportiniDelMese(rapportini, mese).sort(
      (a, b) =>
        (a.dataLavoro ?? "").localeCompare(b.dataLavoro ?? "") ||
        a.numero.localeCompare(b.numero, "it"),
    );
    for (const item of delMese) {
      fogli.push({ item, linea: lineaById.get(item.lineaId), mese });
    }
  }
  return fogli;
}

export function anteprimaBackup(fogli: FoglioBackup[]) {
  const mesi = new Map<string, { fogli: number; linee: Set<string> }>();
  for (const f of fogli) {
    const slot = mesi.get(f.mese) ?? { fogli: 0, linee: new Set<string>() };
    slot.fogli += 1;
    slot.linee.add(f.item.lineaId);
    mesi.set(f.mese, slot);
  }
  return [...mesi.entries()].map(([mese, v]) => ({
    mese,
    fogli: v.fogli,
    linee: v.linee.size,
  }));
}

function slugCartella(testo: string) {
  const pulito = testo
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return pulito || "senza-nome";
}

function cartellaMese(mese: string) {
  return slugCartella(`${mese} ${etichettaMese(mese)}`);
}

function cartellaLinea(linea?: Linea, lineaId?: string) {
  if (!linea) return slugCartella(lineaId || "linea-sconosciuta");
  return slugCartella(`${linea.codice} - ${linea.nome}`);
}

function nomePdf(item: Rapportino, linea?: Linea, usati?: Set<string>) {
  const base = `Scheda_taglio_${slugCartella(item.numero)}_${slugCartella(linea?.codice ?? "linea")}`;
  let nome = `${base}.pdf`;
  if (!usati) return nome;
  let n = 2;
  while (usati.has(nome)) {
    nome = `${base}_${n}.pdf`;
    n += 1;
  }
  usati.add(nome);
  return nome;
}

export async function scaricaBackupZip(
  fogli: FoglioBackup[],
  prestazioni: Prestazione[],
  opts?: {
    finoA?: string;
    onProgress?: (fatto: number, totale: number, numero: string) => void;
    campate?: CampataLavoro[];
  },
) {
  if (fogli.length === 0) throw new Error("Nessun rapportino chiuso nei mesi scelti.");

  const zip = new JSZip();
  const usatiPerCartella = new Map<string, Set<string>>();
  let ok = 0;
  let ultimoErrore = "";

  for (let i = 0; i < fogli.length; i += 1) {
    const foglio = fogli[i]!;
    opts?.onProgress?.(i + 1, fogli.length, foglio.item.numero);
    const meseDir = cartellaMese(foglio.mese);
    const lineaDir = cartellaLinea(foglio.linea, foglio.item.lineaId);
    const cartella = `${meseDir}/${lineaDir}`;
    const usati = usatiPerCartella.get(cartella) ?? new Set<string>();
    usatiPerCartella.set(cartella, usati);
    try {
      const bytes = await fillOfficialScheda({
        item: foglio.item,
        linea: foglio.linea,
        prestazioni,
      });
      zip.file(`${cartella}/${nomePdf(foglio.item, foglio.linea, usati)}`, bytes);
      ok += 1;
    } catch (e) {
      ultimoErrore = e instanceof Error ? e.message : "foglio non generato";
    }
    await new Promise((r) => setTimeout(r, 0));
  }

  if (ok === 0) throw new Error(ultimoErrore || "Nessun foglio da mettere nello zip.");

  const finoA = opts?.finoA ?? todayIso();
  const mesi = [...new Set(fogli.map((f) => f.mese))].sort();
  const mesiSet = new Set(mesi);
  const basi = (opts?.campate ?? []).filter(
    (c) => isBaseLavoro(c) && c.stato === "tagliata" && c.dataTaglio && mesiSet.has(c.dataTaglio.slice(0, 7)),
  );
  if (basi.length > 0) {
    zip.file("Basi.xlsx", await bytesVistaCampate(basi));
  }
  const indice = [
    "Backup rapportini taglio piante",
    `Estratto il ${formatDate(finoA)}`,
    `Mesi: ${mesi.map(etichettaMese).join(", ")}`,
    `Fogli nello zip: ${ok} di ${fogli.length}`,
    basi.length > 0
      ? `Basi pulite nei mesi scelti: ${basi.length} in Basi.xlsx`
      : "Nessuna base pulita nei mesi scelti.",
    "Solo rapportini archiviati. Le bozze restano fuori.",
    "Cartelle: mese / linea / PDF del foglio ufficiale. Le basi sono anche in Basi.xlsx.",
  ].join("\n");
  zip.file("backup.txt", indice);

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const slugMesi =
    mesi.length === 1 ? mesi[0] : `${mesi[0]}_al_${mesi[mesi.length - 1]}`;
  scaricaBlob(blob, `backup_rapportini_${slugMesi}.zip`, "application/zip");
  return { ok, totale: fogli.length };
}
