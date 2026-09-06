"use client";

import { useId } from "react";
import type { AvanzamentoPriorita } from "@/lib/contabilita/aggrega";
import { CAMPATA_PRIORITA_LABEL } from "@/lib/types";

const FETTE = [
  { key: "tagliate" as const, label: "Tagliate", da: "#22c55e", a: "#15803d" },
  { key: "daTagliare" as const, label: "Da tagliare", da: "#f59e0b", a: "#b45309" },
];

const LARGHEZZA = 300;
const CX = 150;
const CY = 132;
const RAGGIO_EST = 70;
const RAGGIO_INT = 40;
/** Spazio che serve alla scritta più lunga: i richiami non escono mai dal riquadro. */
const LARGHEZZA_ETICHETTA = 70;
/** Stacco tra le fette, in gradi: è quello che dà l'aria moderna alla torta. */
const STACCO = 2;

function punto(raggio: number, gradi: number) {
  const rad = ((gradi - 90) * Math.PI) / 180;
  return [CX + raggio * Math.cos(rad), CY + raggio * Math.sin(rad)] as const;
}

/** Mezza torta: si parte da sinistra e si gira in senso orario fino a destra. */
function angolo(frazione: number) {
  return 270 + frazione * 180;
}

function n(valore: number) {
  return valore.toFixed(2);
}

/** Lo stacco si stringe sulle fette sottili, se no una fetta di un grado si girerebbe. */
function fetta(da: number, a: number, stacco: number) {
  const s = Math.min(stacco, (a - da) * 0.35);
  const inizio = da + s / 2;
  const fine = a - s / 2;
  const [xe1, ye1] = punto(RAGGIO_EST, inizio);
  const [xe2, ye2] = punto(RAGGIO_EST, fine);
  const [xi2, yi2] = punto(RAGGIO_INT, fine);
  const [xi1, yi1] = punto(RAGGIO_INT, inizio);
  const grande = fine - inizio > 180 ? 1 : 0;
  return [
    `M ${n(xe1)} ${n(ye1)}`,
    `A ${RAGGIO_EST} ${RAGGIO_EST} 0 ${grande} 1 ${n(xe2)} ${n(ye2)}`,
    `L ${n(xi2)} ${n(yi2)}`,
    `A ${RAGGIO_INT} ${RAGGIO_INT} 0 ${grande} 0 ${n(xi1)} ${n(yi1)}`,
    "Z",
  ].join(" ");
}

/** Percentuali intere che sommano sempre a 100: il resto va alla fetta più grande. */
function percentuali(valori: number[], totale: number) {
  if (totale <= 0) return valori.map(() => 0);
  const grezze = valori.map((v) => (v / totale) * 100);
  const tonde = grezze.map((v, i) => {
    const arrotondata = Math.round(v);
    // Una campata che c'è non sparisce a zero, e finché ne resta una non è 100%.
    if (valori[i] > 0 && arrotondata === 0) return 1;
    if (valori[i] < totale && arrotondata === 100) return 99;
    return arrotondata;
  });
  const resto = 100 - tonde.reduce((s, v) => s + v, 0);
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

  const intero = Math.max(dati.totale, 1);
  const fette = FETTE.map((f, i) => {
    const quantita = dati[f.key];
    const prima = FETTE.slice(0, i).reduce((s, g) => s + dati[g.key], 0);
    return {
      ...f,
      quantita,
      quota: quote[i],
      inizio: angolo(prima / intero),
      fine: angolo((prima + quantita) / intero),
    };
  });
  const disegnate = fette.filter((f) => f.quantita > 0);
  const stacco = disegnate.length > 1 ? STACCO : 0;

  return (
    <section className="panel torta-card">
      <h2>{titolo}</h2>
      <p className="muted">
        {vuoto ? "Nessuna campata in elenco." : `${dati.tagliate} tagliate su ${dati.totale}`}
      </p>
      <div className="torta-layout">
        <svg
          className="torta-svg"
          viewBox={`0 0 ${LARGHEZZA} 152`}
          role="img"
          aria-label={
            vuoto
              ? `${titolo}: nessuna campata in elenco.`
              : `${titolo}: ${dati.tagliate} tagliate su ${dati.totale}, il ${quote[0]}%.`
          }
        >
          <defs>
            {FETTE.map((f) => (
              <linearGradient key={f.key} id={`${uid}-${f.key}`} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor={f.da} />
                <stop offset="100%" stopColor={f.a} />
              </linearGradient>
            ))}
          </defs>
          {vuoto ? (
            <path className="torta-vuota" d={fetta(270, 450, 0)} />
          ) : (
            disegnate.map((f) => {
              const meta = f.inizio + (f.fine - f.inizio) / 2;
              const [xg1, yg1] = punto(RAGGIO_EST + 4, meta);
              const [xg2, yg2] = punto(RAGGIO_EST + 14, meta);
              const sinistra = xg2 < CX;
              const xg3 = sinistra
                ? Math.max(xg2 - 12, LARGHEZZA_ETICHETTA)
                : Math.min(xg2 + 12, LARGHEZZA - LARGHEZZA_ETICHETTA);
              const xt = xg3 + (sinistra ? -4 : 4);
              return (
                <g key={f.key}>
                  <path
                    className="torta-fetta"
                    d={fetta(f.inizio, f.fine, stacco)}
                    fill={`url(#${uid}-${f.key})`}
                  />
                  <path
                    className="torta-guida"
                    d={`M ${n(xg1)} ${n(yg1)} L ${n(xg2)} ${n(yg2)} L ${n(xg3)} ${n(yg2)}`}
                    stroke={f.a}
                  />
                  <text x={xt} y={yg2} textAnchor={sinistra ? "end" : "start"}>
                    <tspan className="torta-callout-nome" x={xt} dy="-0.25em">
                      {f.label}
                    </tspan>
                    <tspan className="torta-callout-quota" x={xt} dy="1.2em">
                      {f.quota}%
                    </tspan>
                  </text>
                </g>
              );
            })
          )}
        </svg>
        <ul className="torta-leggenda">
          {FETTE.map((f) => (
            <li key={f.key}>
              <span
                className="torta-dot"
                style={{ background: `linear-gradient(135deg, ${f.da}, ${f.a})` }}
              />
              {f.label}
              <strong>{dati[f.key]}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
