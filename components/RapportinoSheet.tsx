"use client";

import { useEffect, useState } from "react";
import type { Linea, Prestazione, Rapportino } from "@/lib/types";
import { downloadOfficialScheda, officialSchedaObjectUrl } from "@/lib/fillScheda";
import { StatoBadge } from "./StatusBadge";

export function RapportinoSheet({
  item,
  linea,
  prestazioni,
}: {
  item: Rapportino;
  linea?: Linea;
  prestazioni: Prestazione[];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const next = await officialSchedaObjectUrl({ item, linea, prestazioni });
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        revoked = next;
        setUrl(next);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Errore nel foglio.");
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [item, linea, prestazioni]);

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
      {url ? (
        <iframe title="Foglio ufficiale scheda taglio piante" className="scheda-frame" src={url} />
      ) : (
        <p className="muted">Preparazione foglio ufficiale…</p>
      )}
    </div>
  );
}
