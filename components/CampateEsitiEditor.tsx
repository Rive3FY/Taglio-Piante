"use client";

import { uid } from "@/lib/format";
import { normalizzaCampata } from "@/lib/campate/normalize";
import {
  CAMPATA_PRIORITA_LABEL,
  type CampataLavoro,
  type RapportinoCampata,
} from "@/lib/types";

export function CampateEsitiEditor({
  pianificate,
  esiti,
  onChange,
}: {
  pianificate: CampataLavoro[];
  esiti: RapportinoCampata[];
  onChange: (esiti: RapportinoCampata[]) => void;
}) {
  function setEsito(id: string, patch: Partial<RapportinoCampata>) {
    onChange(esiti.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function addExtra(testo: string) {
    const originale = testo.trim();
    const normalizzata = normalizzaCampata(originale);
    if (!normalizzata) return;
    if (esiti.some((e) => e.normalizzata === normalizzata)) return;
    onChange([
      ...esiti,
      {
        id: uid("es"),
        originale,
        normalizzata,
        esito: "tagliata",
        aggiuntiva: true,
      },
    ]);
  }

  return (
    <section className="panel">
      <h2>Campate del lavoro</h2>
      <p className="muted">
        Indica solo se la campata è tagliata o tralasciata. Note e “da attenzionare” si mettono
        dopo, nell’elenco campate.
      </p>
      <div className="esiti-list">
        {esiti.map((e) => {
          const piano = e.campataId
            ? pianificate.find((p) => p.id === e.campataId)
            : pianificate.find(
                (p) =>
                  p.normalizzata === e.normalizzata &&
                  (!e.priorita || p.priorita === e.priorita),
              );
          const priorita = e.priorita ?? piano?.priorita;
          return (
            <div key={e.id} className={`esito-card esito-${e.esito}`}>
              <div className="esito-head">
                <strong>{e.normalizzata}</strong>
                {priorita ? (
                  <span className={`badge badge-${priorita}`}>{CAMPATA_PRIORITA_LABEL[priorita]}</span>
                ) : null}
                {e.aggiuntiva ? <span className="badge badge-aggiuntiva">Non prevista</span> : null}
              </div>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${e.esito === "tagliata" ? "on" : ""}`}
                  onClick={() => setEsito(e.id, { esito: "tagliata" })}
                >
                  Tagliata
                </button>
                <button
                  type="button"
                  className={`chip ${e.esito === "tralasciata" ? "on" : ""}`}
                  onClick={() => setEsito(e.id, { esito: "tralasciata" })}
                >
                  Tralasciata
                </button>
              </div>
            </div>
          );
        })}
      </div>
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
