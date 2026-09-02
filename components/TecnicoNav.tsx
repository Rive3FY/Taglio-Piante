"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/tecnico", label: "Linee" },
  { href: "/tecnico/campate", label: "Campate" },
  { href: "/tecnico/basi", label: "Basi" },
  { href: "/tecnico/contabilita", label: "Contabilità" },
  { href: "/tecnico/backup", label: "Backup" },
  { href: "/tecnico/bozze", label: "Bozze" },
  { href: "/tecnico/archiviati", label: "Archiviati" },
  { href: "/tecnico/operatori", label: "Operatori" },
  { href: "/tecnico/anagrafiche", label: "Database" },
];

export function TecnicoNav() {
  const pathname = usePathname();
  return (
    <nav className="tech-nav">
      {LINKS.map((link) => {
        const active =
          link.href === "/tecnico" ? pathname === "/tecnico" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={active ? "active" : ""}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
