/** Coordinate calibrate sul foglio `public/scheda-taglio.pdf` (716.82 × 1014.51 pt). */

export type Box = { x: number; y: number; w: number; h: number };

/** Testo sulla riga stampata: `y` è la baseline, come nel PDF. */
export type LineText = { x: number; y: number; maxW: number; size: number };

export const SCHEDA_HEADER = {
  codice: { x: 28.1, y: 944.8, w: 87.9, h: 20.7 } satisfies Box,
  descr: { x: 116.0, y: 944.8, w: 480.4, h: 20.7 } satisfies Box,
  campata: { x: 596.4, y: 944.8, w: 98.9, h: 20.7 } satisfies Box,
} as const;

/** «In data …» — sui puntini, non sopra la scritta. */
export const SCHEDA_IN_DATA: LineText = { x: 66, y: 915.5, maxW: 72, size: 9 };

/** «Il sottoscritto …» Dipendente TERNA. */
export const SCHEDA_IN_DATA_TERNA: LineText = { x: 211, y: 915.5, maxW: 116, size: 8.5 };

/** «Al Sig. …» */
export const SCHEDA_AL_SIG_REP: LineText = { x: 64, y: 879.4, maxW: 94, size: 9 };

/** «… della Ditta …» */
export const SCHEDA_AL_SIG_DITTA: LineText = { x: 351, y: 879.4, maxW: 50, size: 8 };

/** Data sotto l’etichetta; N° operatori nel riquadro piccolo a destra. */
export const SCHEDA_FOOTER = {
  date: { x: 28.1, y: 68, w: 87.9, h: 10.5 } satisfies Box,
  nOperatori: { x: 596.4, y: 80.5, w: 50, h: 11 } satisfies Box,
} as const;

export const SCHEDA_QTY = {
  x: 646.5,
  w: 48.8,
  h: 20.8,
  y: {
    "1.1": 711.4,
    "1.2": 689.7,
    "1.3": 668.0,
    "1.4": 646.4,
    "1.5": 624.7,
    "2.1": 603.0,
    "2.2": 581.3,
    "2.3": 559.6,
    "2.4": 521.6,
    "2.5": 482.2,
    "3.1": 462.0,
    "3.2": 438.0,
    "3.3": 419.8,
    "3.4": 390.0,
    "3.5": 353.4,
    "4.1": 335.5,
    "4.2": 316.7,
    "4.3": 297.9,
    "5.1": 279.1,
    "5.2": 260.3,
    "5.3": 241.5,
    "5.4": 222.7,
    "5.5": 203.9,
    "5.6": 185.1,
    "5.7": 166.3,
    "6.1": 147.5,
    "6.2": 128.7,
    "6.3": 106.1,
  } as Record<string, number>,
  hByCode: {
    "2.4": 38,
    "2.5": 39.4,
    "3.2": 24,
    "3.4": 29.8,
    "3.5": 36.6,
    "6.3": 22.6,
  } as Record<string, number>,
} as const;

export function schedaQtyBox(codice: string): Box | null {
  const y = SCHEDA_QTY.y[codice];
  if (y == null) return null;
  return {
    x: SCHEDA_QTY.x,
    y,
    w: SCHEDA_QTY.w,
    h: SCHEDA_QTY.hByCode[codice] ?? SCHEDA_QTY.h,
  };
}

/** Firme in chiusura, nella fascia sotto Data / Personale. */
export const SCHEDA_FIRME = {
  designatoTerna: { x: 130, y: 50.3, w: 200, h: 18 },
  designatoDitta: { x: 490, y: 50.3, w: 190, h: 18 },
} as const satisfies Record<string, Box>;
