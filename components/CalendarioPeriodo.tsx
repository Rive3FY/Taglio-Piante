"use client";

import { giorniTra, ultimoGiornoMese, type Intervallo } from "@/lib/contabilita/aggrega";
import type { PeriodoEffettivo } from "@/lib/contabilita/periodo";

const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];
const MESI_CORTI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export type ModoCalendario = "giorno" | "inizio" | "chiusura";

function lunediOffset(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

function dataLunga(iso: string) {
  const testo = new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function avanzamento(periodo: Intervallo, oggi: string) {
  const totale = giorniTra(periodo).length;
  if (oggi < periodo.dal) {
    const mancano = giorniTra({ dal: oggi, al: periodo.dal }).length - 1;
    return { quota: 0, testo: `Inizia tra ${mancano} ${mancano === 1 ? "giorno" : "giorni"}`, totale };
  }
  if (oggi > periodo.al) return { quota: 1, testo: "Periodo chiuso", totale };
  const passati = giorniTra({ dal: periodo.dal, al: oggi }).length;
  const restano = totale - passati;
  return {
    quota: passati / totale,
    testo:
      restano === 0
        ? `Giorno ${passati} di ${totale} · oggi si chiude`
        : `Giorno ${passati} di ${totale} · ${restano === 1 ? "manca 1 giorno" : `mancano ${restano} giorni`}`,
    totale,
  };
}

/** Riquadri di inizio e chiusura, barra del periodo e calendario a fascia continua. */
export function CalendarioPeriodo({
  mese,
  periodo,
  oggi,
  modo,
  avviso,
  selezionato,
  conteggi,
  onModo,
  onScegli,
  onRipristina,
}: {
  mese: string;
  periodo: PeriodoEffettivo;
  oggi: string;
  modo: ModoCalendario;
  avviso: string | null;
  selezionato: string | null;
  conteggi: Map<string, number>;
  onModo: (modo: ModoCalendario) => void;
  onScegli: (iso: string) => void;
  onRipristina?: () => void;
}) {
  const primo = `${mese}-01`;
  const ultimo = ultimoGiornoMese(mese);
  const giorni = giorniTra({
    dal: periodo.dal < primo ? periodo.dal : primo,
    al: periodo.al > ultimo ? periodo.al : ultimo,
  });
  const offset = giorni[0] ? lunediOffset(giorni[0]) : 0;
  const stato = avanzamento(periodo, oggi);
  const suggerimento =
    avviso ??
    (modo === "inizio"
      ? "Tocca nel calendario il giorno di inizio."
      : modo === "chiusura"
        ? "Tocca nel calendario il giorno di chiusura."
        : "Tocca un giorno per vedere le prestazioni di quella data.");

  return (
    <div className={`periodo modo-${modo}`}>
      <div className="periodo-estremi">
        <button
          type="button"
          className={`periodo-estremo inizio${modo === "inizio" ? " attivo" : ""}`}
          aria-pressed={modo === "inizio"}
          onClick={() => onModo(modo === "inizio" ? "giorno" : "inizio")}
        >
          <span className="periodo-estremo-tit">
            <i /> Inizio
          </span>
          <strong>{dataLunga(periodo.dal)}</strong>
          <span className="periodo-estremo-nota">
            {modo === "inizio" ? "Scegli nel calendario" : periodo.inizioScelto ? "Scelto da te · cambia" : "Di partenza · cambia"}
          </span>
        </button>
        <span className="periodo-freccia" aria-hidden="true">
          →
        </span>
        <button
          type="button"
          className={`periodo-estremo chiusura${modo === "chiusura" ? " attivo" : ""}`}
          aria-pressed={modo === "chiusura"}
          onClick={() => onModo(modo === "chiusura" ? "giorno" : "chiusura")}
        >
          <span className="periodo-estremo-tit">
            <i /> Chiusura
          </span>
          <strong>{dataLunga(periodo.al)}</strong>
          <span className="periodo-estremo-nota">
            {modo === "chiusura" ? "Scegli nel calendario" : periodo.chiusuraScelta ? "Scelta da te · cambia" : "Di partenza · cambia"}
          </span>
        </button>
      </div>

      <div className="periodo-stato">
        <div className="periodo-traccia" aria-hidden="true">
          <span style={{ width: `${Math.round(stato.quota * 100)}%` }} />
        </div>
        <div className="periodo-stato-testo">
          <span>{stato.testo}</span>
          {onRipristina ? (
            <button type="button" className="periodo-ripristina" onClick={onRipristina}>
              Ripristina
            </button>
          ) : null}
        </div>
      </div>

      <p className={`periodo-suggerimento${avviso ? " avviso" : ""}`}>{suggerimento}</p>

      <div className="rc" role="grid" aria-label="Calendario del periodo">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="rc-wd">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {giorni.map((data, i) => {
          const colonna = (offset + i) % 7;
          const n = conteggi.get(data) ?? 0;
          const dentro = data >= periodo.dal && data <= periodo.al;
          const eInizio = data === periodo.dal;
          const eFine = data === periodo.al;
          const altroMese = data.slice(0, 7) !== mese;
          const classi = [
            "rc-g",
            dentro ? "dentro" : "fuori",
            eInizio ? "inizio" : "",
            eFine ? "fine" : "",
            colonna === 0 ? "lun" : "",
            colonna === 6 ? "dom" : "",
            data === oggi ? "oggi" : "",
            modo === "giorno" && data === selezionato && !eInizio && !eFine ? "scelto" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={data}
              type="button"
              className={classi}
              title={eInizio ? "Inizio del periodo" : eFine ? "Chiusura del periodo" : undefined}
              aria-pressed={modo === "giorno" ? data === selezionato : undefined}
              onClick={() => onScegli(data)}
            >
              <span className="rc-num">
                {Number(data.slice(-2))}
                {altroMese ? <em>{MESI_CORTI[Number(data.slice(5, 7)) - 1]}</em> : null}
              </span>
              {n > 0 ? <span className="rc-dot">{n > 1 ? n : ""}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
