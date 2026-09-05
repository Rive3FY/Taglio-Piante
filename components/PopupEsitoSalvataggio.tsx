"use client";

import { createPortal } from "react-dom";
import { useDialogBack } from "@/lib/useDialogBack";

export type EsitoSalvataggio = {
  titolo: string;
  testo: string;
  /**
   * `resta` = chiudi e resta dove sei.
   * `home` = area tecnico/operatore.
   * altrimenti un path (es. `/tecnico/campate`).
   */
  dopo: "resta" | "home" | (string & {});
};

export function PopupEsitoSalvataggio({
  esito,
  onOk,
}: {
  esito: EsitoSalvataggio;
  onOk: () => void;
}) {
  useDialogBack(true, onOk);

  return createPortal(
    <div className="esito-overlay" role="dialog" aria-modal="true" aria-labelledby="esito-titolo">
      <div className="login-card esito-salvataggio-card">
        <div className="esito-mark" aria-hidden="true">
          <svg viewBox="0 0 80 80">
            <circle className="esito-ring" cx="40" cy="40" r="34" />
            <path className="esito-tick" d="M24 42 L35 53 L57 28" />
          </svg>
        </div>
        <h2 id="esito-titolo">{esito.titolo}</h2>
        <p className="muted">{esito.testo}</p>
        <button type="button" className="btn btn-primary esito-ok" onClick={onOk}>
          Ok
        </button>
      </div>
    </div>,
    document.body,
  );
}
