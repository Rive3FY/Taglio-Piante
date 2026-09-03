"use client";

import { useState } from "react";
import { MESI_LABEL, campataDaRiprendere, type CampataLavoro } from "@/lib/types";
import type { PatchRinvio } from "@/lib/campate/apply";

export function PopupRinvio({
  campata,
  annoPiano,
  puoTogliere,
  onSalva,
  onTogli,
  onChiudi,
}: {
  campata: CampataLavoro;
  annoPiano: number;
  puoTogliere: boolean;
  onSalva: (patch: PatchRinvio) => Promise<void> | void;
  onTogli: () => Promise<void> | void;
  onChiudi: () => void;
}) {
  const giaInElenco = campataDaRiprendere(campata);
  const [mese, setMese] = useState(campata.rinvioMese ? String(campata.rinvioMese) : "");
  const [anno, setAnno] = useState(campata.rinvioAnno ? String(campata.rinvioAnno) : "");
  const [note, setNote] = useState(campata.rinvioNote ?? "");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva() {
    const m = Number(mese);
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      setErrore("Scegli il mese in cui tornare sulla campata.");
      return;
    }
    const a = anno.trim() ? Number(anno) : undefined;
    if (a != null && (!Number.isFinite(a) || a < 2000 || a > 2100)) {
      setErrore("L’anno non è valido.");
      return;
    }
    setBusy(true);
    setErrore(null);
    try {
      await onSalva({ mese: m, anno: a, note: note.trim() || undefined });
      onChiudi();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non è stato possibile salvare.");
    } finally {
      setBusy(false);
    }
  }

  async function togli() {
    setBusy(true);
    setErrore(null);
    try {
      await onTogli();
      onChiudi();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non è stato possibile togliere il promemoria.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rinvio-overlay" role="dialog" aria-modal="true" aria-labelledby="rinvio-titolo">
      <form
        className="login-card rinvio-card"
        onSubmit={(e) => {
          e.preventDefault();
          void salva();
        }}
      >
        <h2 id="rinvio-titolo">Da riprendere</h2>
        <p className="muted">
          {campata.codiceLinea} · campata <strong>{campata.normalizzata}</strong>. Finisce nell’elenco
          «Da riprendere» come promemoria: lo stato in elenco campate e le torte non si toccano.
        </p>
        <label>
          Mese in cui tornarci
          <select value={mese} onChange={(e) => setMese(e.target.value)}>
            <option value="">Scegli il mese</option>
            {MESI_LABEL.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Anno (facoltativo)
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={anno}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d{0,4}$/.test(v)) setAnno(v);
            }}
            placeholder={`Vuoto = ${annoPiano}`}
          />
        </label>
        <label>
          Note (facoltative)
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Es. solo pericoli tagliati, potatura vera con le nocciole raccolte"
          />
        </label>
        {errore ? <p className="form-error">{errore}</p> : null}
        <div className="danger-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onChiudi}>
            Annulla
          </button>
          {giaInElenco && puoTogliere ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void togli()}>
              Togli dall’elenco
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Salvataggio…" : giaInElenco ? "Aggiorna promemoria" : "Aggiungi all’elenco"}
          </button>
        </div>
      </form>
    </div>
  );
}
