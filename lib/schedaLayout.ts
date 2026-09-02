/** Coordinate calibrate sul foglio `public/scheda-taglio.pdf` (716×1015 pt). */

export type Box = { x: number; y: number; w: number; h: number };

export type CombRow = Box & { cells: ReadonlyArray<{ x: number; w: number }> };

export const SCHEDA_HEADER = {
  codice: { x: 27.8, y: 942, w: 88, h: 22 } satisfies Box,
  descr: { x: 115.8, y: 942, w: 480.4, h: 22 } satisfies Box,
  campata: { x: 596.1, y: 942, w: 98.9, h: 22 } satisfies Box,
} as const;

/** Riga «In data … / Dipendente TERNA» — caratteri sui puntini. */
export const SCHEDA_IN_DATA: CombRow = {
  x: 31.1,
  y: 908,
  w: 170,
  h: 14,
  cells: [
    { x: 31.1, w: 2.4 },
    { x: 33.5, w: 3.4 },
    { x: 36.9, w: 4.9 },
    { x: 41.8, w: 3.4 },
    { x: 45.1, w: 2.4 },
    { x: 47.5, w: 3.1 },
    { x: 50.6, w: 2.3 },
    { x: 52.9, w: 2.9 },
    { x: 55.8, w: 3.1 },
    { x: 59, w: 3.1 },
  ],
};

export const SCHEDA_IN_DATA_TERNA: CombRow = {
  x: 149.6,
  y: 908,
  w: 52,
  h: 14,
  cells: [
    { x: 149.6, w: 2.4 },
    { x: 152, w: 5.4 },
    { x: 157.4, w: 2.4 },
    { x: 159.7, w: 2.1 },
    { x: 161.9, w: 3.6 },
    { x: 165.5, w: 2.1 },
    { x: 167.6, w: 2.8 },
    { x: 170.4, w: 2.5 },
    { x: 172.9, w: 3.6 },
    { x: 176.5, w: 2.2 },
    { x: 179.6, w: 1.7 },
    { x: 181.3, w: 2.3 },
    { x: 183.5, w: 3 },
    { x: 186.5, w: 2 },
    { x: 188.5, w: 3.4 },
    { x: 191.9, w: 2.3 },
    { x: 194.1, w: 2.9 },
    { x: 197, w: 2.5 },
    { x: 199.5, w: 3.3 },
  ],
};

/** Riga «Al Sig. … / Ditta …» — caratteri sui puntini. */
export const SCHEDA_AL_SIG_REP: CombRow = {
  x: 57.1,
  y: 869,
  w: 125,
  h: 14,
  cells: [
    { x: 57.1, w: 8.5 },
    { x: 65.7, w: 3.6 },
    { x: 69.3, w: 2.8 },
    { x: 72.1, w: 10.1 },
    { x: 82.2, w: 3.6 },
    { x: 85.8, w: 3.3 },
    { x: 89, w: 6.9 },
    { x: 95.9, w: 3.5 },
    { x: 99.4, w: 9.7 },
    { x: 109.1, w: 3.5 },
    { x: 112.7, w: 6.3 },
    { x: 118.9, w: 3.6 },
    { x: 122.5, w: 10.1 },
    { x: 132.7, w: 3.5 },
    { x: 136.2, w: 9.6 },
    { x: 145.8, w: 3.6 },
    { x: 149.4, w: 2.8 },
    { x: 152.2, w: 10.1 },
    { x: 162.3, w: 3.6 },
    { x: 165.9, w: 6.3 },
    { x: 172.1, w: 5.9 },
    { x: 178, w: 2.4 },
  ],
};

export const SCHEDA_AL_SIG_DITTA: CombRow = {
  x: 360.5,
  y: 869,
  w: 140,
  h: 14,
  cells: [
    { x: 360.5, w: 3.5 },
    { x: 364, w: 6.9 },
    { x: 370.9, w: 9.3 },
    { x: 380.2, w: 4 },
    { x: 384.2, w: 3.4 },
    { x: 387.6, w: 5.8 },
    { x: 393.4, w: 3.5 },
    { x: 396.9, w: 6.9 },
    { x: 403.8, w: 3.5 },
    { x: 407.3, w: 6.9 },
    { x: 414.2, w: 3.5 },
    { x: 417.7, w: 6.9 },
    { x: 424.6, w: 3.5 },
    { x: 428.1, w: 6.9 },
    { x: 435, w: 3.5 },
    { x: 438.5, w: 6.9 },
    { x: 445.4, w: 3.5 },
    { x: 448.9, w: 6.9 },
    { x: 455.8, w: 3.5 },
    { x: 459.3, w: 6.9 },
    { x: 466.2, w: 3.5 },
    { x: 469.7, w: 6.9 },
    { x: 476.6, w: 3.5 },
    { x: 480.1, w: 6.9 },
    { x: 487, w: 3.5 },
    { x: 490.5, w: 6.9 },
  ],
};

/** Riga sotto l’intestazione «Data» / «N° Operatori» (non sulla riga delle etichette). */
export const SCHEDA_FOOTER = {
  date: {
    x: 28,
    y: 58,
    w: 88,
    h: 14,
    cells: [
      { x: 31.1, w: 5.5 },
      { x: 36.6, w: 5.5 },
      { x: 42.1, w: 5.5 },
      { x: 47.6, w: 5.5 },
      { x: 53.1, w: 5.5 },
      { x: 58.6, w: 5.5 },
      { x: 64.1, w: 5.5 },
      { x: 69.6, w: 5.5 },
      { x: 75.1, w: 5.5 },
      { x: 80.6, w: 5.5 },
    ],
  } satisfies CombRow,
  nOperatori: { x: 596.1, y: 58, w: 50.1, h: 14 } satisfies Box,
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

/** Solo firme in chiusura (Designato TERNA / Ditta). */
export const SCHEDA_FIRME = {
  designatoTerna: { x: 90, y: 44, w: 140, h: 28 },
  designatoDitta: { x: 548, y: 44, w: 165, h: 28 },
} as const satisfies Record<string, Box>;
