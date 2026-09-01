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
        ? "Salvato in locale, in attesa di invio."
        : undefined;
  return (
    <span className={`badge badge-sync-${status}`} title={titolo}>
      {syncLabel(status)}
    </span>
  );
}
