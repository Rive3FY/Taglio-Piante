import type { RapportinoStato, SyncStatus } from "@/lib/types";
import { statoLabel, syncLabel } from "@/lib/format";

export function StatoBadge({ stato }: { stato: RapportinoStato }) {
  return <span className={`badge badge-${stato}`}>{statoLabel(stato)}</span>;
}

export function SyncBadge({ status }: { status: SyncStatus }) {
  const titolo =
    status === "error"
      ? "Il rapportino è sul telefono, ma l’invio al server non è andato a buon fine. Tocca il pallino in alto per riprovare."
      : status === "pending"
        ? "Salvato sul telefono, ancora da mandare (o da confermare) al server. Non è una verifica del tecnico."
        : status === "synced"
          ? "Copia allineata con il server."
          : "Presente solo su questo telefono.";
  return (
    <span className={`badge badge-sync-${status}`} title={titolo}>
      {syncLabel(status)}
    </span>
  );
}
