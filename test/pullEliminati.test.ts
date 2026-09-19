import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Rapportino } from "@/lib/types";

/** Finta catena PostgREST: from(...).select(...).is(...).order(...).range(...) */
function finteRighe(ids: string[]) {
  const catena = {
    select: () => catena,
    is: () => catena,
    order: () => catena,
    range: (da: number, a: number) =>
      Promise.resolve({ data: ids.slice(da, a + 1).map((id) => ({ id })), error: null }),
  };
  return catena;
}

const chiamate: string[] = [];
let idsRemoti: string[] = [];

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  accessoRifiutato: () => false,
  getSupabase: () => ({
    from: (tabella: string) => {
      chiamate.push(tabella);
      return finteRighe(idsRemoti);
    },
  }),
}));

const { db } = await import("@/lib/db");
const { clearPullCursor, pullDeletedRapportini } = await import("@/lib/supabase/remote");

function foglio(id: string, syncStatus: Rapportino["syncStatus"]): Rapportino {
  const adesso = new Date().toISOString();
  return {
    id,
    numero: id,
    lineaId: "lin_a",
    campata: "1-2",
    dataLavoro: "2026-09-01",
    ditta: "Ditta",
    rappresentanteDitta: "Mario",
    dipendenteTerna: "Luigi",
    nOperatori: 2,
    stato: "bozza",
    syncStatus,
    righe: [],
    createdAt: adesso,
    updatedAt: adesso,
  };
}

beforeEach(async () => {
  chiamate.length = 0;
  idsRemoti = [];
  clearPullCursor();
  await db.rapportini.clear();
});

describe("allineare le cancellazioni fatte sul server", () => {
  it("toglie in locale solo ciò che il server non ha più", async () => {
    await db.rapportini.bulkPut([
      foglio("rap_1", "synced"),
      foglio("rap_2", "synced"),
      foglio("rap_3", "pending"),
    ]);
    idsRemoti = ["rap_1"];

    const tolti = await pullDeletedRapportini();

    expect(tolti).toBe(1);
    expect((await db.rapportini.toArray()).map((r) => r.id).sort()).toEqual(["rap_1", "rap_3"]);
  });

  it("con l’elenco vuoto non svuota l’archivio del telefono", async () => {
    await db.rapportini.bulkPut([foglio("rap_1", "synced"), foglio("rap_2", "synced")]);
    idsRemoti = [];

    const tolti = await pullDeletedRapportini();

    expect(tolti).toBe(0);
    expect(await db.rapportini.count()).toBe(2);
  });

  it("non rifà la scansione a ogni giro, ma il tocco manuale la forza", async () => {
    await db.rapportini.bulkPut([foglio("rap_1", "synced")]);
    idsRemoti = ["rap_1"];

    await pullDeletedRapportini();
    const dopoLaPrima = chiamate.length;
    expect(dopoLaPrima).toBeGreaterThan(0);

    await pullDeletedRapportini();
    expect(chiamate.length).toBe(dopoLaPrima);

    await pullDeletedRapportini({ forza: true });
    expect(chiamate.length).toBeGreaterThan(dopoLaPrima);
  });
});
