"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSession } from "@/lib/SessionContext";
import { useSync } from "@/lib/SyncContext";
import { applicaFirmaDitta, haFirmaDitta } from "@/lib/rapportinoFirma";
import { useDialogBack } from "@/lib/useDialogBack";
import type { Linea, Rapportino } from "@/lib/types";
import { RapportinoSheet } from "./RapportinoSheet";
import { SignaturePad } from "./SignaturePad";

export function FirmaDittaOverlay({
  item,
  linea,
  onChiudi,
}: {
  item: Rapportino;
  linea?: Linea;
  onChiudi: () => void;
}) {
  const { session } = useSession();
  const { syncNow } = useSync();
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];
  const [firma, setFirma] = useState<string | undefined>(item.firmaOperatore);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  useDialogBack(true, onChiudi);

  async function salva() {
    if (!haFirmaDitta(firma)) {
      setErrore("Firma nel riquadro della ditta, poi conferma.");
      return;
    }
    setBusy(true);
    setErrore(null);
    try {
      await applicaFirmaDitta(item, firma!, session);
      void syncNow();
      onChiudi();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Firma non salvata.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="scheda-overlay firma-ditta-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Firma ditta ${item.numero}`}
    >
      <div className="scheda-overlay-bar">
        <button type="button" className="btn btn-secondary" onClick={onChiudi}>
          Chiudi
        </button>
      </div>
      <RapportinoSheet item={item} linea={linea} prestazioni={prestazioni} />
      <div className="firma-ditta-dock">
        <SignaturePad
          label="Il Designato Ditta"
          hint="Firma qui. Poi conferma: il foglio va in archivio."
          value={firma}
          onChange={(next) => {
            setFirma(next);
            setErrore(null);
          }}
        />
        {errore ? <p className="form-error">{errore}</p> : null}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void salva()}>
          {busy ? "Salvataggio…" : "Conferma firma"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
