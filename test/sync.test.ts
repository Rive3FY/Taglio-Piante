import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroreRete, SCADENZA_GIRO } from "@/lib/net";
import type { StatoAuth } from "@/lib/supabase/remote";
import type { Rapportino, Session } from "@/lib/types";

const remote = {
  statoAutenticazione: vi.fn<() => Promise<StatoAuth>>(async () => "ok"),
  pushRapportino: vi.fn<(r: Rapportino) => Promise<void>>(async () => {}),
  deleteRemoteRapportino: vi.fn<(id: string) => Promise<void>>(async () => {}),
  pushCampatePending: vi.fn<(id?: string) => Promise<void>>(async () => {}),
  pullRapportini: vi.fn(async () => 0),
  pullReferenceData: vi.fn(async () => {}),
  pullDeletedRapportini: vi.fn(async () => 0),
  idsConNumero: vi.fn(async () => [] as string[]),
  clearPullCursor: vi.fn(),
  supabaseReady: vi.fn(() => false),
};

vi.mock("@/lib/supabase/remote", () => remote);
vi.mock("@/lib/campate/apply", () => ({
  ripristinaCampateOrfane: vi.fn(async () => 0),
  unisciCampateDoppie: vi.fn(async () => 0),
  annullaEsitiDaRapportino: vi.fn(async () => {}),
}));

const { db, enqueueSync } = await import("@/lib/db");
const { processSyncQueue } = await import("@/lib/sync");
const { writeSession } = await import("@/lib/session");

const TECNICO: Session = {
  userId: "u1",
  nome: "Tecnico",
  email: "t@esempio.it",
  ruolo: "tecnico",
};

function foglio(id: string, extra: Partial<Rapportino> = {}): Rapportino {
  const adesso = new Date().toISOString();
  return {
    id,
    numero: `RT-2026-${id.slice(-4).padStart(4, "0")}`,
    lineaId: "lin_a",
    campata: "1-2",
    dataLavoro: "2026-09-01",
    ditta: "Ditta",
    rappresentanteDitta: "Mario",
    dipendenteTerna: "Luigi",
    nOperatori: 2,
    stato: "bozza",
    syncStatus: "pending",
    righe: [],
    createdAt: adesso,
    updatedAt: adesso,
    ownerId: "u1",
    ...extra,
  };
}

async function preparaCoda(quanti: number) {
  for (let i = 1; i <= quanti; i += 1) {
    const id = `rap_000${i}`;
    await db.rapportini.put(foglio(id));
    await enqueueSync(id, "upsert");
  }
}

beforeEach(async () => {
  vi.clearAllMocks();
  remote.statoAutenticazione.mockResolvedValue("ok");
  remote.pushRapportino.mockResolvedValue(undefined);
  localStorage.clear();
  writeSession(TECNICO);
  (globalThis.navigator as { onLine: boolean }).onLine = true;
  await db.syncQueue.clear();
  await db.rapportini.clear();
});

describe("quando cade la linea a metà invio", () => {
  it("si ferma alla prima voce invece di bruciare una scadenza per ognuna", async () => {
    await preparaCoda(4);
    remote.pushRapportino.mockRejectedValue(new ErroreRete());

    const esito = await processSyncQueue();

    expect(remote.pushRapportino).toHaveBeenCalledTimes(1);
    expect(esito.interrotta).toBe(true);
    expect(esito.processed).toBe(0);
    expect(await db.syncQueue.count()).toBe(4);
  });

  it("non legge dal server dopo un invio fallito", async () => {
    await preparaCoda(1);
    remote.pushRapportino.mockRejectedValue(new ErroreRete());

    await processSyncQueue();

    expect(remote.pullRapportini).not.toHaveBeenCalled();
    expect(remote.pullReferenceData).not.toHaveBeenCalled();
  });

  it("lascia il rapportino «da inviare», non lo mette in errore", async () => {
    await preparaCoda(1);
    remote.pushRapportino.mockRejectedValue(new ErroreRete());

    await processSyncQueue();

    expect((await db.rapportini.get("rap_0001"))?.syncStatus).toBe("pending");
  });

  it("riprova più tardi, non subito", async () => {
    await preparaCoda(1);
    remote.pushRapportino.mockRejectedValue(new ErroreRete());
    await processSyncQueue();

    const voce = (await db.syncQueue.toArray())[0];
    expect(voce.attempts).toBe(1);
    expect(new Date(voce.nextAttemptAt!).getTime()).toBeGreaterThan(Date.now());
    expect(voce.bloccato).toBe(false);

    remote.pushRapportino.mockResolvedValue(undefined);
    const secondo = await processSyncQueue();
    expect(secondo.processed).toBe(0);

    const manuale = await processSyncQueue({ manuale: true });
    expect(manuale.processed).toBe(1);
  });
});

