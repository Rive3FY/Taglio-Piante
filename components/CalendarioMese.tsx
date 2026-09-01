"use client";

import { giorniDelMese } from "@/lib/contabilita/aggrega";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function lunediOffset(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

export function CalendarioMese({
  mese,
  oggi,
  selezionato,
  conteggi,
  onSelect,
}: {
  mese: string;
  oggi: string;
  selezionato: string | null;
  conteggi: Map<string, number>;
  onSelect: (iso: string) => void;
}) {
  const giorni = giorniDelMese(mese);
  const offset = giorni[0] ? lunediOffset(giorni[0]) : 0;

  return (
    <div className="contab-cal">
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
        const isOggi = data === oggi;
        const sel = data === selezionato;
        return (
          <button
            key={data}
            type="button"
            className={`contab-cal-g${n ? " has" : ""}${isOggi ? " oggi" : ""}${sel ? " on" : ""}`}
            onClick={() => onSelect(sel ? "" : data)}
          >
            <span>{Number(data.slice(-2))}</span>
            {n > 0 ? <small>{n}</small> : null}
          </button>
        );
      })}
    </div>
  );
}
