"use client";

import { useEffect, useRef } from "react";
import { rasterDensita, type RiepilogoMappa } from "@/lib/grafici/densita";

export function MappaDensita({
  titolo,
  anno,
  riepilogo,
}: {
  titolo: string;
  anno?: number;
  riepilogo: RiepilogoMappa;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const punti = riepilogo.punti;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame = 0;

    const disegna = () => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW < 10 || cssH < 10) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const cols = Math.max(180, Math.round(cssW));
      const rows = Math.max(120, Math.round((cssH * cols) / cssW));
      const pixels = rasterDensita(punti, cols, rows);
      const fuori = document.createElement("canvas");
      fuori.width = cols;
      fuori.height = rows;
      const sorgente = fuori.getContext("2d");
      const ctx = canvas.getContext("2d");
      if (!sorgente || !ctx) return;
      sorgente.putImageData(new ImageData(pixels, cols, rows), 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(fuori, 0, 0, w, h);
    };

    const osserva = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(disegna);
    });
    osserva.observe(canvas);
    frame = requestAnimationFrame(disegna);
    return () => {
      cancelAnimationFrame(frame);
      osserva.disconnect();
    };
  }, [punti]);

  const inMappa = punti.length;
  const vuota = inMappa === 0;

  return (
    <section className="panel grafici-card">
      <header className="grafici-head">
        <h2>{titolo}</h2>
        {anno ? <span className="grafici-anno">Piano {anno}</span> : null}
      </header>
      <p className="muted">
        Rosso: ancora da tagliare. Verde: già tagliate. La macchia è più intensa dove le campate
        sono più vicine.
      </p>
      <div className="mappa-wrap">
        <canvas ref={ref} className="mappa-canvas" role="img" aria-label={etichettaMappa(titolo, riepilogo)} />
        {vuota ? <p className="mappa-vuota">Nessuna coordinata in questo piano.</p> : null}
      </div>
      <ul className="mappa-legenda">
        <li>
          <span className="mappa-dot mappa-dot-rosso" />
          Da tagliare
          <strong>{riepilogo.daTagliare}</strong>
        </li>
        <li>
          <span className="mappa-dot mappa-dot-verde" />
          Tagliate
          <strong>{riepilogo.tagliate}</strong>
        </li>
      </ul>
      {riepilogo.senzaCoordinate > 0 ? (
        <p className="muted">
          {riepilogo.senzaCoordinate}{" "}
          {riepilogo.senzaCoordinate === 1 ? "campata senza coordinate" : "campate senza coordinate"}
          , fuori dalla mappa.
        </p>
      ) : null}
    </section>
  );
}

function etichettaMappa(titolo: string, riepilogo: RiepilogoMappa) {
  if (riepilogo.punti.length === 0) return `${titolo}: nessuna coordinata da mostrare.`;
  return `${titolo}: ${riepilogo.daTagliare} da tagliare in rosso, ${riepilogo.tagliate} tagliate in verde.`;
}
