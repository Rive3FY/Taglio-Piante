"use client";

import { uid } from "@/lib/format";
import { normalizzaCampata } from "@/lib/campate/normalize";
import { campateBloccateDaNonTagliare, campataGiaChiusaDaFoglio, messaggioCampateDaNonTagliare } from "@/lib/campate/guard";
import {
  CAMPATA_PRIORITA_LABEL,
  type CampataLavoro,
  type RapportinoCampata,
} from "@/lib/types";

export function CampateEsitiEditor({
  pianificate,
  esiti,
  campateLinea = [],
  onChange,
  onBlocco,
}: {
  pianificate: CampataLavoro[];
  esiti: RapportinoCampata[];
  campateLinea?: CampataLavoro[];
  onChange: (esiti: RapportinoCampata[]) => void;
  onBlocco?: (messaggio: string) => void;
}) {
  function addExtra(testo: string) {
    const originale = testo.trim();
    const normalizzata = normalizzaCampata(originale);
    if (!normalizzata) return;
    if (esiti.some((e) => e.normalizzata === normalizzata)) return;
    const proposta: RapportinoCampata = {
      id: uid("es"),
      originale,
      normalizzata,
      esito: "tagliata",
      aggiuntiva: true,
    };
    const bloccate = campateBloccateDaNonTagliare(campateLinea, [proposta]);
    if (bloccate.length > 0) {
      onBlocco?.(messaggioCampateDaNonTagliare(bloccate));
      return;
    }
    onChange([...esiti, proposta]);
  }

  return (
    <section className="panel">
      <h2>Campate del lavoro</h2>
      <p className="muted">
        Queste campate risultano tagliate con il rapportino. Se non c’è nulla da tagliare, non usare
        questo foglio: aprila dall’elenco campate e spunta «Da non tagliare».
      </p>
      <ul className="esiti-list">
        {esiti.map((e) => {
          const piano = e.campataId
            ? campateLinea.find((p) => p.id === e.campataId) ?? pianificate.find((p) => p.id === e.campataId)
            : campateLinea.find(
                (p) =>
                  p.tipo !== "base" &&
                  p.normalizzata === e.normalizzata &&
                  (!e.priorita || p.priorita === e.priorita),
              ) ??
              pianificate.find(
                (p) =>
                  p.normalizzata === e.normalizzata &&
                  (!e.priorita || p.priorita === e.priorita),
              );
          const priorita = e.priorita ?? piano?.priorita;
          const giaTagliata = piano ? campataGiaChiusaDaFoglio(piano) : false;
          return (
            <li key={e.id} className="esito-card esito-tagliata">
              <div className="esito-head">
                <strong>{e.normalizzata}</strong>
                {priorita ? (
                  <span className={`badge badge-${priorita}`}>{CAMPATA_PRIORITA_LABEL[priorita]}</span>
                ) : null}
                {e.aggiuntiva ? <span className="badge badge-aggiuntiva">Non prevista</span> : null}
                {giaTagliata ? <span className="badge badge-tagliata">Già tagliata</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <AggiungiCampata onAdd={addExtra} />
    </section>
  );
}

function AggiungiCampata({ onAdd }: { onAdd: (testo: string) => void }) {
  return (
    <label>
      Campata aggiuntiva
      <input
        placeholder="Es. 30 oppure 30-31"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const el = e.currentTarget;
          onAdd(el.value);
          el.value = "";
        }}
        onBlur={(e) => {
          if (!e.currentTarget.value.trim()) return;
          onAdd(e.currentTarget.value);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

export function testoCampateDaEsiti(esiti: RapportinoCampata[]) {
  return [...new Set(esiti.map((e) => e.normalizzata))].join(", ");
}
