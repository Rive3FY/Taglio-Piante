"use client";

import { giorniTra, ultimoGiornoMese, type Intervallo } from "@/lib/contabilita/aggrega";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI_CORTI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export type ModoCalendario = "giorno" | "inizio" | "chiusura";

function lunediOffset(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

/**
 * Calendario del mese contabile: verde il giorno di inizio, rosso quello di chiusura.
 * Se il periodo sconfina nel mese prima o dopo, quei giorni compaiono anche loro.
 */
export function CalendarioPeriodo({
  mese,
  periodo,
  oggi,
  modo,
  selezionato,
  conteggi,
  onScegli,
}: {
  mese: string;
  periodo: Intervallo;
  oggi: string;
  modo: ModoCalendario;
  selezionato: string | null;
  conteggi: Map<string, number>;
  onScegli: (iso: string) => void;
}) {
  const primo = `${mese}-01`;
  const ultimo = ultimoGiornoMese(mese);
  const giorni = giorniTra({
    dal: periodo.dal < primo ? periodo.dal : primo,
    al: periodo.al > ultimo ? periodo.al : ultimo,
  });
  const offset = giorni[0] ? lunediOffset(giorni[0]) : 0;

  return (
    <div className={`contab-cal cal-periodo modo-${modo}`}>
      {WEEKDAYS.map((d) => (
        <span key={d} className="contab-cal-wd">
          {d}
        </span>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <span key={`pad-${i}`} />
      ))}
      {giorni.map((data) => {
        const n = conteggi.get(data) ?? 0;
        const dentro = data >= periodo.dal && data <= periodo.al;
        const altroMese = data.slice(0, 7) !== mese;
        const classi = [
          "contab-cal-g",
          n && dentro ? "has" : "",
          data === oggi ? "oggi" : "",
          modo === "giorno" && data === selezionato ? "on" : "",
          dentro ? "dentro" : "fuori",
          altroMese ? "altro-mese" : "",
          data === periodo.dal ? "inizio" : "",
          data === periodo.al ? "chiusura" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const giorno = Number(data.slice(-2));
        const etichetta = data === periodo.dal ? "Inizio" : data === periodo.al ? "Chiusura" : null;
        return (
          <button
            key={data}
            type="button"
            className={classi}
            aria-pressed={modo === "giorno" ? data === selezionato : undefined}
            title={etichetta ? `${etichetta} del periodo` : undefined}
            onClick={() => onScegli(data)}
          >
            <span>
              {giorno}
              {altroMese ? <em> {MESI_CORTI[Number(data.slice(5, 7)) - 1]}</em> : null}
            </span>
            {etichetta ? <small className="cal-periodo-tag">{etichetta}</small> : n > 0 ? <small>{n}</small> : null}
          </button>
        );
      })}
    </div>
  );
}
