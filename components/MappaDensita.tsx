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

const GRADIENTE_ROSSO = { 0.2: "#7f1d1d", 0.45: "#dc2626", 0.75: "#f87171", 1: "#fee2e2" };
const GRADIENTE_VERDE = { 0.2: "#14532d", 0.45: "#16a34a", 0.75: "#4ade80", 1: "#dcfce7" };
/** Da questo zoom in su compaiono anche i puntini delle singole campate. */
const ZOOM_PUNTI = 13;

type Livelli = {
  mappa: Leaflet.Map;
  caldoRosso: Leaflet.HeatLayer;
  caldoVerde: Leaflet.HeatLayer;
  puntiRossi: Leaflet.LayerGroup;
  puntiVerdi: Leaflet.LayerGroup;
  L: typeof Leaflet;
};

async function caricaLeaflet() {
  const mod = await import("leaflet");
  const L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
  // leaflet.heat si aggancia al Leaflet globale.
  (window as unknown as { L: typeof Leaflet }).L = L;
  await import("leaflet.heat");
  return L;
}

function escape(testo: string) {
  return testo.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function popup(p: PuntoMappa) {
  return `<strong>${escape(p.codiceLinea)} · ${escape(p.campata)}</strong><br/>${escape(p.nomeLinea)}<br/><span class="mappa-popup-stato ${p.tagliata ? "ok" : "da"}">${p.tagliata ? "Tagliata" : "Da tagliare"}</span><br/><a href="${urlGoogleMaps(p.lat, p.lng)}" target="_blank" rel="noopener noreferrer">Apri in Google Maps</a>`;
}

function riempi(livelli: Livelli, punti: PuntoMappa[]) {
  const { L, caldoRosso, caldoVerde, puntiRossi, puntiVerdi } = livelli;
  const rossi = punti.filter((p) => !p.tagliata);
  const verdi = punti.filter((p) => p.tagliata);
  caldoRosso.setLatLngs(rossi.map((p) => [p.lat, p.lng, 1] as Leaflet.HeatLatLngTuple));
  caldoVerde.setLatLngs(verdi.map((p) => [p.lat, p.lng, 1] as Leaflet.HeatLatLngTuple));
  puntiRossi.clearLayers();
  puntiVerdi.clearLayers();
  const renderer = L.canvas({ padding: 0.3 });
  for (const p of punti) {
    const marker = L.circleMarker([p.lat, p.lng], {
      renderer,
      radius: 6,
      weight: 2,
      color: "#ffffff",
      fillColor: p.tagliata ? "#22c55e" : "#ef4444",
      fillOpacity: 0.95,
    }).bindPopup(popup(p));
    (p.tagliata ? puntiVerdi : puntiRossi).addLayer(marker);
  }
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
        attributionControl: true,
      });
      L.tileLayer(SATELLITE, { maxZoom: 19, attribution: ATTRIBUZIONE }).addTo(mappa);
      L.tileLayer(NOMI, { maxZoom: 19, opacity: 0.85 }).addTo(mappa);
      mappa.attributionControl.setPrefix(false);
      // La rotella zooma solo dopo un clic sulla mappa, così la pagina scorre normalmente.
      mappa.on("click", () => mappa?.scrollWheelZoom.enable());
      mappa.on("mouseout", () => mappa?.scrollWheelZoom.disable());

      const livelli: Livelli = {
        L,
        mappa,
        caldoRosso: L.heatLayer([], { radius: 22, blur: 18, minOpacity: 0.35, max: 3, maxZoom: 12, gradient: GRADIENTE_ROSSO }),
        caldoVerde: L.heatLayer([], { radius: 22, blur: 18, minOpacity: 0.4, max: 2, maxZoom: 12, gradient: GRADIENTE_VERDE }),
        puntiRossi: L.layerGroup(),
        puntiVerdi: L.layerGroup(),
      };
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
    const { mappa, caldoRosso, caldoVerde, puntiRossi, puntiVerdi } = livelli;

    const aggiorna = () => {
      const vicino = mappa.getZoom() >= ZOOM_PUNTI;
      const mostra = (livello: Leaflet.Layer, si: boolean) => {
        if (si && !mappa.hasLayer(livello)) livello.addTo(mappa);
        if (!si && mappa.hasLayer(livello)) mappa.removeLayer(livello);
      };
      mostra(caldoRosso, mostraRosse);
      mostra(caldoVerde, mostraVerdi);
      mostra(puntiRossi, mostraRosse && vicino);
      mostra(puntiVerdi, mostraVerdi && vicino);
    };
    aggiorna();
    mappa.on("zoomend", aggiorna);
    return () => {
      mappa.off("zoomend", aggiorna);
    };
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
        Trascina e usa lo zoom per muoverti. Da vicino compaiono le singole campate: toccane una per
        vedere linea e campata.
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
