"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  aggregaMese,
  avanzamentoPriorita,
  conteggioBasiTagliate,
  etichettaMese,
  formatEuro,
  formatQuantita,
  giorniAllaChiusura,
  mesiDisponibili,
  type VoceContabile,
} from "@/lib/contabilita/aggrega";
import { etichettaUnita } from "@/lib/contabilita/listino";
import { formatDate, todayIso } from "@/lib/format";
import { TortaAvanzamento } from "@/components/TortaAvanzamento";
import { GraficoBasi } from "@/components/GraficoBasi";
import { CalendarioMese } from "@/components/CalendarioMese";

function TabellaVoci({
  voci,
  vuoto,
  totaleLabel = "Totale",
}: {
  voci: VoceContabile[];
  vuoto: string;
  totaleLabel?: string;
}) {
  if (voci.length === 0) return <p className="muted">{vuoto}</p>;
  const totale = voci.every((v) => v.importo != null)
    ? voci.reduce((s, v) => s + (v.importo ?? 0), 0)
    : null;
  return (
    <div className="campate-table-wrap">
      <table className="campate-table">
        <thead>
          <tr>
            <th>Chiamata</th>
            <th>Descrizione</th>
            <th>U.M.</th>
            <th>Quantità</th>
            <th>Prezzo</th>
            <th>Importo</th>
          </tr>
        </thead>
        <tbody>
          {voci.map((v) => (
            <tr key={v.prestazioneId}>
              <td>
                <strong>{v.codice}</strong>
              </td>
              <td>{v.descrizione}</td>
              <td>{etichettaUnita(v.unitaMisura)}</td>
              <td>{formatQuantita(v.quantita)}</td>
              <td>
                {v.prezzoUnitario == null
                  ? "—"
                  : `${formatEuro(v.prezzoUnitario)} / ${etichettaUnita(v.unitaMisura)}`}
              </td>
              <td>{formatEuro(v.importo)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>{totaleLabel}</td>
            <td>
              <strong>{formatEuro(totale)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function ContabilitaPage() {
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const prestazioni = useLiveQuery(() => db.prestazioni.orderBy("codice").toArray(), []) ?? [];
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const oggi = todayIso();
  const mesi = useMemo(() => mesiDisponibili(rapportini), [rapportini]);
  const [mese, setMese] = useState(() => mesi[0] ?? oggi.slice(0, 7));
  const [giorno, setGiorno] = useState<string | null>(oggi);
  const [lineaAperta, setLineaAperta] = useState<string | null>(null);

  const meseEffettivo = mesi.includes(mese) ? mese : (mesi[0] ?? oggi.slice(0, 7));
  const aggregato = useMemo(
    () => aggregaMese(rapportini, prestazioni, linee, meseEffettivo),
    [rapportini, prestazioni, linee, meseEffettivo],
  );
  const restano = giorniAllaChiusura(meseEffettivo, oggi);
  const urgente = useMemo(() => avanzamentoPriorita(campate, "urgente"), [campate]);
  const differibile = useMemo(() => avanzamentoPriorita(campate, "differibile"), [campate]);
  const basiMese = useMemo(
    () => conteggioBasiTagliate(campate, meseEffettivo),
    [campate, meseEffettivo],
  );
  const conteggiGiorno = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of aggregato.perGiorno) m.set(g.data, g.rapportini);
    return m;
  }, [aggregato.perGiorno]);
  const giornoVoci = aggregato.perGiorno.find((g) => g.data === giorno);

  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Contabilità</h2>
        </div>
      </div>

      {restano != null ? (
        <p className="contab-scadenza">
          {restano === 0
            ? "Oggi è l’ultimo giorno del mese: il report va chiuso."
            : `Mese in corso: mancano ${restano} ${restano === 1 ? "giorno" : "giorni"} alla chiusura del ${formatDate(aggregato.perGiorno.at(-1)?.data ?? "")}.`}
        </p>
      ) : (
        <p className="muted">Stai guardando un mese già chiuso.</p>
      )}

      <div className="chip-row">
        {mesi.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${meseEffettivo === m ? "on" : ""}`}
            onClick={() => {
              setMese(m);
              setGiorno(m === oggi.slice(0, 7) ? oggi : null);
              setLineaAperta(null);
            }}
          >
            {etichettaMese(m)}
          </button>
        ))}
      </div>

      <div className="contab-kpi">
        <div className="panel">
          <span className="muted">Rapportini del mese</span>
          <strong>{aggregato.rapportini}</strong>
        </div>
        <div className="panel">
          <span className="muted">Chiamate con quantità</span>
          <strong>{aggregato.voci.length}</strong>
        </div>
        <div className="panel">
          <span className="muted">Totale</span>
          <strong>{formatEuro(aggregato.importo)}</strong>
        </div>
        <div className="panel">
          <span className="muted">Basi tagliate</span>
          <strong>{basiMese.totale}</strong>
        </div>
      </div>

      <h2>Avanzamento campate</h2>
      <div className="contab-torte">
        <TortaAvanzamento
          key={`all-u-${urgente.tagliate}-${urgente.daTagliare}-${urgente.tralasciate}`}
          dati={urgente}
        />
        <TortaAvanzamento
          key={`all-d-${differibile.tagliate}-${differibile.daTagliare}-${differibile.tralasciate}`}
          dati={differibile}
        />
      </div>

      <GraficoBasi totale={basiMese.totale} perLinea={basiMese.perLinea} />

      <section className="panel">
        <h2>Giorno per giorno · {etichettaMese(meseEffettivo)}</h2>
        <CalendarioMese
          mese={meseEffettivo}
          oggi={oggi}
          selezionato={giorno}
          conteggi={conteggiGiorno}
          onSelect={(data) => setGiorno(data || null)}
        />
        {giornoVoci ? (
          <div className="contab-giorno">
            <h3>{formatDate(giornoVoci.data)}</h3>
            {giornoVoci.rapportini === 0 ? (
              <p className="muted">Nessun rapportino in questa data.</p>
            ) : (
              <TabellaVoci
                voci={giornoVoci.voci}
                vuoto="Rapportini senza quantità su questa data."
              />
            )}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Chiamate del mese</h2>
        <TabellaVoci voci={aggregato.voci} vuoto="Nessuna quantità in questo mese." totaleLabel="Totale mese" />
      </section>

      <section className="panel">
        <h2>Per linea</h2>
        {aggregato.perLinea.length === 0 ? (
          <p className="muted">Nessuna linea con rapportini in questo mese.</p>
        ) : (
          <div className="contab-linee">
            {aggregato.perLinea.map((l) => {
              const aperta = lineaAperta === l.lineaId;
              return (
                <div key={l.lineaId}>
                  <button
                    type="button"
                    className="linee-gruppo-head"
                    aria-expanded={aperta}
                    onClick={() => setLineaAperta(aperta ? null : l.lineaId)}
                  >
                    <span className={`chevron ${aperta ? "giu" : ""}`} aria-hidden="true">
                      ›
                    </span>
                    <strong>
                      {l.codiceLinea} · {l.nomeLinea}
                    </strong>
                    <span className="muted">
                      {l.rapportini} {l.rapportini === 1 ? "rapportino" : "rapportini"}
                      {` · ${formatEuro(l.importo)}`}
                    </span>
                  </button>
                  {aperta ? (
                    <>
                      <div className="contab-torte">
                        <TortaAvanzamento
                          key={`${l.lineaId}-u`}
                          dati={avanzamentoPriorita(
                            campate.filter((c) => c.lineaId === l.lineaId),
                            "urgente",
                          )}
                        />
                        <TortaAvanzamento
                          key={`${l.lineaId}-d`}
                          dati={avanzamentoPriorita(
                            campate.filter((c) => c.lineaId === l.lineaId),
                            "differibile",
                          )}
                        />
                      </div>
                      <TabellaVoci voci={l.voci} vuoto="Nessuna quantità su questa linea." />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
