import { wgs84DaEstNord } from "@/lib/campate/geo";
import { mostraCampata } from "@/lib/campate/normalize";
import { campataETagliata, type CampataLavoro, type CampataPriorita } from "@/lib/types";

export type PuntoMappa = {
  id: string;
  lat: number;
  lng: number;
  tagliata: boolean;
  codiceLinea: string;
  nomeLinea: string;
  campata: string;
};

export type RiepilogoMappa = {
  punti: PuntoMappa[];
  senzaCoordinate: number;
  daTagliare: number;
  tagliate: number;
};

/** Campate del piano, senza le basi: il rosso è da tagliare, il verde è già chiusa. */
export function riepilogoMappa(campate: CampataLavoro[], priorita: CampataPriorita): RiepilogoMappa {
  const punti: PuntoMappa[] = [];
  let senzaCoordinate = 0;
  let daTagliare = 0;
  let tagliate = 0;
  for (const c of campate) {
    if (c.tipo === "base" || c.priorita !== priorita) continue;
    const tagliata = campataETagliata(c);
    if (tagliata) tagliate += 1;
    else daTagliare += 1;
    const punto = wgs84DaEstNord(c.estInt, c.nordInt, c.nomeLinea);
    if (!punto) {
      senzaCoordinate += 1;
      continue;
    }
    punti.push({
      id: c.id,
      lat: punto.lat,
      lng: punto.lng,
      tagliata,
      codiceLinea: c.codiceLinea,
      nomeLinea: c.nomeLinea,
      campata: mostraCampata(c.normalizzata),
    });
  }
  return { punti, senzaCoordinate, daTagliare, tagliate };
}
