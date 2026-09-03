"use client";

export const ANTEPRIMA_ELENCO = 4;

export function MostraAltro({
  aperto,
  totale,
  anteprima = ANTEPRIMA_ELENCO,
  onToggle,
}: {
  aperto: boolean;
  totale: number;
  anteprima?: number;
  onToggle: () => void;
}) {
  const nascosti = Math.max(0, totale - anteprima);
  if (nascosti <= 0) return null;
  return (
    <button type="button" className="mostra-altro" onClick={onToggle} aria-expanded={aperto}>
      {aperto ? "Mostra meno" : `Mostra altro (${nascosti})`}
    </button>
  );
}
