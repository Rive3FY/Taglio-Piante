"use client";

import { uid } from "@/lib/format";
import { normalizzaCampata } from "@/lib/campate/normalize";
import {
  CAMPATA_PRIORITA_LABEL,
  type CampataEsito,
  type CampataLavoro,
  type RapportinoCampata,
} from "@/lib/types";

function classeEsito(esito: CampataEsito) {
  if (esito === "tralasciata") return "esito-tralasciata";
  if (esito === "nulla_da_tagliare") return "esito-nulla_da_tagliare";
  return "esito-tagliata";
}

export function CampateEsitiEditor({
  pianificate,
  esiti,
  onChange,
}: {
  pianificate: CampataLavoro[];
  esiti: RapportinoCampata[];
  onChange: (esiti: RapportinoCampata[]) => void;
}) {
  function setEsito(id: string, esito: CampataEsito) {
    const target = esiti.find((e) => e.id === id);
    onChange(
      esiti.map((e) => {
        if (e.id === id) return { ...e, esito };
        if (target && e.normalizzata === target.normalizzata) return { ...e, esito };
        return e;
      }),
    );
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
        Se non c’è nulla da tagliare, spunta l’opzione sotto: per il tecnico la campata risulta
        comunque eseguita sul grafico.
      </p>
      <ul className="esiti-list">
        {esiti.map((e) => {
          const piano = e.campataId
            ? pianificate.find((p) => p.id === e.campataId)
            : pianificate.find(
                (p) =>
                  p.normalizzata === e.normalizzata &&
                  (!e.priorita || p.priorita === e.priorita),
              );
          const priorita = e.priorita ?? piano?.priorita;
          const gemella =
            esiti.filter((x) => x.id !== e.id && x.normalizzata === e.normalizzata).length > 0;
          return (
            <li key={e.id} className={`esito-card ${classeEsito(e.esito)}`}>
              <div className="esito-head">
                <strong>{e.normalizzata}</strong>
                {priorita ? (
                  <span className={`badge badge-${priorita}`}>{CAMPATA_PRIORITA_LABEL[priorita]}</span>
                ) : null}
                {e.aggiuntiva ? <span className="badge badge-aggiuntiva">Non prevista</span> : null}
              </div>
              {gemella ? (
                <p className="muted esito-gemella">
                  Stessa campata anche con altra priorità: la scelta vale per entrambe.
                </p>
              ) : null}
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={e.esito === "nulla_da_tagliare"}
                  onChange={(ev) =>
                    setEsito(e.id, ev.target.checked ? "nulla_da_tagliare" : "tagliata")
                  }
                />
                Nulla da tagliare
              </label>
              <p className="muted esito-scelta-hint">
                {e.esito === "nulla_da_tagliare"
                  ? "Intervento concluso senza taglio."
                  : e.esito === "tralasciata"
                    ? "Campata non eseguita."
                    : "Taglio eseguito (predefinito)."}
              </p>
              {e.esito === "tralasciata" ? (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setEsito(e.id, "tagliata")}
                >
                  Ripristina come eseguita
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost esito-tralascia-btn"
                  onClick={() => setEsito(e.id, "tralasciata")}
                >
                  Segna come tralasciata
                </button>
              )}
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
