export type TecnicoLink = { href: string; label: string };

export type TecnicoGruppo = {
  id: string;
  label: string;
  links: TecnicoLink[];
};

export const TECNICO_GRUPPI: TecnicoGruppo[] = [
  {
    id: "piano",
    label: "Piano",
    links: [
      { href: "/tecnico", label: "Linee" },
      { href: "/tecnico/campate", label: "Campate" },
      { href: "/tecnico/rinvii", label: "Promemoria" },
      { href: "/tecnico/basi", label: "Basi" },
    ],
  },
  {
    id: "fogli",
    label: "Rapportini",
    links: [
      { href: "/tecnico/fogli", label: "Archivio" },
    ],
  },
  {
    id: "report",
    label: "Report",
    links: [
      { href: "/tecnico/contabilita", label: "Contabilità" },
      { href: "/tecnico/prezzi", label: "Prezzi" },
      { href: "/tecnico/backup", label: "Backup" },
    ],
  },
  {
    id: "anagrafiche",
    label: "Anagrafiche",
    links: [
      { href: "/tecnico/operatori", label: "Operatori" },
      { href: "/tecnico/anagrafiche", label: "Database" },
    ],
  },
];

export function tecnicoLinkAttivo(href: string, pathname: string, da?: string | null) {
  if (href === "/tecnico") {
    return pathname === "/tecnico";
  }
  if (href === "/tecnico/campate") {
    return (
      pathname === "/tecnico/campate" ||
      pathname.startsWith("/tecnico/campate/") ||
      pathname === "/tecnico/nuovo"
    );
  }
  if (href === "/tecnico/fogli") {
    return (
      pathname.startsWith("/tecnico/fogli") ||
      pathname.startsWith("/tecnico/bozze") ||
      pathname.startsWith("/tecnico/archiviati") ||
      pathname.startsWith("/tecnico/per-linea") ||
      pathname.startsWith("/tecnico/rapportini/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function tecnicoGruppoAperto(gruppo: TecnicoGruppo, pathname: string, da?: string | null) {
  return gruppo.links.some((l) => tecnicoLinkAttivo(l.href, pathname, da));
}

export function tecnicoBackHref(pathname: string, da?: string | null) {
  if (pathname === "/tecnico") return undefined;
  if (pathname.startsWith("/tecnico/rapportini/")) {
    if (da === "bozze") return "/tecnico/fogli?s=bozze";
    return "/tecnico/fogli?s=archiviati";
  }
  if (pathname === "/tecnico/campate/importa") return "/tecnico/campate";
  if (pathname === "/tecnico/nuovo") return "/tecnico/campate";
  if (pathname.startsWith("/tecnico/linee/")) return "/tecnico";
  return "/tecnico";
}
