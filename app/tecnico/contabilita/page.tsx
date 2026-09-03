"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  aggregaMese,
  aggregaPrestazioniLinea,
  avanzamentoPriorita,
  conteggioBasiTagliate,
  etichettaMese,
  formatEuro,
  formatQuantita,
  giorniAllaChiusura,
  lineeConPrestazioni,
  mesiDisponibili,
  type VoceContabile,
} from "@/lib/contabilita/aggrega";
import { arrotondaEuro, etichettaUnita } from "@/lib/contabilita/listino";
import { scaricaPrestazioniLineaExcel } from "@/lib/contabilita/export";
import { formatDate, todayIso } from "@/lib/format";
import { TortaAvanzamento } from "@/components/TortaAvanzamento";
import { GraficoBasi } from "@/components/GraficoBasi";
import { CalendarioMese } from "@/components/CalendarioMese";
import { LineaPicker } from "@/components/LineaPicker";
import { ANTEPRIMA_ELENCO, MostraAltro } from "@/components/MostraAltro";
import { annoPianoPiuRecente, anniPiani, campateDellAnno } from "@/lib/campate/anno";

function TabellaVoci({
  voci,
  vuoto,
  totaleLabel = "Totale",
}: {
  voci: VoceContabile[];
  vuoto: string;
  totaleLabel?: string;
}) {
  const [aperto, setAperto] = useState(false);
  if (voci.length === 0) return <p className="muted">{vuoto}</p>;
  const totale = voci.every((v) => v.importo != null)
    ? arrotondaEuro(voci.reduce((s, v) => s + (v.importo ?? 0), 0))
    : null;
  const visibili = aperto ? voci : voci.slice(0, ANTEPRIMA_ELENCO);
  return (
    <>
      <div className="campate-table-wrap">
        <table className="campate-table">
          <thead>
            <tr>
              <th>Prestazione</th>
              <th>Descrizione</th>
              <th>U.M.</th>
              <th>Quantità</th>
              <th>Prezzo</th>
              <th>Importo</th>
            </tr>
          </thead>
          <tbody>
            {visibili.map((v) => (
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
      <MostraAltro aperto={aperto} totale={voci.length} onToggle={() => setAperto((v) => !v)} />
    </>
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
  const [lineaEstratta, setLineaEstratta] = useState("");
  const [cercaLinea, setCercaLinea] = useState("");
  const [lineaCercataId, setLineaCercataId] = useState("");
  const [mostraAltreLinee, setMostraAltreLinee] = useState(false);
  const anniCampate = useMemo(() => anniPiani(campate), [campate]);
  const [annoPiano, setAnnoPiano] = useState<number | null>(null);
  const annoPianoEff =
    annoPiano != null && anniCampate.includes(annoPiano)
      ? annoPiano
      : (anniCampate[0] ?? annoPianoPiuRecente(campate));
  const campateAnno = useMemo(() => campateDellAnno(campate, annoPianoEff), [campate, annoPianoEff]);

  const meseEffettivo = mesi.includes(mese) ? mese : (mesi[0] ?? oggi.slice(0, 7));
  const aggregato = useMemo(
    () => aggregaMese(rapportini, prestazioni, linee, meseEffettivo),
    [rapportini, prestazioni, linee, meseEffettivo],
  );
  const restano = giorniAllaChiusura(meseEffettivo, oggi);
  const urgente = useMemo(() => avanzamentoPriorita(campateAnno, "urgente"), [campateAnno]);
  const differibile = useMemo(() => avanzamentoPriorita(campateAnno, "differibile"), [campateAnno]);
  const basiMese = useMemo(
    () => conteggioBasiTagliate(campateAnno, meseEffettivo),
    [campateAnno, meseEffettivo],
  );
  const conteggiGiorno = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of aggregato.perGiorno) m.set(g.data, g.rapportini);
    return m;
  }, [aggregato.perGiorno]);
  const giornoVoci = aggregato.perGiorno.find((g) => g.data === giorno);
  const lineeEstraibili = useMemo(
    () => lineeConPrestazioni(rapportini, linee, oggi, prestazioni),
    [rapportini, linee, oggi, prestazioni],
  );
  const lineaEstrattaId = lineeEstraibili.some((l) => l.lineaId === lineaEstratta)
    ? lineaEstratta
    : (lineeEstraibili[0]?.lineaId ?? "");
  const estratto = useMemo(() => {
    if (!lineaEstrattaId) return null;
    return aggregaPrestazioniLinea(
      rapportini,
      prestazioni,
      linee.find((l) => l.id === lineaEstrattaId),
      lineaEstrattaId,
      oggi,
    );
  }, [rapportini, prestazioni, linee, lineaEstrattaId, oggi]);

  const opzioniLineaMese = useMemo(
    () =>
      aggregato.perLinea.map((l) => ({
        id: l.lineaId,
        codice: l.codiceLinea,
        nome: l.nomeLinea,
      })),
    [aggregato.perLinea],
  );
  const lineeFiltrate = useMemo(() => {
    if (lineaCercataId) {
      return aggregato.perLinea.filter((l) => l.lineaId === lineaCercataId);
    }
    const term = cercaLinea.trim().toLowerCase();
    if (!term) return aggregato.perLinea;
    return aggregato.perLinea.filter(
      (l) =>
        l.codiceLinea.toLowerCase().includes(term) ||
        l.nomeLinea.toLowerCase().includes(term),
    );
  }, [aggregato.perLinea, cercaLinea, lineaCercataId]);
  const lineeVisibili =
    mostraAltreLinee || lineaCercataId
      ? lineeFiltrate
      : lineeFiltrate.slice(0, ANTEPRIMA_ELENCO);

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
              setCercaLinea("");
              setLineaCercataId("");
              setMostraAltreLinee(false);
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
          <span className="muted">Prestazioni con quantità</span>
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

      <h2>Avanzamento campate · piano {annoPianoEff}</h2>
      <p className="muted">Le torte contano solo le campate urgenti e differibili, non le basi.</p>
      {anniCampate.length > 1 ? (
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {anniCampate.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip ${annoPianoEff === a ? "on" : ""}`}
              onClick={() => setAnnoPiano(a)}
            >
              {a}
            </button>
          ))}
        </div>
      ) : null}
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

      <GraficoBasi
        key={meseEffettivo}
        totale={basiMese.totale}
        perLinea={basiMese.perLinea}
      />

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
                key={giornoVoci.data}
                voci={giornoVoci.voci}
                vuoto="Rapportini senza quantità su questa data."
              />
            )}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Prestazioni del mese</h2>
        <TabellaVoci
          key={`${meseEffettivo}-mese`}
          voci={aggregato.voci}
          vuoto="Nessuna quantità in questo mese."
          totaleLabel="Totale mese"
        />
      </section>

      <section className="panel">
        <div className="elenco-head">
          <h2>Per linea</h2>
          {aggregato.perLinea.length > 0 ? (
            <label className="contab-cerca-linea">
              Cerca linea
              <LineaPicker
                key={meseEffettivo}
                linee={opzioniLineaMese}
                value={lineaCercataId}
                campo="completa"
                placeholder="Codice o nome linea"
                onQueryChange={(q) => {
                  setCercaLinea(q);
                  setMostraAltreLinee(false);
                }}
                onChange={(id) => {
                  setLineaCercataId(id);
                  setLineaAperta(id || null);
                  if (!id) setMostraAltreLinee(false);
                }}
              />
            </label>
          ) : null}
        </div>
        <p className="muted">Le pulizie basi 5.1–5.4 stanno nel grafico Basi, non qui.</p>
        {aggregato.perLinea.length === 0 ? (
          <p className="muted">Nessuna linea con rapportini in questo mese.</p>
        ) : lineeFiltrate.length === 0 ? (
          <p className="muted">Nessuna linea trovata.</p>
        ) : (
          <div className="contab-linee">
            {lineeVisibili.map((l) => {
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
                            campateAnno.filter((c) => c.lineaId === l.lineaId),
                            "urgente",
                          )}
                        />
                        <TortaAvanzamento
                          key={`${l.lineaId}-d`}
                          dati={avanzamentoPriorita(
                            campateAnno.filter((c) => c.lineaId === l.lineaId),
                            "differibile",
                          )}
                        />
                      </div>
                      <TabellaVoci
                        key={`${l.lineaId}-voci`}
                        voci={l.voci}
                        vuoto="Nessuna quantità su questa linea."
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
            {!lineaCercataId ? (
              <MostraAltro
                aperto={mostraAltreLinee}
                totale={lineeFiltrate.length}
                onToggle={() => setMostraAltreLinee((v) => !v)}
              />
            ) : null}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Estrazione prestazioni per linea</h2>
        <p className="muted">
          Totale delle prestazioni confermate sulla linea scelta, dai rapportini archiviati
          fino a oggi (i bozza restano fuori). Le pulizie basi 5.1–5.4 restano nel grafico
          Basi, non in questo file. Il file Excel ha una riga per prestazione, ad esempio il
          totale dei 2.1 segnati su quella linea.
        </p>
        {lineeEstraibili.length === 0 || !estratto ? (
          <p className="muted">Nessun rapportino confermato da cui estrarre prestazioni.</p>
        ) : (
          <>
            <div className="contab-estrai">
              <label>
                Linea
                <select
                  value={lineaEstrattaId}
                  onChange={(e) => setLineaEstratta(e.target.value)}
                >
                  {lineeEstraibili.map((l) => (
                    <option key={l.lineaId} value={l.lineaId}>
                      {l.codiceLinea} · {l.nomeLinea}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={estratto.voci.length === 0}
                onClick={() => void scaricaPrestazioniLineaExcel(estratto, oggi)}
              >
                Scarica Excel
              </button>
            </div>
            <p className="muted">
              {estratto.rapportini}{" "}
              {estratto.rapportini === 1 ? "rapportino" : "rapportini"}
              {estratto.ultimaData ? ` · ultimo ${formatDate(estratto.ultimaData)}` : ""}
              {` · fino al ${formatDate(oggi)}`}
            </p>
            <TabellaVoci
              key={`${lineaEstrattaId}-estratto`}
              voci={estratto.voci}
              vuoto="Nessuna quantità confermata su questa linea."
              totaleLabel="Totale linea"
            />
          </>
        )}
      </section>
    </>
  );
}
