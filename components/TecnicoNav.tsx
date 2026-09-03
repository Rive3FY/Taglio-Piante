"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  TECNICO_GRUPPI,
  tecnicoGruppoAperto,
  tecnicoLinkAttivo,
} from "@/lib/tecnico/nav";

export function TecnicoNav() {
  const pathname = usePathname();
  const da = useSearchParams().get("da");
  const [aperti, setAperti] = useState<string[]>(() =>
    TECNICO_GRUPPI.filter((g) => tecnicoGruppoAperto(g, pathname, da)).map((g) => g.id),
  );

  useEffect(() => {
    const attivo = TECNICO_GRUPPI.find((g) => tecnicoGruppoAperto(g, pathname, da))?.id;
    if (!attivo) return;
    setAperti((cur) => (cur.includes(attivo) ? cur : [...cur, attivo]));
  }, [pathname, da]);

  function toggle(id: string) {
    setAperti((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <nav className="tech-nav" aria-label="Sezioni area tecnico">
      {TECNICO_GRUPPI.map((gruppo) => {
        const open = aperti.includes(gruppo.id);
        const nelGruppo = tecnicoGruppoAperto(gruppo, pathname, da);
        return (
          <div key={gruppo.id} className="tech-nav-gruppo">
            <button
              type="button"
              className={`tech-nav-capo${nelGruppo ? " on" : ""}`}
              aria-expanded={open}
              onClick={() => toggle(gruppo.id)}
            >
              <span className={`chevron ${open ? "giu" : ""}`} aria-hidden="true">
                ›
              </span>
              <span>{gruppo.label}</span>
            </button>
            {open ? (
              <div className="tech-nav-sotto">
                {gruppo.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    replace
                    className={tecnicoLinkAttivo(link.href, pathname, da) ? "active" : ""}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
