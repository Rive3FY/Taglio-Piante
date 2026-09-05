"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/contabilita/aggrega";
import {
  LISTINO,
  etichettaUnita,
  listinoDiversoDalContratto,
  listinoEffettivo,
  parsePrezzo,
  ripristinaListinoContratto,
  salvaListino,
} from "@/lib/contabilita/listino";
import { mostraEsito } from "@/lib/esitoSalvataggio";

export default function PrezziPage() {
  const prestazioni =
    useLiveQuery(
      () =>
        db.prestazioni
          .toArray()
          .then((lista) => [...lista].sort((a, b) => a.codice.localeCompare(b.codice, "it", { numeric: true }))),
      [],
    ) ?? [];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener("listino-aggiornato", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("listino-aggiornato", on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const listino = useMemo(() => listinoEffettivo(), [tick]);
  const modificato = listinoDiversoDalContratto();

  useEffect(() => {
    const next: Record<string, string> = {};
    const codici = new Set([...Object.keys(LISTINO), ...prestazioni.map((p) => p.codice)]);
    for (const codice of [...codici].sort((a, b) => a.localeCompare(b, "it", { numeric: true }))) {
      const n = listino[codice];
      next[codice] = n == null ? "" : String(n).replace(".", ",");
    }
    setDraft(next);
  }, [prestazioni, listino]);

  const righe = useMemo(() => {
    const byCodice = new Map(prestazioni.map((p) => [p.codice, p]));
    return Object.keys(draft).map((codice) => {
      const p = byCodice.get(codice);
      return {
        codice,
        descrizione: p?.descrizione ?? "Voce di listino",
        unita: etichettaUnita(p?.unitaMisura ?? ""),
        contratto: LISTINO[codice],
        diverso: parsePrezzo(draft[codice] ?? "") !== (LISTINO[codice] ?? null),
      };
    });
  }, [draft, prestazioni]);

  function salva() {
    setBusy(true);
    setErrore(null);
    try {
      const prezzi: Record<string, number> = {};
      for (const [codice, raw] of Object.entries(draft)) {
        const n = parsePrezzo(raw);
        if (n == null) {
          setErrore(`Il prezzo di ${codice} non è valido.`);
          return;
        }
        prezzi[codice] = n;
      }
      salvaListino(prezzi);
      mostraEsito({
        titolo: "Prezzi salvati",
        testo: "La contabilità usa subito i nuovi importi.",
        dopo: "resta",
      });
    } finally {
      setBusy(false);
    }
  }

  function ripristina() {
    if (!window.confirm("Ripristinare i prezzi di contratto su tutte le voci?")) return;
    setErrore(null);
    ripristinaListinoContratto();
    mostraEsito({
      titolo: "Listino ripristinato",
      testo: "Tornano i prezzi di contratto su tutte le voci.",
      dopo: "resta",
    });
  }

  return (
    <>
      <h2>Prezzi</h2>
      <section className="panel">
        <h2>Listino prestazioni</h2>
        <p className="muted">
          Qui cambi i prezzi usati in contabilità. Per le voci in 100 mq il prezzo è ogni 100 mq.
          Restano su questo dispositivo; i rapportini già fatti non si toccano, cambiano solo i
          totali calcolati.
        </p>
        {righe.length === 0 ? (
          <p className="muted">Nessuna prestazione in anagrafica.</p>
        ) : (
          <div className="campate-table-wrap">
            <table className="campate-table">
              <thead>
                <tr>
                  <th>Voce</th>
                  <th>Descrizione</th>
                  <th>U.M.</th>
                  <th>Contratto</th>
                  <th>Prezzo</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.codice} className={r.diverso ? "prezzo-riga-mod" : undefined}>
                    <td>
                      <strong>{r.codice}</strong>
                    </td>
                    <td>{r.descrizione}</td>
                    <td>{r.unita || "—"}</td>
                    <td>{formatEuro(r.contratto ?? null)}</td>
                    <td>
                      <label className="prezzo-label">
                        <input
                          className="prezzo-input"
                          inputMode="decimal"
                          aria-label={`Prezzo ${r.codice}`}
                          value={draft[r.codice] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || /^[0-9]*[.,]?[0-9]{0,2}$/.test(v)) {
                              setDraft((cur) => ({ ...cur, [r.codice]: v }));
                              setErrore(null);
                            }
                          }}
                        />
                        <span className="muted">€</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {errore ? <p className="form-error">{errore}</p> : null}
        <div className="archivio-azioni">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={salva}>
            {busy ? "Salvataggio…" : "Salva prezzi"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || !modificato}
            onClick={ripristina}
          >
            Ripristina contratto
          </button>
        </div>
      </section>
    </>
  );
}
