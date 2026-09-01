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
        Indica tagliata o tralasciata. Se ne hai tagliata una non prevista, aggiungila in fondo: entra
        in elenco come aggiuntiva.
      </p>
      <div className="esiti-list">
        {esiti.map((e) => {
          const piano = pianificate.find((p) => p.id === e.campataId || p.normalizzata === e.normalizzata);
          return (
            <div key={e.id} className={`esito-card esito-${e.esito}`}>
              <div className="esito-head">
                <strong>{e.normalizzata}</strong>
                {piano?.priorita ? (
                  <span className={`badge badge-${piano.priorita}`}>{CAMPATA_PRIORITA_LABEL[piano.priorita]}</span>
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
              {e.esito === "tralasciata" ? (
                <label>
                  Motivazione obbligatoria
                  <input
                    value={e.note ?? ""}
                    onChange={(ev) => setEsito(e.id, { note: ev.target.value })}
                    placeholder="Perché non è stata tagliata"
                  />
                </label>
              ) : null}
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
  return esiti.map((e) => e.normalizzata).join(", ");
}
