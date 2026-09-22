"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  TECNICO_GRUPPI,
  tecnicoGruppoAperto,
  tecnicoLinkAttivo,
} from "@/lib/tecnico/nav";

/** `barra`: voci in riga nella barra in alto (PC). Senza: elenco a fisarmonica (telefono). */
export function TecnicoNav({ barra = false }: { barra?: boolean }) {
  const pathname = usePathname();
  const da = useSearchParams().get("da");
  // Il gruppo aperto vale solo sulla pagina dove l'hai aperto: cambiando pagina si richiude.
  const rotta = `${pathname}|${da ?? ""}`;
  const [scelta, setScelta] = useState<{ id: string; rotta: string } | null>(null);
  const aperto = scelta?.rotta === rotta ? scelta.id : null;
  const setAperto = (id: string | null) => setScelta(id ? { id, rotta } : null);
  const rif = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!barra || !aperto) return;
    const fuori = (e: MouseEvent) => {
      if (rif.current && !rif.current.contains(e.target as Node)) setScelta(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScelta(null);
    };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuori);
      document.removeEventListener("keydown", esc);
    };
  }, [barra, aperto]);

  function toggle(id: string) {
    setAperto(aperto === id ? null : id);
  }

  if (barra) {
    return (
      <nav ref={rif} className="tech-top" aria-label="Sezioni area tecnico">
        {TECNICO_GRUPPI.map((gruppo) => {
          const nelGruppo = tecnicoGruppoAperto(gruppo, pathname, da);
          if (gruppo.links.length === 1) {
            return (
              <Link
                key={gruppo.id}
                href={gruppo.links[0].href}
                replace
                className={`tech-top-capo${nelGruppo ? " on" : ""}`}
              >
                {gruppo.label}
              </Link>
            );
          }
          const open = aperto === gruppo.id;
          return (
            <div key={gruppo.id} className="tech-top-voce">
              <button
                type="button"
                className={`tech-top-capo${nelGruppo ? " on" : ""}`}
                aria-expanded={open}
                onClick={() => toggle(gruppo.id)}
              >
                {gruppo.label}
                <span className="tech-top-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
              {open ? (
                <div className="tech-top-menu">
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

  return (
    <nav className="tech-nav" aria-label="Sezioni area tecnico">
      {TECNICO_GRUPPI.map((gruppo) => {
        const open = aperto === gruppo.id;
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
