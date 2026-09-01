"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/tecnico", label: "Linee" },
  { href: "/tecnico/da-prendere", label: "Da prendere" },
  { href: "/tecnico/in-attesa", label: "In attesa" },
  { href: "/tecnico/nuovo", label: "Nuovo da prendere" },
  { href: "/tecnico/anagrafiche", label: "Database" },
];

export function TecnicoNav() {
  const pathname = usePathname();
  return (
    <nav className="tech-nav">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link key={link.href} href={link.href} className={active ? "active" : ""}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
