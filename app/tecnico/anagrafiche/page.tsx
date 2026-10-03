"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { addLinea, aggiornaLinea, removeLinea } from "@/lib/linee";
import { tensioneDaCodice, tensioneLabel, tensioneLinea } from "@/lib/format";
import { mostraEsito } from "@/lib/esitoSalvataggio";

function testoUsoLinea(rapportini: number, campate: number) {
  const parti: string[] = [];
  if (rapportini > 0) parti.push(`${rapportini} ${rapportini === 1 ? "rapportino" : "rapportini"}`);
  if (campate > 0) parti.push(`${campate} ${campate === 1 ? "campata" : "campate"}`);
  return parti.join(" · ");
}

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
  const campatePerLinea = useLiveQuery(async () => {
    const mappa = new Map<string, number>();
    await db.campateLavoro.orderBy("lineaId").each((c) => {
      mappa.set(c.lineaId, (mappa.get(c.lineaId) ?? 0) + 1);
    });
    return mappa;
  }, []) ?? new Map<string, number>();

  const [codice, setCodice] = useState("");
  const [nome, setNome] = useState("");
  const [cerca, setCerca] = useState("");
  const [modifica, setModifica] = useState<{ id: string; codice: string; nome: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [erroreDove, setErroreDove] = useState<"nuova" | "elenco" | null>(null);

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

  const tensioneModifica = useMemo(() => {
    if (!modifica) return undefined;
    const pulito = modifica.codice.trim().toUpperCase();
    if (pulito.length < 2) return undefined;
    return tensioneDaCodice(pulito) ?? linee.find((l) => l.id === modifica.id)?.tensioneKv;
  }, [modifica, linee]);

  async function esegui(
    action: () => Promise<void>,
    esito: { titolo: string; testo: string },
    dove: "nuova" | "elenco",
  ) {
    setBusy(true);
    setErrore(null);
    setErroreDove(null);
    try {
      await action();
      mostraEsito({ ...esito, dopo: "resta" });
    } catch (e) {
      setErroreDove(dove);
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
              }, {
                titolo: "Linea aggiunta",
                testo: "La nuova linea è in elenco e disponibile nei rapportini.",
              }, "nuova")
            }
          >
            {busy ? "Salvataggio…" : "Aggiungi"}
          </button>
        </div>
        {tensioneNuova ? (
          <p className="muted">Con questo codice la linea risulta a {tensioneLabel(tensioneNuova)}.</p>
        ) : null}
        {errore && erroreDove === "nuova" ? <p className="form-error">{errore}</p> : null}
      </section>

      <section className="panel">
        <h2>Linee ({linee.length})</h2>
        {errore && erroreDove === "elenco" ? <p className="form-error">{errore}</p> : null}
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
              const nCampate = campatePerLinea.get(l.id) ?? 0;
              const inModifica = modifica?.id === l.id;
              const uso = testoUsoLinea(usata, nCampate);
              return (
                <li key={l.id} className={inModifica ? "is-edit" : undefined}>
                  {inModifica && modifica ? (
                    <>
                      <div className="anagrafica-edit">
                        <label>
                          Codice
                          <input
                            value={modifica.codice}
                            onChange={(e) =>
                              setModifica({ ...modifica, codice: e.target.value.toUpperCase() })
                            }
                            autoCapitalize="characters"
                            spellCheck={false}
                            aria-label={`Codice di ${l.codice}`}
                          />
                        </label>
                        <label>
                          Nome
                          <input
                            value={modifica.nome}
                            onChange={(e) => setModifica({ ...modifica, nome: e.target.value })}
                            aria-label={`Nome di ${l.codice}`}
                          />
                        </label>
                      </div>
                      {tensioneModifica ? (
                        <p className="muted">
                          Con questo codice la linea risulta a {tensioneLabel(tensioneModifica)}.
                        </p>
                      ) : null}
                      <span className="anagrafica-azioni">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy || !modifica.codice.trim() || !modifica.nome.trim()}
                          onClick={() => {
                            const bozza = modifica;
                            const campateCollegate = nCampate;
                            void esegui(async () => {
                              await aggiornaLinea(bozza.id, { codice: bozza.codice, nome: bozza.nome });
                              setModifica(null);
                            }, {
                              titolo: "Linea aggiornata",
                              testo: campateCollegate > 0
                                ? `${bozza.codice.trim().toUpperCase()} — ${bozza.nome.trim()} è aggiornata. Anche le campate in elenco usano questi dati.`
                                : `${bozza.codice.trim().toUpperCase()} — ${bozza.nome.trim()} è aggiornata.`,
                            }, "elenco");
                          }}
                        >
                          Salva
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => setModifica(null)}
                        >
                          Annulla
                        </button>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="linea-codice">{l.codice}</span>
                      {kv ? <span className={`kv-badge kv-${kv}`}>{tensioneLabel(kv)}</span> : null}
                      <span className="linea-nome">{l.nome}</span>
                      <span className="anagrafica-azioni">
                        {uso ? <span className="muted">{uso}</span> : null}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => {
                            setErrore(null);
                            setErroreDove(null);
                            setModifica({ id: l.id, codice: l.codice, nome: l.nome });
                          }}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={() => {
                            if (usata > 0 || nCampate > 0) {
                              const parti = [
                                usata > 0 ? `${usata} ${usata === 1 ? "rapportino" : "rapportini"}` : null,
                                nCampate > 0 ? `${nCampate} ${nCampate === 1 ? "campata" : "campate"}` : null,
                              ].filter(Boolean);
                              setErroreDove("elenco");
                              setErrore(
                                `Questa linea ha ${parti.join(" e ")}: non si può eliminare finché restano.`,
                              );
                              return;
                            }
                            const ok = window.confirm(`Eliminare la linea ${l.codice} (${l.nome})?`);
                            if (!ok) return;
                            void esegui(() => removeLinea(l.id), {
                              titolo: "Linea eliminata",
                              testo: `La linea ${l.codice} non è più in elenco.`,
                            }, "elenco");
                          }}
                        >
                          Elimina
                        </button>
                      </span>
                    </>
                  )}
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
