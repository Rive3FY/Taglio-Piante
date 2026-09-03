"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { addLinea, removeLinea } from "@/lib/linee";
import { tensioneLabel, tensioneLinea } from "@/lib/format";

export default function AnagrafichePage() {
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const ditte = useLiveQuery(() => db.ditte.toArray(), []) ?? [];
  const prestazioni = useLiveQuery(
    () => db.prestazioni.toArray().then((lista) =>
      [...lista].sort((a, b) => a.codice.localeCompare(b.codice, "it", { numeric: true })),
    ),
    [],
  ) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];

  const [codice, setCodice] = useState("");
  const [nome, setNome] = useState("");
  const [cerca, setCerca] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const usoPerLinea = useMemo(() => {
    const mappa = new Map<string, number>();
    for (const r of rapportini) mappa.set(r.lineaId, (mappa.get(r.lineaId) ?? 0) + 1);
    return mappa;
  }, [rapportini]);

  const lineeFiltrate = useMemo(() => {
    const term = cerca.trim().toLowerCase();
    const lista = [...linee].sort((a, b) => a.codice.localeCompare(b.codice, "it"));
    if (!term) return lista;
    return lista.filter(
      (l) => l.codice.toLowerCase().includes(term) || l.nome.toLowerCase().includes(term),
    );
  }, [linee, cerca]);

  const tensioneNuova = useMemo(() => {
    const pulito = codice.trim().toUpperCase();
    if (pulito.length < 2) return undefined;
    return tensioneLinea({ id: "", codice: pulito, nome: "" });
  }, [codice]);

  async function esegui(action: () => Promise<void>, messaggio: string) {
    setBusy(true);
    setErrore(null);
    setInfo(null);
    try {
      await action();
      setInfo(messaggio);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Database</h2>

      <section className="panel">
        <h2>Nuova linea</h2>
        <div className="inline-form">
          <label>
            Codice
            <input
              value={codice}
              onChange={(e) => setCodice(e.target.value.toUpperCase())}
              placeholder="Es. 23571F1"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <label>
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Airola - Montesarchio"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !codice.trim() || !nome.trim()}
            onClick={() =>
              void esegui(async () => {
                await addLinea({ codice, nome });
                setCodice("");
                setNome("");
              }, "Linea aggiunta.")
            }
          >
            {busy ? "Salvataggio…" : "Aggiungi"}
          </button>
        </div>
        <p className="muted">
          {tensioneNuova
            ? `Con questo codice la linea risulta a ${tensioneLabel(tensioneNuova)}.`
            : "La tensione si ricava dalle prime due cifre: 21 → 380 kV, 22 → 220 kV, 23 → 150 kV, 24 → 60 kV."}
        </p>
        {errore ? <p className="form-error">{errore}</p> : null}
        {info ? <p className="muted">{info}</p> : null}
      </section>

      <section className="panel">
        <h2>Linee ({linee.length})</h2>
        <label>
          Cerca
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Codice o nome" />
        </label>
        {lineeFiltrate.length === 0 ? (
          <p className="muted">Nessuna linea trovata.</p>
        ) : (
          <ul className="anagrafica-list">
            {lineeFiltrate.map((l) => {
              const kv = tensioneLinea(l);
              const usata = usoPerLinea.get(l.id) ?? 0;
              return (
                <li key={l.id}>
                  <span className="linea-codice">{l.codice}</span>
                  {kv ? <span className={`kv-badge kv-${kv}`}>{tensioneLabel(kv)}</span> : null}
                  <span className="linea-nome">{l.nome}</span>
                  <span className="anagrafica-azioni">
                    {usata > 0 ? (
                      <span className="muted">{usata} rapportini</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => {
                          const ok = window.confirm(`Eliminare la linea ${l.codice}?`);
                          if (!ok) return;
                          void esegui(() => removeLinea(l.id), `Linea ${l.codice} eliminata.`);
                        }}
                      >
                        Elimina
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Ditte ({ditte.length})</h2>
        {ditte.map((d) => (
          <div key={d.id} className="rap-card-meta">
            <strong>{d.ragioneSociale}</strong>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Prestazioni ({prestazioni.length})</h2>
        {prestazioni.map((p) => (
          <div key={p.id} className="rap-card-meta">
            <strong>{p.codice}</strong>
            <span>{p.descrizione}</span>
            <span>{p.unitaMisura}</span>
          </div>
        ))}
      </section>
    </>
  );
}