describe("quando è il contenuto a non andare giù", () => {
  it("mette il rapportino in errore e dopo cinque tentativi smette di insistere", async () => {
    await preparaCoda(1);
    remote.pushRapportino.mockRejectedValue(new Error("violates row-level security policy"));

    for (let i = 0; i < 5; i += 1) {
      await processSyncQueue({ manuale: true });
    }

    expect((await db.rapportini.get("rap_0001"))?.syncStatus).toBe("error");
    const voce = (await db.syncQueue.toArray())[0];
    expect(voce.attempts).toBe(5);
    expect(voce.bloccato).toBe(true);

    const esito = await processSyncQueue();
    expect(esito.bloccate).toBe(1);
    expect(esito.pullError).toMatch(/row-level security/);
  });

  it("prova comunque le altre voci: non è la linea a mancare", async () => {
    await preparaCoda(3);
    remote.pushRapportino.mockRejectedValue(new Error("violates row-level security policy"));

    await processSyncQueue();

    expect(remote.pushRapportino).toHaveBeenCalledTimes(3);
  });
});

describe("accesso", () => {
  it("senza risposta dal server non parla di sessione scaduta", async () => {
    await preparaCoda(1);
    remote.statoAutenticazione.mockResolvedValue("irraggiungibile");

    const esito = await processSyncQueue();

    expect(esito.pullError).toMatch(/linea/i);
    expect(esito.pullError).not.toMatch(/sessione/i);
    expect(remote.pushRapportino).not.toHaveBeenCalled();
  });

  it("con il token rifiutato chiede di rientrare con lo stesso account", async () => {
    await preparaCoda(1);
    remote.statoAutenticazione.mockResolvedValue("scaduta");

    const esito = await processSyncQueue();

    expect(esito.pullError).toMatch(/stesso account/i);
  });

  it("senza database collegato non svuota la coda", async () => {
    await preparaCoda(2);
    remote.statoAutenticazione.mockResolvedValue("non-configurato");

    const esito = await processSyncQueue();

    expect(await db.syncQueue.count()).toBe(2);
    expect(esito.pending).toBe(2);
    expect(remote.pushRapportino).not.toHaveBeenCalled();
  });
});

describe("senza segnale", () => {
  it("non tenta nemmeno e conta cosa resta da mandare", async () => {
    await preparaCoda(2);
    (globalThis.navigator as { onLine: boolean }).onLine = false;

    const esito = await processSyncQueue();

    expect(esito.pending).toBe(2);
    expect(remote.statoAutenticazione).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(2);
  });
});

describe("un giro che non finisce", () => {
  it("non tiene bloccate le richieste successive", async () => {
    let sblocca: () => void = () => {};
    const invioMaiConcluso = new Promise<void>((risolvi) => {
      sblocca = risolvi;
    });

    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      await preparaCoda(1);
      remote.pushRapportino.mockReturnValue(invioMaiConcluso);

      const primo = processSyncQueue();
      await vi.advanceTimersByTimeAsync(SCADENZA_GIRO + 1_000);
      const esito = await primo;
      expect(esito.interrotta).toBe(true);

      // Il giro vecchio è ancora appeso: il successivo risponde subito
      // invece di restituire la stessa promessa impantanata.
      const secondo = await processSyncQueue();
      expect(secondo.interrotta).toBe(true);
    } finally {
      vi.useRealTimers();
      sblocca();
      await new Promise((r) => setTimeout(r, 50));
    }
  });
});

describe("coda", () => {
  it("non manda lo stesso foglio due volte per azioni che fanno la stessa chiamata", async () => {
    await db.rapportini.put(foglio("rap_0001"));
    await enqueueSync("rap_0001", "upsert");
    await enqueueSync("rap_0001", "archive");
    await enqueueSync("rap_0001", "take");

    expect(await db.syncQueue.count()).toBe(1);

    await processSyncQueue();
    expect(remote.pushRapportino).toHaveBeenCalledTimes(1);
  });

  it("manda prima il rapportino e poi le campate", async () => {
    const ordine: string[] = [];
    remote.pushRapportino.mockImplementation(async () => {
      ordine.push("rapportino");
    });
    remote.pushCampatePending.mockImplementation(async () => {
      ordine.push("campate");
    });

    await enqueueSync("camp_1", "campate");
    await db.rapportini.put(foglio("rap_0001"));
    await enqueueSync("rap_0001", "upsert");

    await processSyncQueue();

    expect(ordine[0]).toBe("rapportino");
  });
});
