"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDate, lineaDescrizione } from "@/lib/format";
import { downloadOfficialScheda } from "@/lib/fillScheda";
import { eLavoroBasi, numeriDaTestoCampata } from "@/lib/campate/basi";
import type { Linea, Prestazione, Rapportino } from "@/lib/types";
import { LineaPicker } from "./LineaPicker";
import { ANTEPRIMA_ELENCO, MostraAltro } from "./MostraAltro";
import { RapportinoCard } from "./RapportinoCard";

type Gruppo = {
  lineaId: string;
  linea?: Linea;
  items: Rapportino[];
};

function etichetteDaFogli(items: Rapportino[], prestazioni: Prestazione[]) {
  const campate: string[] = [];
  const basi: string[] = [];
  const vistiC = new Set<string>();
  const vistiB = new Set<string>();
  const metti = (lista: string[], visti: Set<string>, nome: string) => {
    if (!nome || visti.has(nome)) return;
    visti.add(nome);
    lista.push(nome);
  };
  for (const r of items) {
    const comeBasi = eLavoroBasi(r.campata ?? "", r, prestazioni);
    const esiti = r.esitiCampate ?? [];
    if (esiti.length > 0) {
      for (const e of esiti) {
        const nome = (e.normalizzata || e.originale || "").trim();
        if (e.tipo === "base" || comeBasi) metti(basi, vistiB, nome);
        else metti(campate, vistiC, nome);
      }
      continue;
    }
    const testo = (r.campata ?? "").trim();
    if (!testo) continue;
    if (comeBasi) {
      for (const n of numeriDaTestoCampata(testo)) metti(basi, vistiB, n);
    } else {
      metti(campate, vistiC, testo);
    }
  }
  return { campate, basi };
}

function vociDaFogli(items: Rapportino[], prestazioni: Prestazione[]) {
  const byId = new Map(prestazioni.map((p) => [p.id, p]));
  const qty = new Map<string, number>();
  for (const r of items) {
    for (const riga of r.righe ?? []) {
      if (!riga.quantita) continue;
      qty.set(riga.prestazioneId, (qty.get(riga.prestazioneId) ?? 0) + riga.quantita);
    }
  }
  return [...qty.entries()]
    .map(([id, quantita]) => {
      const p = byId.get(id);
      return {
        id,
        codice: p?.codice ?? "?",
        quantita,
      };
    })
    .sort((a, b) => a.codice.localeCompare(b.codice, "it", { numeric: true }));
}

function elenca(nomi: string[], max = 8) {
  if (nomi.length <= max) return nomi.join(", ");
  return `${nomi.slice(0, max).join(", ")} +${nomi.length - max}`;
}

