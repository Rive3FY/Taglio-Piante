"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CampataDaChiudere } from "@/lib/campate/terminata";

export function PopupCampataTerminata({
  campate,
  onConferma,
}: {
  campate: CampataDaChiudere[];
  onConferma: (scelte: Record<string, boolean>) => void | Promise<void>;
}) {
  const [scelte, setScelte] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const sola = campate.length === 1 ? campate[0] : null;
  const tutteRisposte = campate.every((c) => typeof scelte[c.chiave] === "boolean");

  useEffect(() => {
    window.history.pushState({ dialog: true }, "");
    const onPop = () => window.history.pushState({ dialog: true }, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function conferma(valori: Record<string, boolean>) {
    if (busy) return;
    setBusy(true);
    try {
      await onConferma(valori);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="esito-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminata-titolo"
    >
      <div className="login-card esito-salvataggio-card terminata-card">
        {sola ? (
          <>
            <h2 id="terminata-titolo">La campata {sola.etichetta} è terminata?</h2>
            <p className="muted">
              Se non è finita resta arancione in elenco e il tecnico non la vede come tagliata. Potrai
              farne un altro foglio un altro giorno.
            </p>
            <div className="terminata-azioni">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void conferma({ [sola.chiave]: true })}
              >
                Sì, terminata
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void conferma({ [sola.chiave]: false })}
              >
                No, non terminata
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="terminata-titolo">Queste campate sono terminate?</h2>
            <p className="muted">
              Per ognuna: se non è finita resta arancione in elenco e il tecnico non la vede come
              tagliata. Si può riprendere un altro giorno.
            </p>
            <ul className="terminata-elenco">
              {campate.map((c) => {
                const scelta = scelte[c.chiave];
                return (
                  <li key={c.chiave} className="terminata-riga">
                    <strong>{c.etichetta}</strong>
                    <div className="terminata-azioni">
                      <button
                        type="button"
                        className={`btn btn-sm ${scelta === true ? "btn-primary" : "btn-ghost"}`}
                        disabled={busy}
                        onClick={() => setScelte((prev) => ({ ...prev, [c.chiave]: true }))}
                      >
                        Terminata
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${scelta === false ? "btn-primary" : "btn-ghost"}`}
                        disabled={busy}
                        onClick={() => setScelte((prev) => ({ ...prev, [c.chiave]: false }))}
                      >
                        Non terminata
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !tutteRisposte}
              onClick={() => void conferma(scelte)}
            >
              Conferma
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
