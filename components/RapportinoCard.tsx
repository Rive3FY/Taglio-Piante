import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Linea, Rapportino } from "@/lib/types";
import { formatDate, lineaDescrizione } from "@/lib/format";
import { etichettaOggettoFoglio } from "@/lib/campate/basi";
import { StatoBadge, SyncBadge } from "./StatusBadge";

export function RapportinoCard({
  item,
  linea,
  href,
  onDelete,
  onDownload,
  downloadBusy,
}: {
  item: Rapportino;
  linea?: Linea;
  href: string;
  onDelete?: (item: Rapportino) => void;
  onDownload?: (item: Rapportino) => void;
  downloadBusy?: boolean;
}) {
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];
  const oggetto = etichettaOggettoFoglio(item, prestazioni);
  const inner = (
    <>
      <div className="rap-card-top">
        <strong>{item.numero}</strong>
        <StatoBadge stato={item.stato} />
      </div>
      <div className="rap-card-title">
        {linea ? lineaDescrizione(linea) : "Linea non trovata"}
      </div>
      <div className="rap-card-meta">
        <span>{formatDate(item.dataLavoro)}</span>
        {oggetto ? <span>{oggetto}</span> : null}
        {item.ditta ? <span>{item.ditta}</span> : null}
        {item.rappresentanteDitta ? <span>{item.rappresentanteDitta}</span> : null}
      </div>
      <div className="rap-card-foot">
        <SyncBadge status={item.syncStatus} />
        <span>{item.righe.length} prestazioni</span>
      </div>
    </>
  );

  if (!onDelete && !onDownload) {
    return (
      <Link href={href} className="rap-card">
        {inner}
      </Link>
    );
  }

  return (
    <article className="rap-card rap-card-con-azioni">
      <Link href={href} className="rap-card-link">
        {inner}
      </Link>
      <div className="rap-card-azioni">
        {onDownload ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={downloadBusy}
            onClick={() => onDownload(item)}
          >
            {downloadBusy ? "PDF…" : "Scarica PDF"}
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(item)}>
            Elimina
          </button>
        ) : null}
      </div>
    </article>
  );
}