export function ArchivioPerLinea({
  items,
  linee,
  hrefFor,
  vuoto,
  onDelete,
}: {
  items: Rapportino[];
  linee: Linea[];
  hrefFor: (item: Rapportino) => string;
  vuoto: string;
  onDelete?: (item: Rapportino) => void;
}) {
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];
  const [cerca, setCerca] = useState("");
  const [cercataId, setCercataId] = useState("");
  const [aperta, setAperta] = useState<string | null>(null);
  const [mostraAltreLinee, setMostraAltreLinee] = useState(false);
  const [mostraTuttiFogli, setMostraTuttiFogli] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const gruppi = useMemo(() => {
    const byId = new Map(linee.map((l) => [l.id, l]));
    const map = new Map<string, Gruppo>();
    for (const r of items) {
      const g = map.get(r.lineaId) ?? { lineaId: r.lineaId, linea: byId.get(r.lineaId), items: [] };
      g.linea = g.linea ?? byId.get(r.lineaId);
      g.items.push(r);
      map.set(r.lineaId, g);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        items: [...g.items].sort(
          (a, b) =>
            b.dataLavoro.localeCompare(a.dataLavoro) || b.updatedAt.localeCompare(a.updatedAt),
        ),
      }))
      .sort((a, b) => {
        const ac = a.linea?.codice ?? a.lineaId;
        const bc = b.linea?.codice ?? b.lineaId;
        return ac.localeCompare(bc, "it");
      });
  }, [items, linee]);

  const opzioni = useMemo(
    () =>
      gruppi.map((g) => ({
        id: g.lineaId,
        codice: g.linea?.codice ?? g.lineaId,
        nome: g.linea?.nome ?? "Linea",
      })),
    [gruppi],
  );

  const filtrati = useMemo(() => {
    if (cercataId) return gruppi.filter((g) => g.lineaId === cercataId);
    const term = cerca.trim().toLowerCase();
    if (!term) return gruppi;
    return gruppi.filter((g) => {
      const codice = g.linea?.codice ?? "";
      const nome = g.linea?.nome ?? "";
      return codice.toLowerCase().includes(term) || nome.toLowerCase().includes(term);
    });
  }, [gruppi, cerca, cercataId]);

  const visibili = mostraAltreLinee || cercataId ? filtrati : filtrati.slice(0, ANTEPRIMA_ELENCO);

  function apri(lineaId: string) {
    setAperta((cur) => (cur === lineaId ? null : lineaId));
    setMostraTuttiFogli(false);
    setErrore(null);
  }

  async function scaricaUno(item: Rapportino, linea?: Linea) {
    setErrore(null);
    setBusy(item.id);
    try {
      await downloadOfficialScheda({ item, linea, prestazioni });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Download non riuscito.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) return <p className="muted">{vuoto}</p>;

  return (
    <>
      <p className="muted">
        {items.length} {items.length === 1 ? "foglio" : "fogli"} su {gruppi.length}{" "}
        {gruppi.length === 1 ? "linea" : "linee"}. Tocca una linea per vedere cosa hai fatto.
      </p>
      <label className="contab-cerca-linea">
        Cerca linea
        <LineaPicker
          linee={opzioni}
          value={cercataId}
          campo="completa"
          placeholder="Codice o nome linea"
          onQueryChange={(q) => {
            setCerca(q);
            setMostraAltreLinee(false);
          }}
          onChange={(id) => {
            setCercataId(id);
            setAperta(id || null);
            setMostraTuttiFogli(false);
            if (!id) setMostraAltreLinee(false);
          }}
        />
      </label>
      {errore ? <p className="form-error">{errore}</p> : null}
      {filtrati.length === 0 ? (
        <p className="muted">Nessuna linea trovata.</p>
      ) : (
        <div className="contab-linee">
          {visibili.map((g) => {
            const open = aperta === g.lineaId;
            const fogli = open && !mostraTuttiFogli ? g.items.slice(0, ANTEPRIMA_ELENCO) : g.items;
            const { campate, basi } = etichetteDaFogli(g.items, prestazioni);
            const voci = vociDaFogli(g.items, prestazioni);
            const ultima = g.items[0]?.dataLavoro;
            return (
              <section key={g.lineaId} className="panel">
                <button
                  type="button"
                  className="linee-gruppo-head"
                  aria-expanded={open}
                  onClick={() => apri(g.lineaId)}
                >
                  <span className={`chevron ${open ? "giu" : ""}`} aria-hidden="true">
                    ›
                  </span>
                  <strong>
                    {g.linea?.codice ? `${g.linea.codice} · ` : ""}
                    {g.linea ? lineaDescrizione(g.linea) : g.lineaId}
                  </strong>
                  <span className="muted">
                    {g.items.length} {g.items.length === 1 ? "foglio" : "fogli"}
                    {ultima ? ` · ultimo ${formatDate(ultima)}` : ""}
                  </span>
                </button>
                {open ? (
                  <div className="archivio-linea-dettaglio">
                    {campate.length > 0 ? (
                      <p>
                        <strong>Campate</strong> {elenca(campate)}
                      </p>
                    ) : null}
                    {basi.length > 0 ? (
                      <p>
                        <strong>Basi</strong> {elenca(basi)}
                      </p>
                    ) : null}
                    {voci.length > 0 ? (
                      <p>
                        <strong>Chiamate</strong>{" "}
                        {voci.map((v) => `${v.codice} × ${v.quantita}`).join(" · ")}
                      </p>
                    ) : null}
                    {campate.length === 0 && basi.length === 0 && voci.length === 0 ? (
                      <p className="muted">Nessun dettaglio sulle quantità di questi fogli.</p>
                    ) : null}
                    <div className="form-stack">
                      {fogli.map((item) => (
                        <RapportinoCard
                          key={item.id}
                          item={item}
                          linea={g.linea}
                          href={hrefFor(item)}
                          onDelete={onDelete}
                          onDownload={() => void scaricaUno(item, g.linea)}
                          downloadBusy={busy === item.id}
                        />
                      ))}
                    </div>
                    <MostraAltro
                      aperto={mostraTuttiFogli}
                      totale={g.items.length}
                      onToggle={() => setMostraTuttiFogli((v) => !v)}
                    />
                  </div>
                ) : null}
              </section>
            );
          })}
          {!cercataId ? (
            <MostraAltro
              aperto={mostraAltreLinee}
              totale={filtrati.length}
              onToggle={() => setMostraAltreLinee((v) => !v)}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
