"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { CAMPATA_PRIORITA_LABEL, type CampataPriorita, type Linea } from "@/lib/types";
import { inserisciCampataManuale } from "@/lib/campate/apply";
import { normalizzaCampata } from "@/lib/campate/normalize";
import { readPianoLavoro } from "@/lib/campate/pianoLavoro";
import { mostraEsito } from "@/lib/esitoSalvataggio";
import { useDialogBack } from "@/lib/useDialogBack";
import { useSession } from "@/lib/SessionContext";
import { LineaPicker } from "./LineaPicker";

const EMPTY_LINEE: Linea[] = [];

export function PopupNuovaCampata({
  lineaIdIniziale,
  anno,
  onCreata,
  onChiudi,
}: {
  lineaIdIniziale?: string;
  anno: number;
  onCreata: (id: string, codiceLinea: string, priorita: CampataPriorita) => void;
  onChiudi: () => void;
}) {
  const { session } = useSession();
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? EMPTY_LINEE;
  const piano = readPianoLavoro();
  const [lineaId, setLineaId] = useState(lineaIdIniziale ?? "");
  const [campata, setCampata] = useState("");
  const [priorita, setPriorita] = useState<CampataPriorita>(
    piano === "urgente" ? "urgente" : "differibile",
  );
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  useDialogBack(true, onChiudi);

  const anteprima = useMemo(() => normalizzaCampata(campata), [campata]);

  async function salva() {
    if (!lineaId) {
      setErrore("Seleziona la linea.");
      return;
    }
    if (!anteprima) {
      setErrore("Indica la campata.");
      return;
    }
    setBusy(true);
    setErrore(null);
    try {
      const nuova = await inserisciCampataManuale(
        { lineaId, campata, priorita, anno },
        session,
      );
      onChiudi();
      onCreata(nuova.id, nuova.codiceLinea, nuova.priorita ?? priorita);
      mostraEsito({
        titolo: "Campata aggiunta",
        testo: `${nuova.normalizzata} è in elenco come aggiuntiva. Da lì parti col rapportino.`,
        dopo: "resta",
      });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non è stato possibile aggiungere la campata.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rinvio-overlay" role="dialog" aria-modal="true" aria-labelledby="nuova-campata-titolo">
      <form
        className="login-card rinvio-card nuova-campata-card"
        onSubmit={(e) => {
          e.preventDefault();
          void salva();
        }}
      >
        <h2 id="nuova-campata-titolo">Nuova campata</h2>
        <p className="muted">
          La metti in elenco a mano, sul piano {anno}. Non sostituisce il file del tecnico: resta
          aggiuntiva.
        </p>
        <label>
          Linea
          <LineaPicker linee={linee} value={lineaId} onChange={setLineaId} campo="completa" />
        </label>
        <label>
          Campata
          <input
            value={campata}
            onChange={(e) => setCampata(e.target.value)}
            placeholder="Es. 22 oppure 22-23"
            autoComplete="off"
          />
          {anteprima && anteprima !== campata.trim().replace(/\s+/g, "") ? (
            <span className="muted">In elenco: {anteprima}</span>
          ) : null}
        </label>
        <label>
          Priorità
          <select
            value={priorita}
            onChange={(e) => setPriorita(e.target.value as CampataPriorita)}
          >
            <option value="differibile">{CAMPATA_PRIORITA_LABEL.differibile}</option>
            <option value="urgente">{CAMPATA_PRIORITA_LABEL.urgente}</option>
          </select>
        </label>
        {errore ? <p className="form-error">{errore}</p> : null}
        <div className="danger-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onChiudi}>
            Annulla
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Salvataggio…" : "Aggiungi all’elenco"}
          </button>
        </div>
      </form>
    </div>
  );
}
