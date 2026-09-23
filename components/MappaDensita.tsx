"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { urlGoogleMaps } from "@/lib/campate/geo";
import type { PuntoMappa, RiepilogoMappa } from "@/lib/grafici/mappa";

const SATELLITE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const NOMI =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUZIONE = "Immagini &copy; Esri, Maxar, Earthstar Geographics";

const ROSSO = "#ef4444";
const VERDE = "#22c55e";

type Livelli = {
  L: typeof Leaflet;
  mappa: Leaflet.Map;
  rosse: Leaflet.LayerGroup;
  verdi: Leaflet.LayerGroup;
  marker: Leaflet.CircleMarker[];
  rendererRosse: Leaflet.Renderer;
  rendererVerdi: Leaflet.Renderer;
};

async function caricaLeaflet() {
  const mod = await import("leaflet");
  return (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
}

/** Da lontano puntini piccoli senza bordo, così il tracciato della linea resta leggibile. */
function stileZoom(zoom: number) {
  if (zoom <= 9) return { radius: 2.5, weight: 0 };
  if (zoom <= 11) return { radius: 3.5, weight: 0.5 };
  if (zoom <= 13) return { radius: 5, weight: 1.5 };
  return { radius: 7, weight: 2 };
}

function escape(testo: string) {
  return testo.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function popup(p: PuntoMappa) {
  return `<strong>${escape(p.codiceLinea)} · ${escape(p.campata)}</strong><br/>${escape(p.nomeLinea)}<br/><span class="mappa-popup-stato ${p.tagliata ? "ok" : "da"}">${p.tagliata ? "Tagliata" : "Da tagliare"}</span><br/><a href="${urlGoogleMaps(p.lat, p.lng)}" target="_blank" rel="noopener noreferrer">Apri in Google Maps</a>`;
}

function riempi(livelli: Livelli, punti: PuntoMappa[]) {
  const { L, mappa, rosse, verdi, rendererRosse, rendererVerdi } = livelli;
  rosse.clearLayers();
  verdi.clearLayers();
  const stile = stileZoom(mappa.getZoom());
  const marker: Leaflet.CircleMarker[] = [];
  for (const p of punti) {
    const m = L.circleMarker([p.lat, p.lng], {
      pane: p.tagliata ? "campateVerdi" : "campateRosse",
      renderer: p.tagliata ? rendererVerdi : rendererRosse,
      radius: stile.radius,
      weight: stile.weight,
      color: "#ffffff",
      fillColor: p.tagliata ? VERDE : ROSSO,
      fillOpacity: p.tagliata ? 1 : 0.9,
    }).bindPopup(popup(p));
    (p.tagliata ? verdi : rosse).addLayer(m);
    marker.push(m);
  }
  livelli.marker = marker;
}

export function MappaDensita({
  titolo,
  anno,
  riepilogo,
}: {
  titolo: string;
  anno?: number;
  riepilogo: RiepilogoMappa;
}) {
  const contenitore = useRef<HTMLDivElement>(null);
  const livelliRef = useRef<Livelli | null>(null);
  const inquadrata = useRef(false);
  const [pronta, setPronta] = useState(false);
  const [mostraRosse, setMostraRosse] = useState(true);
  const [mostraVerdi, setMostraVerdi] = useState(true);
  const punti = riepilogo.punti;

  useEffect(() => {
    let annullato = false;
    let mappa: Leaflet.Map | null = null;
    void caricaLeaflet().then((L) => {
      if (annullato || !contenitore.current) return;
      mappa = L.map(contenitore.current, {
        center: [41.0, 14.5],
        zoom: 8,
        scrollWheelZoom: false,
      });
      L.tileLayer(SATELLITE, { maxZoom: 19, attribution: ATTRIBUZIONE }).addTo(mappa);
      L.tileLayer(NOMI, { maxZoom: 19, opacity: 0.85 }).addTo(mappa);
      mappa.attributionControl.setPrefix(false);
      // Le tagliate stanno sempre sopra: dove hai lavorato il verde non viene coperto dal rosso.
      mappa.createPane("campateRosse").style.zIndex = "410";
      mappa.createPane("campateVerdi").style.zIndex = "420";
      // La rotella zooma solo dopo un clic sulla mappa, così la pagina scorre normalmente.
      mappa.on("click", () => mappa?.scrollWheelZoom.enable());
      mappa.on("mouseout", () => mappa?.scrollWheelZoom.disable());

      const livelli: Livelli = {
        L,
        mappa,
        rosse: L.layerGroup(),
        verdi: L.layerGroup(),
        marker: [],
        rendererRosse: L.canvas({ pane: "campateRosse", padding: 0.3 }),
        rendererVerdi: L.canvas({ pane: "campateVerdi", padding: 0.3 }),
      };
      mappa.on("zoomend", () => {
        const stile = stileZoom(livelli.mappa.getZoom());
        for (const m of livelli.marker) m.setStyle(stile).setRadius(stile.radius);
      });
      livelliRef.current = livelli;
      setPronta(true);
    });
    return () => {
      annullato = true;
      livelliRef.current = null;
      inquadrata.current = false;
      mappa?.remove();
    };
  }, []);

  useEffect(() => {
    const livelli = livelliRef.current;
    if (!pronta || !livelli) return;
    riempi(livelli, punti);
    if (!inquadrata.current && punti.length > 0) {
      const bordi = livelli.L.latLngBounds(punti.map((p) => [p.lat, p.lng] as [number, number]));
      livelli.mappa.fitBounds(bordi, { padding: [24, 24], maxZoom: 14 });
      inquadrata.current = true;
    }
  }, [pronta, punti]);

  useEffect(() => {
    const livelli = livelliRef.current;
    if (!pronta || !livelli) return;
    const { mappa, rosse, verdi } = livelli;
    const mostra = (livello: Leaflet.Layer, si: boolean) => {
      if (si && !mappa.hasLayer(livello)) livello.addTo(mappa);
      if (!si && mappa.hasLayer(livello)) mappa.removeLayer(livello);
    };
    mostra(rosse, mostraRosse);
    mostra(verdi, mostraVerdi);
  }, [pronta, mostraRosse, mostraVerdi]);

  function inquadraTutte() {
    const livelli = livelliRef.current;
    if (!livelli || punti.length === 0) return;
    const bordi = livelli.L.latLngBounds(punti.map((p) => [p.lat, p.lng] as [number, number]));
    livelli.mappa.fitBounds(bordi, { padding: [24, 24], maxZoom: 14 });
  }

  return (
    <section className="panel grafici-card">
      <header className="grafici-head">
        <h2>{titolo}</h2>
        {anno ? <span className="grafici-anno">Piano {anno}</span> : null}
      </header>
      <p className="muted">
        Un puntino per campata: rosso da tagliare, verde tagliata. Trascina e usa lo zoom per
        muoverti; tocca un puntino per vedere linea e campata.
      </p>
      <div className="mappa-wrap">
        <div ref={contenitore} className="mappa-leaflet" aria-label={`Mappa satellitare ${titolo}`} />
        {pronta && punti.length === 0 ? (
          <p className="mappa-vuota">Nessuna coordinata in questo piano.</p>
        ) : null}
      </div>
      <div className="mappa-legenda">
        <button
          type="button"
          className={`chip mappa-chip${mostraRosse ? " on-rosso" : ""}`}
          aria-pressed={mostraRosse}
          onClick={() => setMostraRosse((v) => !v)}
        >
          <span className="mappa-dot mappa-dot-rosso" />
          Da tagliare <strong>{riepilogo.daTagliare}</strong>
        </button>
        <button
          type="button"
          className={`chip mappa-chip${mostraVerdi ? " on-verde" : ""}`}
          aria-pressed={mostraVerdi}
          onClick={() => setMostraVerdi((v) => !v)}
        >
          <span className="mappa-dot mappa-dot-verde" />
          Tagliate <strong>{riepilogo.tagliate}</strong>
        </button>
        <button type="button" className="btn btn-sm btn-secondary mappa-tutte" onClick={inquadraTutte}>
          Inquadra tutte
        </button>
      </div>
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
