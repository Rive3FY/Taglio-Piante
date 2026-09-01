export const OPERATORI = ["Gianluca Rivetti", "Giglio Pasquale Daniele"] as const;

export function matchOperatore(nome?: string | null) {
  const n = nome?.trim().toLowerCase();
  if (!n) return "";
  const exact = OPERATORI.find((op) => op.toLowerCase() === n);
  if (exact) return exact;
  const starts = OPERATORI.find(
    (op) => op.toLowerCase().startsWith(n) || n.startsWith(op.split(" ")[0].toLowerCase()),
  );
  return starts ?? "";
}
