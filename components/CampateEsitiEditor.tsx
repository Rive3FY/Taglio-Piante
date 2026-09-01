"use client";

import {
  CAMPATA_PRIORITA_LABEL,
  type CampataLavoro,
  type RapportinoCampata,
} from "@/lib/types";

export function CampateEsitiEditor({
  pianificate,
  esiti,
}: {
  pianificate: CampataLavoro[];
  esiti: RapportinoCampata[];
  onChange: (esiti: RapportinoCampata[]) => void;
}) {
  return (
    <section className="panel">
      <h2>Campate del lavoro</h2>
      <ul className="esiti-list">
        {esiti.map((e) => {
          const piano = e.campataId
            ? pianificate.find((p) => p.id === e.campataId)
            : pianificate.find(
                (p) =>
                  p.normalizzata === e.normalizzata &&
                  (!e.priorita || p.priorita === e.priorita),
              );
          const priorita = e.priorita ?? piano?.priorita;
          return (
            <li key={e.id} className="esito-card">
              <div className="esito-head">
                <strong>{e.normalizzata}</strong>
                {priorita ? (
                  <span className={`badge badge-${priorita}`}>{CAMPATA_PRIORITA_LABEL[priorita]}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function testoCampateDaEsiti(esiti: RapportinoCampata[]) {
  return [...new Set(esiti.map((e) => e.normalizzata))].join(", ");
}
