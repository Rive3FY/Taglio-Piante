"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { CAMPATA_PRIORITA_LABEL, type CampataLavoro, type CampataPriorita, type Linea } from "@/lib/types";
import {
  campateGiaPresenti,
  inserisciCampataManuale,
  messaggioCampataGiaPresente,
} from "@/lib/campate/apply";
import { mostraCampata, normalizzaCampata } from "@/lib/campate/normalize";
import { URGENZE_VISIBILI } from "@/lib/campate/urgenze";
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
  onCreata: (id: string, codiceLinea: string, priorita: CampataPriorita, normalizzata: string) => void;
  onChiudi: () => void;
}) {
  const { session } = useSession();
  const [lineaId, setLineaId] = useState(lineaIdIniziale ?? "");
  const [campata, setCampata] = useState("");
  const [priorita, setPriorita] = useState<CampataPriorita | "">("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? EMPTY_LINEE;
  const campateLinea =
    useLiveQuery(
      () => (lineaId ? db.campateLavoro.where("lineaId").equals(lineaId).toArray() : Promise.resolve([] as CampataLavoro[])),
      [lineaId],
    ) ?? [];
  useDialogBack(true, onChiudi);

  const anteprima = useMemo(() => normalizzaCampata(campata), [campata]);
  const giaPresenti = useMemo(() => {
    if (!lineaId || !anteprima) return [];
    return campateGiaPresenti(campateLinea, { lineaId, normalizzata: anteprima, anno });
  }, [campateLinea, lineaId, anteprima, anno]);
  const lineaScelta = linee.find((l) => l.id === lineaId);
  const avvisoGia = giaPresenti.length > 0
    ? messaggioCampataGiaPresente(giaPresenti, lineaScelta?.codice ?? "")
    : "";

  async function salva() {
    if (!lineaId) {
      setErrore("Seleziona la linea.");
      return;
    }
    if (!anteprima) {
      setErrore("Indica la campata.");
      return;
    }
    if (giaPresenti.length > 0) {
      setErrore(avvisoGia);
      return;
    }
    if (!priorita) {
      setErrore("Indica se è urgente o differibile.");
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
      onCreata(nuova.id, nuova.codiceLinea, nuova.priorita ?? priorita, nuova.normalizzata);
      mostraEsito({
        titolo: "Campata aggiunta",
        testo: `${mostraCampata(nuova.normalizzata)} è in elenco come ${CAMPATA_PRIORITA_LABEL[nuova.priorita ?? priorita]}. Da lì parti col rapportino.`,
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
            placeholder="Es. 22"
            autoComplete="off"
          />
          {anteprima && anteprima !== campata.trim() ? (
            <span className="muted">In elenco: {mostraCampata(anteprima)}</span>
          ) : null}
        </label>
        {avvisoGia ? <p className="form-error">{avvisoGia}</p> : null}
        {giaPresenti.length === 0 ? (
          <label>
            Priorità
            <select
              value={priorita}
              onChange={(e) => setPriorita(e.target.value as CampataPriorita | "")}
            >
              <option value="">Seleziona…</option>
              <option value="differibile">{CAMPATA_PRIORITA_LABEL.differibile}</option>
              <option value="urgente">{CAMPATA_PRIORITA_LABEL.urgente}</option>
            </select>
            {!URGENZE_VISIBILI && priorita === "urgente" ? (
              <span className="muted">Oggi le urgenze sono nascoste: in elenco la vedi solo da questa scheda.</span>
            ) : null}
          </label>
        ) : null}
        {errore && errore !== avvisoGia ? <p className="form-error">{errore}</p> : null}
        <div className="danger-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onChiudi}>
            Annulla
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || giaPresenti.length > 0}>
            {busy ? "Salvataggio…" : "Aggiungi all’elenco"}
          </button>
        </div>
      </form>
    </div>
  );
}
