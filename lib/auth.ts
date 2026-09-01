export const TECNICO_NOME = "Vincenzo D'Ascenzio";

const DEFAULT_TECNICO_PASSWORD = "Terna2026";

/** Password area tecnico: sovrascrivibile con NEXT_PUBLIC_TECNICO_PASSWORD. */
export function tecnicoPassword() {
  return process.env.NEXT_PUBLIC_TECNICO_PASSWORD?.trim() || DEFAULT_TECNICO_PASSWORD;
}

export function checkTecnicoPassword(input: string) {
  return input.trim() === tecnicoPassword();
}
