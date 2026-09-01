"use client";

export type Periodo = { da: string; a: string };

export const PERIODO_VUOTO: Periodo = { da: "", a: "" };

/** Le date sono in formato ISO, quindi il confronto tra stringhe è già cronologico. */
export function nelPeriodo(dataLavoro: string, periodo: Periodo) {
  if (periodo.da && dataLavoro < periodo.da) return false;
  if (periodo.a && dataLavoro > periodo.a) return false;
  return true;
}

export function periodoAttivo(periodo: Periodo) {
  return Boolean(periodo.da || periodo.a);
}

export function FiltroPeriodo({
  periodo,
  onChange,
}: {
  periodo: Periodo;
  onChange: (periodo: Periodo) => void;
}) {
  return (
    <div className="filtro-periodo">
      <label>
        Dal
        <input
          type="date"
          value={periodo.da}
          max={periodo.a || undefined}
          onChange={(e) => onChange({ ...periodo, da: e.target.value })}
        />
      </label>
      <label>
        Al
        <input
          type="date"
          value={periodo.a}
          min={periodo.da || undefined}
          onChange={(e) => onChange({ ...periodo, a: e.target.value })}
        />
      </label>
      {periodoAttivo(periodo) ? (
        <button
          type="button"
          className="btn btn-sm elenco-piu elenco-riduci"
          onClick={() => onChange(PERIODO_VUOTO)}
        >
          Tutte le date
        </button>
      ) : null}
    </div>
  );
}
