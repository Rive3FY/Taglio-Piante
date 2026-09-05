"use client";

import { useId } from "react";
import type { AvanzamentoPriorita } from "@/lib/contabilita/aggrega";
import { CAMPATA_PRIORITA_LABEL } from "@/lib/types";

const FETTE = [
  { key: "tagliate" as const, label: "Tagliate", da: "#22c55e", a: "#15803d" },
  { key: "daTagliare" as const, label: "Da tagliare", da: "#f59e0b", a: "#b45309" },
];

const CENTRO = 60;
const RAGGIO = 52;
/** Stacco tra le fette, in gradi: è quello che dà l'aria moderna alla torta. */
const STACCO = 3;

function punto(raggio: number, gradi: number) {
  const rad = ((gradi - 90) * Math.PI) / 180;
  return [CENTRO + raggio * Math.cos(rad), CENTRO + raggio * Math.sin(rad)] as const;
}

/** Lo stacco si stringe sulle fette sottili, se no una fetta di un grado si girerebbe. */
function spicchio(da: number, a: number) {
  const stacco = Math.min(STACCO, (a - da) * 0.35);
  const [x1, y1] = punto(RAGGIO, da + stacco / 2);
  const [x2, y2] = punto(RAGGIO, a - stacco / 2);
  const grande = a - da > 180 ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RAGGIO} ${RAGGIO} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

/** Percentuali intere che sommano sempre a 100: il resto va alla fetta più grande. */
function percentuali(valori: number[], totale: number) {
  if (totale <= 0) return valori.map(() => 0);
  const grezze = valori.map((v) => (v / totale) * 100);
  const tonde = grezze.map((v, i) => {
    const n = Math.round(v);
    // Una campata che c'è non sparisce a zero, e finché ne resta una non è 100%.
    if (valori[i] > 0 && n === 0) return 1;
    if (valori[i] < totale && n === 100) return 99;
    return n;
  });
  const resto = 100 - tonde.reduce((s, n) => s + n, 0);
  if (resto !== 0) {
    const piuGrande = grezze.indexOf(Math.max(...grezze));
    tonde[piuGrande] += resto;
  }
  return tonde;
}

export function TortaAvanzamento({ dati }: { dati: AvanzamentoPriorita }) {
  const uid = useId();
  const titolo = CAMPATA_PRIORITA_LABEL[dati.priorita];
  const vuoto = dati.totale === 0;
  const quote = percentuali(
    FETTE.map((f) => dati[f.key]),
    dati.totale,
  );

  let acc = 0;
  const fette = FETTE.map((f, i) => {
    const quantita = dati[f.key];
    const da = (acc / Math.max(dati.totale, 1)) * 360;
    acc += quantita;
    const a = (acc / Math.max(dati.totale, 1)) * 360;
    return { ...f, quantita, quota: quote[i], da, a };
  });
  const disegnate = fette.filter((f) => f.quantita > 0);
  const unaSola = disegnate.length === 1;

  return (
    <section className="panel torta-card">
      <h2>{titolo}</h2>
      <p className="muted">
        {vuoto ? "Nessuna campata in elenco." : `${dati.tagliate} tagliate su ${dati.totale}`}
      </p>
      <div className="torta-layout">
        <svg
          className="torta-svg"
          viewBox="0 0 120 120"
          role="img"
          aria-label={
            vuoto
              ? `${titolo}: nessuna campata in elenco.`
              : `${titolo}: ${dati.tagliate} tagliate su ${dati.totale}, il ${quote[0]}%.`
          }
        >
          <defs>
            {FETTE.map((f) => (
              <linearGradient key={f.key} id={`${uid}-${f.key}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={f.da} />
                <stop offset="100%" stopColor={f.a} />
              </linearGradient>
            ))}
          </defs>
          {vuoto ? (
            <>
              <circle className="torta-vuota" cx={CENTRO} cy={CENTRO} r={RAGGIO} />
              <text className="torta-vuota-testo" x={CENTRO} y={CENTRO + 4}>
                0%
              </text>
            </>
          ) : (
            disegnate.map((f) => {
              const [lx, ly] = unaSola
                ? [CENTRO, CENTRO]
                : punto(RAGGIO * 0.62, (f.da + f.a) / 2);
              return (
                <g key={f.key} className="torta-fetta">
                  {unaSola ? (
                    <circle cx={CENTRO} cy={CENTRO} r={RAGGIO} fill={`url(#${uid}-${f.key})`} />
                  ) : (
                    <path d={spicchio(f.da, f.a)} fill={`url(#${uid}-${f.key})`} />
                  )}
                  {f.quota >= 8 ? (
                    <text className="torta-etichetta" x={lx} y={ly}>
                      <tspan x={lx} dy={f.quota >= 20 ? "-0.15em" : "0.35em"}>
                        {f.quota}%
                      </tspan>
                      {f.quota >= 20 ? (
                        <tspan className="torta-etichetta-n" x={lx} dy="1.25em">
                          {f.quantita}
                        </tspan>
                      ) : null}
                    </text>
                  ) : null}
                </g>
              );
            })
          )}
        </svg>
        <ul className="torta-leggenda">
          {FETTE.map((f, i) => (
            <li key={f.key}>
              <span
                className="torta-dot"
                style={{ background: `linear-gradient(135deg, ${f.da}, ${f.a})` }}
              />
              {f.label}
              <strong>{dati[f.key]}</strong>
              <span className="torta-quota">{vuoto ? "—" : `${quote[i]}%`}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
