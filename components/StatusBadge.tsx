import type { RapportinoStato, SyncStatus } from "@/lib/types";
import { statoLabel, syncLabel } from "@/lib/format";

export function StatoBadge({ stato }: { stato: RapportinoStato }) {
  return <span className={`badge badge-${stato}`}>{statoLabel(stato)}</span>;
}

export function SyncBadge({ status }: { status: SyncStatus }) {
  return <span className={`badge badge-sync-${status}`}>{syncLabel(status)}</span>;
}
