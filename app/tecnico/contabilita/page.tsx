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
  prestazioniMesePerLinea,
  type VoceContabile,
} from "@/lib/contabilita/aggrega";
import { arrotondaEuro, etichettaUnita } from "@/lib/contabilita/listino";
import {
  scaricaPrestazioniLineaExcel,
  scaricaPrestazioniMeseExcel,
} from "@/lib/contabilita/export";
import { mostraEsito } from "@/lib/esitoSalvataggio";
import { formatDate, todayIso } from "@/lib/format";
import { TortaAvanzamento } from "@/components/TortaAvanzamento";
import { GraficoBasi } from "@/components/GraficoBasi";
import { CalendarioPeriodo, type ModoCalendario } from "@/components/CalendarioPeriodo";
import { LineaPicker } from "@/components/LineaPicker";
import { ANTEPRIMA_ELENCO, MostraAltro } from "@/components/MostraAltro";
import { annoPianoPiuRecente, anniPiani, campateDellAnno } from "@/lib/campate/anno";
import { URGENZE_VISIBILI } from "@/lib/campate/urgenze";
import {
  meseContabileDi,
  periodoEffettivo,
  salvaPeriodo,
  usePeriodiContabili,
} from "@/lib/contabilita/periodo";

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
  const periodi = usePeriodiContabili();
  const meseInCorso = meseContabileDi(oggi, periodi);
  // Un foglio del 25 settembre, con settembre chiuso il 24, sta già nel mese di ottobre.
  const mesi = useMemo(() => {
    const set = new Set([meseInCorso]);
    for (const r of rapportini) {
      if (r.dataLavoro) set.add(meseContabileDi(r.dataLavoro, periodi));
    }
    return [...set].sort().reverse();
  }, [rapportini, periodi, meseInCorso]);
  const [mese, setMese] = useState<string | null>(null);
  const [giorno, setGiorno] = useState<string | null>(oggi);
  const [modoCal, setModoCal] = useState<ModoCalendario>("giorno");
  const [avvisoPeriodo, setAvvisoPeriodo] = useState<string | null>(null);
  const [lineaAperta, setLineaAperta] = useState<string | null>(null);
  const [cercaLinea, setCercaLinea] = useState("");
  const [lineaCercataId, setLineaCercataId] = useState("");
  const [mostraAltreLinee, setMostraAltreLinee] = useState(false);
  const [scaricoMese, setScaricoMese] = useState(false);
  const anniCampate = useMemo(() => anniPiani(campate), [campate]);
  const [annoPiano, setAnnoPiano] = useState<number | null>(null);
  const annoPianoEff =
    annoPiano != null && anniCampate.includes(annoPiano)
      ? annoPiano
      : (anniCampate[0] ?? annoPianoPiuRecente(campate));
  const campateAnno = useMemo(() => campateDellAnno(campate, annoPianoEff), [campate, annoPianoEff]);

  const meseEffettivo = mese && mesi.includes(mese) ? mese : meseInCorso;
  const periodo = periodoEffettivo(meseEffettivo, periodi);
  const { dal, al } = periodo;
  const intervallo = useMemo(() => ({ dal, al }), [dal, al]);
  const aggregato = useMemo(
    () => aggregaMese(rapportini, prestazioni, linee, meseEffettivo, intervallo),
    [rapportini, prestazioni, linee, meseEffettivo, intervallo],
  );
  const reportMese = useMemo(
    () => prestazioniMesePerLinea(rapportini, prestazioni, linee, meseEffettivo, intervallo),
    [rapportini, prestazioni, linee, meseEffettivo, intervallo],
  );
  const restano = giorniAllaChiusura(intervallo, oggi);
  const etichettaPeriodo = `dal ${formatDate(dal)} al ${formatDate(al)}`;

  function scegliGiorno(data: string) {
    if (modoCal === "giorno") {
      setGiorno(data === giorno ? null : data);
      return;
    }
    if (modoCal === "inizio") {
      if (data > al) {
        setAvvisoPeriodo("L’inizio deve venire prima della chiusura.");
        return;
      }
      salvaPeriodo(meseEffettivo, { dal: data });
      setAvvisoPeriodo(`Inizio fissato al ${formatDate(data)}.`);
    } else {
      if (data < dal) {
        setAvvisoPeriodo("La chiusura deve venire dopo l’inizio.");
        return;
      }
      salvaPeriodo(meseEffettivo, { al: data });
      setAvvisoPeriodo(`Chiusura fissata al ${formatDate(data)}.`);
    }
    setModoCal("giorno");
  }
  const urgente = useMemo(() => avanzamentoPriorita(campateAnno, "urgente"), [campateAnno]);
  const differibile = useMemo(() => avanzamentoPriorita(campateAnno, "differibile"), [campateAnno]);
  const basiMese = useMemo(
    () => conteggioBasiTagliate(campateAnno, intervallo),
    [campateAnno, intervallo],
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
  const mesePerLinea = useMemo(
    () => new Map(aggregato.perLinea.map((l) => [l.lineaId, l])),
    [aggregato.perLinea],
  );
  const estrattoAperto = useMemo(() => {
    if (!lineaAperta) return null;
    return aggregaPrestazioniLinea(
      rapportini,
      prestazioni,
      linee.find((l) => l.id === lineaAperta),
      lineaAperta,
      oggi,
    );
  }, [rapportini, prestazioni, linee, lineaAperta, oggi]);

  const opzioniLineaMese = useMemo(
    () =>
      lineeEstraibili.map((l) => ({
        id: l.lineaId,
        codice: l.codiceLinea,
        nome: l.nomeLinea,
      })),
    [lineeEstraibili],
  );
  const lineeFiltrate = useMemo(() => {
    if (lineaCercataId) {
      return lineeEstraibili.filter((l) => l.lineaId === lineaCercataId);
    }
    const term = cercaLinea.trim().toLowerCase();
    if (!term) return lineeEstraibili;
    return lineeEstraibili.filter(
      (l) =>
        l.codiceLinea.toLowerCase().includes(term) ||
        l.nomeLinea.toLowerCase().includes(term),
    );
  }, [lineeEstraibili, cercaLinea, lineaCercataId]);
  const lineeVisibili =
    mostraAltreLinee || lineaCercataId
      ? lineeFiltrate
      : lineeFiltrate.slice(0, ANTEPRIMA_ELENCO);

  return (
    <div className="report">
      <div className="elenco-head">
        <div>
          <h2>Contabilità</h2>
        </div>
      </div>

      {restano != null ? (
        <p className="contab-scadenza">
          {restano === 0
            ? `Oggi è il giorno di chiusura: il report di ${etichettaMese(meseEffettivo).toLowerCase()} va chiuso.`
            : `Periodo in corso: mancano ${restano} ${restano === 1 ? "giorno" : "giorni"} alla chiusura del ${formatDate(al)}.`}
        </p>
      ) : oggi > al ? (
        <p className="muted">Periodo chiuso il {formatDate(al)}.</p>
      ) : (
        <p className="muted">Il periodo inizia il {formatDate(dal)}.</p>
      )}

      <div className="chip-row">
        {mesi.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${meseEffettivo === m ? "on" : ""}`}
            onClick={() => {
              setMese(m);
              setGiorno(m === meseInCorso ? oggi : null);
              setModoCal("giorno");
              setAvvisoPeriodo(null);
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
          <span className="muted">Rapportini del periodo</span>
          <strong>{aggregato.rapportini}</strong>
        </div>
        <div className="panel">
          <span className="muted">Prestazioni con quantità</span>
          <strong>{aggregato.voci.length + aggregato.vociBasi.length}</strong>
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

      <div className="report-griglia">
      <div className="report-col">
      <section className="panel">
        <h2>Report del mese</h2>
        <div className="contab-estrai">
          <p className="muted" style={{ margin: 0 }}>
            {reportMese.perLinea.length}{" "}
            {reportMese.perLinea.length === 1 ? "linea" : "linee"} · {reportMese.rapportini}{" "}
            {reportMese.rapportini === 1 ? "rapportino" : "rapportini"}
            {reportMese.importo != null ? ` · ${formatEuro(reportMese.importo)}` : ""}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={scaricoMese || reportMese.perLinea.length === 0}
            onClick={() => {
              setScaricoMese(true);
              void (async () => {
                try {
                  await scaricaPrestazioniMeseExcel(reportMese, oggi);
                  mostraEsito({
                    titolo: "Excel scaricato",
                    testo: `Prestazioni di ${etichettaMese(meseEffettivo).toLowerCase()} ${etichettaPeriodo}, divise per linea, con i totali.`,
                    dopo: "resta",
                  });
                } finally {
                  setScaricoMese(false);
                }
              })();
            }}
          >
            {scaricoMese ? "Preparo…" : `Scarica Excel · ${etichettaPeriodo}`}
          </button>
        </div>
        {reportMese.perLinea.length === 0 ? (
          <p className="muted">Nessun rapportino confermato in questo periodo: non c’è niente da scaricare.</p>
        ) : null}
      </section>

      <section className="panel">
        <h2>Periodo · {etichettaMese(meseEffettivo)}</h2>
        <CalendarioPeriodo
          mese={meseEffettivo}
          periodo={periodo}
          oggi={oggi}
          modo={modoCal}
          avviso={avvisoPeriodo}
          selezionato={giorno}
          conteggi={conteggiGiorno}
          onModo={(m) => {
            setModoCal(m);
            setAvvisoPeriodo(null);
          }}
          onScegli={scegliGiorno}
          onRipristina={
            periodo.inizioScelto || periodo.chiusuraScelta
              ? () => {
                  salvaPeriodo(meseEffettivo, { dal: null, al: null });
                  setModoCal("giorno");
                  setAvvisoPeriodo("Periodo riportato a quello di partenza.");
                }
              : undefined
          }
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
      </div>

      <div className="report-col">
      <section className="panel">
        <h2>Avanzamento campate · piano {annoPianoEff}</h2>
        {anniCampate.length > 1 ? (
          <div className="chip-row">
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
          {URGENZE_VISIBILI ? (
            <TortaAvanzamento
              key={`all-u-${urgente.tagliate}-${urgente.daTagliare}-${urgente.tralasciate}`}
              dati={urgente}
            />
          ) : null}
          <TortaAvanzamento
            key={`all-d-${differibile.tagliate}-${differibile.daTagliare}-${differibile.tralasciate}`}
            dati={differibile}
          />
        </div>
      </section>

      <GraficoBasi
        key={meseEffettivo}
        totale={basiMese.totale}
        perLinea={basiMese.perLinea}
      />
      </div>
      </div>

      <section className="panel">
        <h2>Prestazioni del mese</h2>
        <TabellaVoci
          key={`${meseEffettivo}-mese`}
          voci={aggregato.voci}
          vuoto="Nessuna quantità di campate in questo mese."
          totaleLabel="Totale campate"
        />
      </section>

      <section className="panel">
        <h2>Prestazioni sulle basi</h2>
        <TabellaVoci
          key={`${meseEffettivo}-basi`}
          voci={aggregato.vociBasi}
          vuoto="Nessuna prestazione su fogli basi in questo mese."
          totaleLabel="Totale basi"
        />
      </section>

      <section className="panel">
        <div className="elenco-head">
          <h2>Estrazione prestazioni per linea</h2>
          {lineeEstraibili.length > 0 ? (
            <label className="contab-cerca-linea">
              Cerca linea
              <LineaPicker
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
        {lineeEstraibili.length === 0 ? (
          <p className="muted">Nessun rapportino confermato da cui vedere le prestazioni.</p>
        ) : lineeFiltrate.length === 0 ? (
          <p className="muted">Nessuna linea trovata.</p>
        ) : (
          <div className="contab-linee">
            {lineeVisibili.map((l) => {
              const aperta = lineaAperta === l.lineaId;
              const delMese = mesePerLinea.get(l.lineaId);
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
                      {l.ultimaData ? ` · ultimo ${formatDate(l.ultimaData)}` : ""}
                      {delMese
                        ? ` · ${delMese.rapportini} in ${etichettaMese(meseEffettivo)}`
                        : ""}
                    </span>
                  </button>
                  {aperta && estrattoAperto?.lineaId === l.lineaId ? (
                    <>
                      <div className="contab-torte">
                        {URGENZE_VISIBILI ? (
                          <TortaAvanzamento
                            key={`${l.lineaId}-u`}
                            dati={avanzamentoPriorita(
                              campateAnno.filter((c) => c.lineaId === l.lineaId),
                              "urgente",
                            )}
                          />
                        ) : null}
                        <TortaAvanzamento
                          key={`${l.lineaId}-d`}
                          dati={avanzamentoPriorita(
                            campateAnno.filter((c) => c.lineaId === l.lineaId),
                            "differibile",
                          )}
                        />
                      </div>
                      <div className="contab-estrai">
                        <p className="muted" style={{ margin: 0 }}>
                          Prestazioni fino al {formatDate(oggi)}
                          {estrattoAperto.importo != null
                            ? ` · ${formatEuro(estrattoAperto.importo)}`
                            : ""}
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={estrattoAperto.voci.length === 0}
                          onClick={() => {
                            void (async () => {
                              await scaricaPrestazioniLineaExcel(estrattoAperto, oggi);
                              mostraEsito({
                                titolo: "Excel scaricato",
                                testo: `Prestazioni della linea ${estrattoAperto.codiceLinea} fino al ${formatDate(oggi)}.`,
                                dopo: "resta",
                              });
                            })();
                          }}
                        >
                          Scarica Excel
                        </button>
                      </div>
                      <TabellaVoci
                        key={`${l.lineaId}-estratto`}
                        voci={estrattoAperto.voci}
                        vuoto="Nessuna quantità confermata su questa linea."
                        totaleLabel="Totale linea"
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
    </div>
  );
}
