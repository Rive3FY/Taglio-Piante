"use client";

import { useEffect, useState } from "react";
import type { Linea, Prestazione, Rapportino } from "@/lib/types";
import { downloadOfficialScheda } from "@/lib/fillScheda";
import { officialSchedaPagine } from "@/lib/renderScheda";
import { StatoBadge } from "./StatusBadge";

function chiaveScheda(item: Rapportino, linea?: Linea, prestazioni: Prestazione[] = []) {
  const qty = (item.righe ?? []).map((r) => `${r.prestazioneId}:${r.quantita}`).join(",");
  return [
    item.id,
    item.updatedAt,
    item.numero,
    item.campata,
    item.dataLavoro,
    item.ditta,
    item.rappresentanteDitta,
    item.dipendenteTerna,
    item.nOperatori,
    item.stato,
    item.firmaOperatore?.length ?? 0,
    item.firmaTerna?.length ?? 0,
    linea?.id ?? "",
    prestazioni.length,
    qty,
  ].join("|");
}

export function RapportinoSheet({
  item,
  linea,
  prestazioni,
}: {
  item: Rapportino;
  linea?: Linea;
  prestazioni: Prestazione[];
}) {
  const [pagine, setPagine] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chiave = chiaveScheda(item, linea, prestazioni);

  useEffect(() => {
    let revoked: string[] = [];
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const next = await officialSchedaPagine({ item, linea, prestazioni });
        if (cancelled) {
          next.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        revoked = next;
        setPagine(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Errore nel foglio.");
      }
    })();
    return () => {
      cancelled = true;
      revoked.forEach((u) => URL.revokeObjectURL(u));
    };
    // item/linea/prestazioni si rileggono da Dexie: la chiave evita di rifare il PDF a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave]);

  async function download() {
    setBusy(true);
    try {
      await downloadOfficialScheda({ item, linea, prestazioni });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-wrap">
      <div className="sheet-toolbar">
        <StatoBadge stato={item.stato} />
        <button type="button" className="btn btn-primary" onClick={() => void download()} disabled={busy}>
          {busy ? "Preparazione PDF…" : "Download foglio ufficiale"}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {pagine.length === 0 && !error ? <p className="muted">Preparazione anteprima…</p> : null}
      <div className="scheda-pagine">
        {pagine.map((src, i) => (
          <img key={src} src={src} alt={`Foglio ufficiale pagina ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
