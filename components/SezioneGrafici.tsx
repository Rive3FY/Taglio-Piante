"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { annoPianoPiuRecente, campateDellAnno } from "@/lib/campate/anno";
import { URGENZE_VISIBILI } from "@/lib/campate/urgenze";
import { avanzamentoPriorita } from "@/lib/contabilita/aggrega";
import { riepilogoMappa } from "@/lib/grafici/densita";
import { inizioFinestraMesi } from "@/lib/grafici/ritmo";
import { GraficoRitmo } from "./GraficoRitmo";
import { MappaDensita } from "./MappaDensita";

const VUOTO = { punti: [], senzaCoordinate: 0, daTagliare: 0, tagliate: 0 };

export function SezioneGrafici() {
  const da = useMemo(() => inizioFinestraMesi(), []);
  const rapportiniQuery = useLiveQuery(
    () => db.rapportini.where("dataLavoro").between(da, "9999-12-31", true, true).toArray(),
    [da],
  );
  const campateQuery = useLiveQuery(() => db.campateLavoro.toArray(), []);

  const rapportini = useMemo(() => rapportiniQuery ?? [], [rapportiniQuery]);
  const campate = useMemo(() => campateQuery ?? [], [campateQuery]);
  const anno = useMemo(() => annoPianoPiuRecente(campate), [campate]);
  const delPiano = useMemo(() => campateDellAnno(campate, anno), [campate, anno]);
  const differibili = useMemo(() => avanzamentoPriorita(delPiano, "differibile"), [delPiano]);
  const urgenze = useMemo(
    () => (URGENZE_VISIBILI ? avanzamentoPriorita(delPiano, "urgente") : null),
    [delPiano],
  );
  const mappaDifferibili = useMemo(() => riepilogoMappa(delPiano, "differibile"), [delPiano]);
  const mappaUrgenze = useMemo(
    () => (URGENZE_VISIBILI ? riepilogoMappa(delPiano, "urgente") : VUOTO),
    [delPiano],
  );

  if (!rapportiniQuery || !campateQuery) {
    return (
      <section className="grafici" aria-label="Grafici">
        <h2 className="grafici-titolo">Grafici</h2>
        <p className="muted">Caricamento…</p>
      </section>
    );
  }

  return (
    <section className="grafici" aria-label="Grafici">
      <h2 className="grafici-titolo">Grafici</h2>
      <GraficoRitmo
        rapportini={rapportini}
        daTagliare={differibili.daTagliare}
        urgenzeDaTagliare={urgenze?.daTagliare}
      />
      <MappaDensita titolo="Differibili" anno={anno} riepilogo={mappaDifferibili} />
      {URGENZE_VISIBILI ? (
        <MappaDensita titolo="Urgenze" anno={anno} riepilogo={mappaUrgenze} />
      ) : null}
    </section>
  );
}
