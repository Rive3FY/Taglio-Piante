import Link from "next/link";
import type { Linea, Rapportino } from "@/lib/types";
import { formatDate, lineaDescrizione } from "@/lib/format";
import { StatoBadge, SyncBadge } from "./StatusBadge";

export function RapportinoCard({
  item,
  linea,
  href,
  onDelete,
}: {
  item: Rapportino;
  linea?: Linea;
  href: string;
  onDelete?: (item: Rapportino) => void;
}) {
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
        {item.campata ? <span>Campata {item.campata}</span> : null}
        {item.ditta ? <span>{item.ditta}</span> : null}
        {item.rappresentanteDitta ? <span>{item.rappresentanteDitta}</span> : null}
      </div>
      <div className="rap-card-foot">
        <SyncBadge status={item.syncStatus} />
        <span>{item.righe.length} prestazioni</span>
      </div>
    </>
  );

  if (!onDelete) {
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
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={() => onDelete(item)}
      >
        Elimina
      </button>
    </article>
  );
}
