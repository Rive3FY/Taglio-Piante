"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDate, lineaDescrizione } from "@/lib/format";
import { downloadOfficialScheda, downloadOfficialSchede } from "@/lib/fillScheda";
import { eLavoroBasi, etichettaOggettoFoglio, numeriDaTestoCampata } from "@/lib/campate/basi";
import { useDialogBack } from "@/lib/useDialogBack";
import type { Linea, Prestazione, Rapportino } from "@/lib/types";
import { LineaPicker } from "./LineaPicker";
import { ANTEPRIMA_ELENCO, MostraAltro } from "./MostraAltro";
import { haFirmaDitta } from "@/lib/rapportinoFirma";
import { mostraEsito } from "@/lib/esitoSalvataggio";
import { FirmaDittaOverlay } from "./FirmaDittaOverlay";
import { RapportinoCard } from "./RapportinoCard";
import { RapportinoSheet } from "./RapportinoSheet";

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

function vociAnteprima(item: Rapportino, prestazioni: Prestazione[]) {
  const byId = new Map(prestazioni.map((p) => [p.id, p]));
  return (item.righe ?? [])
    .filter((r) => r.quantita)
    .map((r) => {
      const p = byId.get(r.prestazioneId);
      return `${p?.codice ?? "?"} × ${r.quantita}`;
    })
    .slice(0, 4);
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
  const [scelti, setScelti] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [firmaId, setFirmaId] = useState<string | null>(null);
  const [dockReady, setDockReady] = useState(false);

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

  useEffect(() => setDockReady(true), []);
  useDialogBack(Boolean(previewId), () => setPreviewId(null));

  const gruppoAperto = gruppi.find((g) => g.lineaId === aperta);
  const preview = gruppoAperto?.items.find((r) => r.id === previewId)
    ?? items.find((r) => r.id === previewId);
  const previewLinea = preview
    ? linee.find((l) => l.id === preview.lineaId) ?? gruppoAperto?.linea
    : undefined;
  const daFirmare = gruppoAperto?.items.find((r) => r.id === firmaId)
    ?? items.find((r) => r.id === firmaId);
  const daFirmareLinea = daFirmare
    ? linee.find((l) => l.id === daFirmare.lineaId) ?? gruppoAperto?.linea
    : undefined;

  function apri(lineaId: string) {
    setAperta((cur) => (cur === lineaId ? null : lineaId));
    setMostraTuttiFogli(false);
    setScelti([]);
    setErrore(null);
  }

  function toggleScelto(id: string) {
    setScelti((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function chiudiPreview() {
    setPreviewId(null);
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

  async function scaricaInsieme(lista: Rapportino[], linea?: Linea) {
    if (lista.length === 0) return;
    setErrore(null);
    setBusy("insieme");
    try {
      const codice = linea?.codice ?? "linea";
      await downloadOfficialSchede(
        lista.map((item) => ({ item, linea })),
        `Schede_${codice}_${lista.length}fogli.pdf`,
        prestazioni,
      );
      mostraEsito({
        titolo: "PDF pronto",
        testo:
          lista.length === 1
            ? "Il foglio ufficiale è stato scaricato."
            : `Scaricati ${lista.length} fogli in un unico PDF.`,
        dopo: "resta",
      });
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
      <div className="cerca-e-linee">
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
            setScelti([]);
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
                    <div className="archivio-azioni">
                      <label className="check-line">
                        <input
                          type="checkbox"
                          checked={g.items.length > 0 && g.items.every((r) => scelti.includes(r.id))}
                          onChange={() =>
                            setScelti(
                              g.items.every((r) => scelti.includes(r.id))
                                ? []
                                : g.items.map((r) => r.id),
                            )
                          }
                        />
                        {g.items.every((r) => scelti.includes(r.id))
                          ? "Togli selezione"
                          : "Seleziona tutti"}
                      </label>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy !== null || scelti.length === 0}
                        onClick={() =>
                          void scaricaInsieme(
                            g.items.filter((r) => scelti.includes(r.id)),
                            g.linea,
                          )
                        }
                      >
                        {busy === "insieme"
                          ? "Preparazione PDF…"
                          : scelti.length === 0
                            ? "Scarica selezionati"
                            : `Scarica selezionati (${scelti.length})`}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy !== null || g.items.length === 0}
                        onClick={() => void scaricaInsieme(g.items, g.linea)}
                      >
                        {busy === "insieme" ? "Preparazione PDF…" : `Scarica tutti (${g.items.length})`}
                      </button>
                    </div>
                    <div className="form-stack">
                      {fogli.map((item) => {
                        const anteprime = vociAnteprima(item, prestazioni);
                        const oggetto = etichettaOggettoFoglio(item, prestazioni);
                        return (
                          <div key={item.id} className="archivio-riga">
                            <input
                              type="checkbox"
                              checked={scelti.includes(item.id)}
                              onChange={() => toggleScelto(item.id)}
                              aria-label={`Seleziona ${item.numero}`}
                            />
                            <RapportinoCard
                              item={item}
                              linea={g.linea}
                              href={hrefFor(item)}
                              onApri={() => setPreviewId(item.id)}
                              onDelete={onDelete}
                              onDownload={() => void scaricaUno(item, g.linea)}
                              downloadBusy={busy === item.id}
                            />
                            <button
                              type="button"
                              className="archivio-anteprima"
                              onClick={() => setPreviewId(item.id)}
                            >
                              <span className="archivio-anteprima-kicker">Anteprima</span>
                              <strong>{item.numero}</strong>
                              <span>{formatDate(item.dataLavoro)}</span>
                              {oggetto ? <span>{oggetto}</span> : null}
                              {anteprime.length > 0 ? <span>{anteprime.join(" · ")}</span> : null}
                            </button>
                          </div>
                        );
                      })}
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
      </div>
      {dockReady && preview
        ? createPortal(
            <div
              className="scheda-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={`Rapportino ${preview.numero}`}
            >
              <div className="scheda-overlay-bar">
                {haFirmaDitta(preview.firmaOperatore) ? null : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setFirmaId(preview.id);
                      setPreviewId(null);
                    }}
                  >
                    Firma ditta
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={chiudiPreview}>
                  Chiudi
                </button>
              </div>
              <RapportinoSheet item={preview} linea={previewLinea} prestazioni={prestazioni} />
            </div>,
            document.body,
          )
        : null}
      {dockReady && daFirmare ? (
        <FirmaDittaOverlay
          item={daFirmare}
          linea={daFirmareLinea}
          onChiudi={() => setFirmaId(null)}
        />
      ) : null}
    </>
  );
}
