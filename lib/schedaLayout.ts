/** Coordinate calibrate sul foglio `public/scheda-taglio.pdf` (716×1015 pt). */

export type Box = { x: number; y: number; w: number; h: number };

export type CombRow = Box & { cells: ReadonlyArray<{ x: number; w: number }> };

export const SCHEDA_HEADER = {
  codice: { x: 27.8, y: 942, w: 88, h: 22 } satisfies Box,
  descr: { x: 115.8, y: 942, w: 480.4, h: 22 } satisfies Box,
  campata: { x: 596.1, y: 942, w: 98.9, h: 22 } satisfies Box,
} as const;

/** Riga «In data … / Dipendente TERNA». */
export const SCHEDA_IN_DATA = {
  data: { x: 31.1, y: 909.6, w: 115, h: 16 } satisfies Box,
  terna: {
    x: 149.6,
    y: 909.6,
    w: 52,
    h: 16,
    cells: [
      { x: 149.6, w: 2.4 },
      { x: 152, w: 5.4 },
      { x: 157.4, w: 2.2 },
      { x: 159.6, w: 2.3 },
      { x: 161.9, w: 3.5 },
      { x: 165.4, w: 2.3 },
      { x: 167.6, w: 2.8 },
      { x: 170.4, w: 2.5 },
      { x: 172.9, w: 3.5 },
      { x: 176.4, w: 2.1 },
      { x: 179.6, w: 1.5 },
      { x: 181.1, w: 2.3 },
      { x: 183.4, w: 2.9 },
      { x: 186.3, w: 2.2 },
      { x: 188.5, w: 3.4 },
      { x: 191.9, w: 2.3 },
      { x: 194.1, w: 2.9 },
      { x: 197, w: 2.4 },
    ],
  } satisfies CombRow,
} as const;

/** Riga «Al Sig. … / Ditta …». */
export const SCHEDA_AL_SIG = {
  rep: { x: 58, y: 873.5, w: 135, h: 16 } satisfies Box,
  ditta: { x: 360, y: 873.5, w: 145, h: 16 } satisfies Box,
} as const;

export const SCHEDA_FOOTER = {
  date: { x: 61.1, y: 73, w: 28, h: 16 } satisfies Box,
  nOperatori: { x: 596.1, y: 73, w: 50.1, h: 16 } satisfies Box,
} as const;

export const SCHEDA_QTY = {
  x: 646.3,
  w: 49.1,
  h: 16,
  y: {
    "1.1": 695.4,
    "1.2": 673.7,
    "1.3": 652,
    "1.4": 630.4,
    "1.5": 608.7,
    "2.1": 587,
    "2.2": 565.3,
    "2.3": 543.6,
    "2.4": 511.2,
    "2.5": 473,
    "3.1": 446.2,
    "3.2": 422.2,
    "3.3": 404.1,
    "3.4": 376.7,
    "3.5": 343.9,
    "4.1": 319.5,
    "4.2": 296.7,
    "4.3": 277.9,
    "5.1": 259.1,
    "5.2": 240.4,
    "5.3": 225.6,
    "5.4": 202.7,
    "5.5": 183.9,
    "5.6": 165.1,
    "5.7": 146.4,
    "6.1": 127.6,
    "6.2": 112.8,
    "6.3": 104.6,
  } as Record<string, number>,
} as const;

export const SCHEDA_FIRME = {
  consegnaTerna: { x: 24, y: 752, w: 150, h: 28 },
  consegnaDitta: { x: 388, y: 752, w: 175, h: 28 },
  designatoTerna: { x: 90, y: 44, w: 140, h: 28 },
  designatoDitta: { x: 548, y: 44, w: 165, h: 28 },
} as const satisfies Record<string, Box>;
