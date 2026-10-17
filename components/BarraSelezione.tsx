"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toggleGruppo } from "@/lib/selezioneRapportini";

/** true solo dopo l'idratazione, così il portal non diverge dal render del server. */
export function useMontato() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function BarraSelezione({
  n,
  preparando,
  bloccata,
  onScarica,
  onAnnulla,
}: {
  n: number;
  preparando: boolean;
  bloccata: boolean;
  onScarica: () => void;
  onAnnulla: () => void;
}) {
  const pronta = useMontato();
  if (!pronta || n === 0) return null;

  return createPortal(
    <div className="form-actions-dock selezione-dock" role="region" aria-label="Rapportini selezionati">
      <div className="totale-foglio" aria-live="polite">
        <span>{n === 1 ? "Scelto" : "Scelti"}</span>
        <strong>{n}</strong>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-compatto"
        onClick={onAnnulla}
        disabled={bloccata}
      >
        Annulla
      </button>
      <button type="button" className="btn btn-primary" onClick={onScarica} disabled={bloccata}>
        {preparando ? "Preparazione PDF…" : `Scarica PDF (${n})`}
      </button>
    </div>,
    document.body,
  );
}

/** Spunta di un giorno o di una linea: non cancella la selezione fuori dal gruppo. */
export function CheckboxGruppo({
  ids,
  scelti,
  onChange,
  acceso,
  spento,
}: {
  ids: string[];
  scelti: string[];
  onChange: (next: string[]) => void;
  acceso: string;
  spento: string;
}) {
  const tutti = ids.length > 0 && ids.every((id) => scelti.includes(id));
  const alcuni = !tutti && ids.some((id) => scelti.includes(id));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = alcuni;
  }, [alcuni]);

  return (
    <label className="check-line">
      <input
        ref={ref}
        type="checkbox"
        checked={tutti}
        onChange={() => onChange(toggleGruppo(scelti, ids))}
      />
      {tutti ? acceso : spento}
    </label>
  );
}
