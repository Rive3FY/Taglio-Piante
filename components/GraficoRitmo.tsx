"use client";

import { useId, useState } from "react";
import { URGENZE_VISIBILI } from "@/lib/campate/urgenze";
import { colonneRitmo, type ScalaRitmo } from "@/lib/grafici/ritmo";
import type { Rapportino } from "@/lib/types";

const LARGHEZZA = 640;
const ALTEZZA = 268;
const PAD_X = 36;
const PAD_DESTRA = 18;
const PAD_ALTO = 20;
const PAD_BASSO = 48;

function EtichettaColonna({ x, testo }: { x: number; testo: string }) {
  const [prima, seconda] = testo.split(" ");
  return (
    <text className="ritmo-etichetta" textAnchor="middle">
      <tspan x={x} y={ALTEZZA - (seconda ? 22 : 12)}>
        {prima}
      </tspan>
      {seconda ? (
        <tspan x={x} dy="12">
          {seconda}
        </tspan>
      ) : null}
    </text>
  );
}

function tacche(massimo: number) {
  if (massimo <= 4) return { tetto: Math.max(1, massimo), passo: 1 };
  const passo = Math.ceil(massimo / 4);
  return { tetto: passo * 4, passo };
}

export function GraficoRitmo({
  rapportini,
  daTagliare,
  urgenzeDaTagliare,
}: {
  rapportini: Rapportino[];
  daTagliare: number;
  urgenzeDaTagliare?: number;
}) {
  const uid = useId();
  const [scala, setScala] = useState<ScalaRitmo>("mese");
  const colonne = colonneRitmo(rapportini, scala);
  const massimo = Math.max(0, ...colonne.map((c) => c.rapportini));
  const { tetto, passo } = tacche(massimo);
  const internoLarghezza = LARGHEZZA - PAD_X - PAD_DESTRA;
  const internoAltezza = ALTEZZA - PAD_ALTO - PAD_BASSO;
  const slot = internoLarghezza / colonne.length;
  const barra = Math.min(scala === "mese" ? 26 : 18, slot * 0.62);
  const livelli: number[] = [];
  for (let valore = 0; valore <= tetto; valore += passo) livelli.push(valore);

  const totale = colonne.reduce((s, c) => s + c.rapportini, 0);
  const periodo = scala === "mese" ? "nei dodici mesi" : "nelle dodici settimane";

  return (
    <section className="panel grafici-card">
      <header className="grafici-head">
        <h2>Ritmo</h2>
        <div className="chip-row grafici-filtri">
          <button
            type="button"
            className={`chip ${scala === "mese" ? "on" : ""}`}
            aria-pressed={scala === "mese"}
            onClick={() => setScala("mese")}
          >
            Mensile
          </button>
          <button
            type="button"
            className={`chip ${scala === "settimana" ? "on" : ""}`}
            aria-pressed={scala === "settimana"}
            onClick={() => setScala("settimana")}
          >
            Settimanale
          </button>
        </div>
      </header>
      <p className="muted">
        {scala === "mese"
          ? "Rapportini archiviati in ciascun mese."
          : "Rapportini archiviati in ciascuna settimana."}{" "}
        {totale === 0
          ? `Nessuno ${periodo}.`
          : `${totale} ${totale === 1 ? "foglio" : "fogli"} ${periodo}.`}
      </p>
      <div className="grafici-corpo">
        <svg
          className="ritmo-svg"
          viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
          role="img"
          aria-label={colonne
            .map((c) => `${c.titolo}: ${c.rapportini} rapportini`)
            .join(". ")}
        >
          <defs>
            <linearGradient id={`${uid}-barra`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b4a9ff" />
              <stop offset="100%" stopColor="#6353e6" />
            </linearGradient>
          </defs>
          {livelli.map((valore) => {
            const y = PAD_ALTO + internoAltezza - (valore / tetto) * internoAltezza;
            return (
              <g key={valore}>
                <line className="ritmo-griglia" x1={PAD_X} x2={LARGHEZZA - PAD_DESTRA} y1={y} y2={y} />
                <text className="ritmo-asse" x={PAD_X - 8} y={y + 4} textAnchor="end">
                  {valore}
                </text>
              </g>
            );
          })}
          {colonne.map((c, i) => {
            const altezza = (c.rapportini / tetto) * internoAltezza;
            const x = PAD_X + slot * i + (slot - barra) / 2;
            const y = PAD_ALTO + internoAltezza - altezza;
            return (
              <g key={c.chiave}>
                <rect
                  className="ritmo-bar"
                  x={x}
                  y={altezza < 1 ? PAD_ALTO + internoAltezza - 2 : y}
                  width={barra}
                  height={Math.max(altezza, 2)}
                  rx={5}
                  fill={c.rapportini > 0 ? `url(#${uid}-barra)` : "rgba(139, 124, 248, 0.18)"}
                >
                  <title>
                    {c.titolo}: {c.rapportini} {c.rapportini === 1 ? "rapportino" : "rapportini"}
                  </title>
                </rect>
                {c.rapportini > 0 ? (
                  <text className="ritmo-valore" x={x + barra / 2} y={y - 6} textAnchor="middle">
                    {c.rapportini}
                  </text>
                ) : null}
                <EtichettaColonna x={x + barra / 2} testo={c.etichetta} />
              </g>
            );
          })}
        </svg>
        <aside className="grafici-stat">
          <span className="muted">Ancora da tagliare</span>
          <strong className={daTagliare === 0 ? "grafici-stat-ok" : undefined}>{daTagliare}</strong>
          <span className="grafici-stat-voce">{daTagliare === 1 ? "differibile" : "differibili"}</span>
          {URGENZE_VISIBILI && urgenzeDaTagliare != null ? (
            <>
              <strong className="grafici-stat-urg">{urgenzeDaTagliare}</strong>
              <span className="grafici-stat-voce">{urgenzeDaTagliare === 1 ? "urgenza" : "urgenze"}</span>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
