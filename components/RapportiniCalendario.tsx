"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { etichettaMese, mesiDisponibili } from "@/lib/contabilita/aggrega";
import { formatDate, todayIso } from "@/lib/format";
import { downloadOfficialScheda, downloadOfficialSchede } from "@/lib/fillScheda";
import { mostraEsito } from "@/lib/esitoSalvataggio";
import { CalendarioMese } from "./CalendarioMese";
import { RapportinoCard } from "./RapportinoCard";
import type { Linea, Rapportino } from "@/lib/types";

export function RapportiniCalendario({
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
  const oggi = todayIso();
  const mesi = useMemo(() => mesiDisponibili(items), [items]);
  const [mese, setMese] = useState(() => oggi.slice(0, 7));
  const [giorno, setGiorno] = useState<string | null>(oggi);
  const [busy, setBusy] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const meseEffettivo = mesi.includes(mese) ? mese : (mesi[0] ?? oggi.slice(0, 7));
  const lineaDi = useMemo(() => new Map(linee.map((l) => [l.id, l])), [linee]);

  const delMese = useMemo(
    () => items.filter((r) => r.dataLavoro?.startsWith(meseEffettivo)),
    [items, meseEffettivo],
  );

  const conteggi = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of delMese) {
      m.set(r.dataLavoro, (m.get(r.dataLavoro) ?? 0) + 1);
    }
    return m;
  }, [delMese]);

  const delGiorno = useMemo(
    () =>
      (giorno ? delMese.filter((r) => r.dataLavoro === giorno) : []).sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.numero.localeCompare(b.numero, "it"),
      ),
    [delMese, giorno],
  );

  async function scaricaUno(item: Rapportino) {
    setErrore(null);
    setBusy(item.id);
    try {
      await downloadOfficialScheda({
        item,
        linea: lineaDi.get(item.lineaId),
        prestazioni,
      });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Download non riuscito.");
    } finally {
      setBusy(null);
    }
  }

  async function scaricaTutti() {
    if (delGiorno.length === 0 || !giorno) return;
    setErrore(null);
    setBusy("tutti");
    try {
      await downloadOfficialSchede(
        delGiorno.map((item) => ({ item, linea: lineaDi.get(item.lineaId) })),
        `Schede_taglio_${giorno}.pdf`,
        prestazioni,
      );
      mostraEsito({
        titolo: "PDF pronto",
        testo: `Scaricati ${delGiorno.length} fogli del ${formatDate(giorno)}.`,
        dopo: "resta",
      });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Download non riuscito.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="chip-row">
        {mesi.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${meseEffettivo === m ? "on" : ""}`}
            onClick={() => {
              setMese(m);
              setGiorno(m === oggi.slice(0, 7) ? oggi : null);
            }}
          >
            {etichettaMese(m)}
          </button>
        ))}
      </div>

      <section className="panel">
        <h2>Giorno per giorno · {etichettaMese(meseEffettivo)}</h2>
        <CalendarioMese
          mese={meseEffettivo}
          oggi={oggi}
          selezionato={giorno}
          conteggi={conteggi}
          onSelect={(data) => setGiorno(data || null)}
        />
      </section>

      {giorno ? (
        <section className="panel">
          <div className="elenco-head">
            <h2>
              {formatDate(giorno)}
              <span className="muted"> · {delGiorno.length} rapportini</span>
            </h2>
            {delGiorno.length > 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() => void scaricaTutti()}
              >
                {busy === "tutti" ? "Preparazione PDF…" : `Scarica tutti (${delGiorno.length})`}
              </button>
            ) : null}
          </div>
          {errore ? <p className="form-error">{errore}</p> : null}
          {delGiorno.length === 0 ? (
            <p className="muted">{items.length === 0 ? vuoto : "Nessun rapportino in questa data."}</p>
          ) : (
            <div className="form-stack">
              {delGiorno.map((item) => (
                <RapportinoCard
                  key={item.id}
                  item={item}
                  linea={lineaDi.get(item.lineaId)}
                  href={hrefFor(item)}
                  onDelete={onDelete}
                  onDownload={() => void scaricaUno(item)}
                  downloadBusy={busy === item.id}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <p className="muted">Tocca un giorno per vedere i rapportini e scaricare i fogli.</p>
      )}
    </>
  );
}
