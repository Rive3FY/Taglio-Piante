"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Linea, Rapportino } from "@/lib/types";
import { formatDate, lineaDescrizione } from "@/lib/format";
import { etichettaOggettoFoglio } from "@/lib/campate/basi";
import { haFirmaDitta } from "@/lib/rapportinoFirma";
import { FirmaDittaOverlay } from "./FirmaDittaOverlay";
import { StatoBadge, SyncBadge } from "./StatusBadge";

export function RapportinoCard({
  item,
  linea,
  href,
  onApri,
  onDelete,
  onDownload,
  downloadBusy,
}: {
  item: Rapportino;
  linea?: Linea;
  href?: string;
  onApri?: () => void;
  onDelete?: (item: Rapportino) => void;
  onDownload?: (item: Rapportino) => void;
  downloadBusy?: boolean;
}) {
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];
  const oggetto = etichettaOggettoFoglio(item, prestazioni);
  const [firmaAperta, setFirmaAperta] = useState(false);
  const mancaFirma = !haFirmaDitta(item.firmaOperatore);
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
        {mancaFirma ? <span className="rap-card-manca-firma">Manca firma ditta</span> : null}
      </div>
    </>
  );

  const overlay = firmaAperta ? (
    <FirmaDittaOverlay item={item} linea={linea} onChiudi={() => setFirmaAperta(false)} />
  ) : null;

  if (!onDelete && !onDownload && !mancaFirma) {
    if (onApri) {
      return (
        <button type="button" className="rap-card" onClick={onApri}>
          {inner}
        </button>
      );
    }
    return (
      <Link href={href ?? "#"} className="rap-card">
        {inner}
      </Link>
    );
  }

  return (
    <article className="rap-card rap-card-con-azioni">
      {onApri ? (
        <button type="button" className="rap-card-link" onClick={onApri}>
          {inner}
        </button>
      ) : (
        <Link href={href ?? "#"} className="rap-card-link">
          {inner}
        </Link>
      )}
      <div className="rap-card-azioni">
        {mancaFirma ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFirmaAperta(true)}>
            Firma ditta
          </button>
        ) : null}
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
      {overlay}
    </article>
  );
}
