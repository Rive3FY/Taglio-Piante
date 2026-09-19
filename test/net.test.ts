import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErroreRete,
  conScadenza,
  eDiRete,
  fetchConScadenza,
  segnalaScambioFallito,
  segnalaScambioRiuscito,
  statoRete,
} from "@/lib/net";

/** Il codice guarda navigator.onLine in parecchi punti: qui lo si pilota a mano. */
function fingiDispositivo(onLine: boolean) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine },
    configurable: true,
    writable: true,
  });
}

describe("riconoscere un guaio di linea da un guaio di dati", () => {
  beforeEach(() => fingiDispositivo(true));

  it("tratta come linea le fetch fallite, i timeout e gli abort", () => {
    expect(eDiRete(new ErroreRete())).toBe(true);
    expect(eDiRete(new TypeError("Failed to fetch"))).toBe(true);
    expect(eDiRete(new TypeError("Load failed"))).toBe(true);
    expect(eDiRete(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
  });

  it("non tratta come linea gli errori del database", () => {
    expect(eDiRete(new Error("violates row-level security policy"))).toBe(false);
    expect(eDiRete(new Error("could not find the 'rinvio_mese' column"))).toBe(false);
    expect(eDiRete(new Error("duplicate key value violates unique constraint"))).toBe(false);
  });

  it("senza segnale qualunque errore è di linea", () => {
    fingiDispositivo(false);
    expect(eDiRete(new Error("violates row-level security policy"))).toBe(true);
  });
});

describe("stato della rete", () => {
  beforeEach(() => fingiDispositivo(true));

  it("passa a instabile quando il server non risponde e torna online al primo scambio", () => {
    segnalaScambioRiuscito();
    expect(statoRete()).toBe("online");

    segnalaScambioFallito(new ErroreRete());
    expect(statoRete()).toBe("instabile");

    segnalaScambioRiuscito();
    expect(statoRete()).toBe("online");
  });

  it("un errore di dati non fa credere che la linea sia caduta", () => {
    segnalaScambioRiuscito();
    segnalaScambioFallito(new Error("violates row-level security policy"));
    expect(statoRete()).toBe("online");
  });

  it("senza segnale lo stato è offline, non instabile", () => {
    fingiDispositivo(false);
    segnalaScambioFallito(new ErroreRete());
    expect(statoRete()).toBe("offline");
  });
});

describe("scadenze", () => {
  beforeEach(() => {
    fingiDispositivo(true);
    segnalaScambioRiuscito();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("conScadenza molla la presa invece di aspettare per sempre", async () => {
    const maiRisolta = new Promise(() => {});
    await expect(conScadenza(maiRisolta, 20, "La prova")).rejects.toThrow(/non ha risposto in tempo/);
  });

  it("conScadenza lascia passare chi risponde in tempo", async () => {
    await expect(conScadenza(Promise.resolve("ok"), 500)).resolves.toBe("ok");
  });

  it("una fetch che resta appesa scade e segnala linea debole", async () => {
    vi.stubGlobal("fetch", (_input: unknown, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    });

    await expect(fetchConScadenza("https://esempio.test/x", undefined, 20)).rejects.toThrow(
      ErroreRete,
    );
    expect(statoRete()).toBe("instabile");
  });

  it("una risposta arrivata, anche con errore del server, vale come linea che funziona", async () => {
    segnalaScambioFallito(new ErroreRete());
    expect(statoRete()).toBe("instabile");

    vi.stubGlobal("fetch", async () => new Response("no", { status: 500 }));
    const res = await fetchConScadenza("https://esempio.test/x", undefined, 500);

    expect(res.status).toBe(500);
    expect(statoRete()).toBe("online");
  });
});
