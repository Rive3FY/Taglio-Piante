export const TEMA_KEY = "rt.tema";
export type Tema = "chiaro" | "scuro";

export function temaSalvato(): Tema {
  if (typeof window === "undefined") return "chiaro";
  try {
    return localStorage.getItem(TEMA_KEY) === "scuro" ? "scuro" : "chiaro";
  } catch {
    return "chiaro";
  }
}

export function applicaTema(tema: Tema) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.tema = tema;
  document.documentElement.style.colorScheme = tema === "scuro" ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "scuro" ? "#070f0c" : "#0c1f18");
}

export function impostaTema(tema: Tema) {
  try {
    localStorage.setItem(TEMA_KEY, tema);
  } catch {
    // storage pieno o privato
  }
  applicaTema(tema);
}

export const SCRIPT_TEMA =
  `try{var t=localStorage.getItem("${TEMA_KEY}");if(t==="scuro"){document.documentElement.dataset.tema="scuro";document.documentElement.style.colorScheme="dark";}}catch(e){}`;
