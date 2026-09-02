"use client";

import { campataGiaChiusaDaFoglio } from "@/lib/campate/guard";
import {
  CAMPATA_PRIORITA_LABEL,
  type CampataLavoro,
  type RapportinoCampata,
} from "@/lib/types";

export function CampateEsitiEditor({
  pianificate,
  esiti,
  campateLinea = [],
}: {
  pianificate: CampataLavoro[];
  esiti: RapportinoCampata[];
  campateLinea?: CampataLavoro[];
}) {
  return (
    <section className="panel">
      <h2>Campate del lavoro</h2>
      <p className="muted">
        Queste campate risultano tagliate con il rapportino. Se non c’è nulla da tagliare, non usare
        questo foglio: aprila dall’elenco campate e spunta «Da non tagliare».
      </p>
      <ul className="esiti-list">
        {esiti.map((e) => {
          const piano = e.campataId
            ? campateLinea.find((p) => p.id === e.campataId) ?? pianificate.find((p) => p.id === e.campataId)
            : campateLinea.find(
                (p) =>
                  p.tipo !== "base" &&
                  p.normalizzata === e.normalizzata &&
                  (!e.priorita || p.priorita === e.priorita),
              ) ??
              pianificate.find(
                (p) =>
                  p.normalizzata === e.normalizzata &&
                  (!e.priorita || p.priorita === e.priorita),
              );
          const priorita = e.priorita ?? piano?.priorita;
          const giaTagliata = piano ? campataGiaChiusaDaFoglio(piano) : false;
          return (
            <li key={e.id} className="esito-card esito-tagliata">
              <div className="esito-head">
                <strong>{e.normalizzata}</strong>
                {priorita ? (
                  <span className={`badge badge-${priorita}`}>{CAMPATA_PRIORITA_LABEL[priorita]}</span>
                ) : null}
                {giaTagliata ? <span className="badge badge-tagliata">Già tagliata</span> : null}
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
