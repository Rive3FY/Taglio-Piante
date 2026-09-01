"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tensioneLabel, tensioneLinea } from "@/lib/format";
import type { Linea } from "@/lib/types";

type Props = {
  linee: Linea[];
  value: string;
  onChange: (lineaId: string) => void;
};

export function LineaPicker({ linee, value, onChange }: Props) {
  const selected = linee.find((l) => l.id === value);
  const [query, setQuery] = useState(selected?.codice ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) setQuery(selected.codice);
  }, [selected]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return [...linee]
      .filter(
        (l) =>
          l.codice.toLowerCase().includes(term) || l.nome.toLowerCase().includes(term),
      )
      .sort((a, b) => {
        const aCode = a.codice.toLowerCase();
        const bCode = b.codice.toLowerCase();
        const aStart = aCode.startsWith(term) ? 0 : 1;
        const bStart = bCode.startsWith(term) ? 0 : 1;
        return aStart - bStart || aCode.localeCompare(bCode, "it");
      })
      .slice(0, 12);
  }, [linee, query]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  function pick(linea: Linea) {
    onChange(linea.id);
    setQuery(linea.codice);
    setOpen(false);
  }

  function onQuery(next: string) {
    setQuery(next);
    setOpen(true);
    const term = next.trim().toLowerCase();
    const exact = linee.find((l) => l.codice.toLowerCase() === term);
    if (exact) {
      onChange(exact.id);
      return;
    }
    if (value) onChange("");
  }

  return (
    <div className="linea-picker" ref={wrapRef}>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Scrivi il codice linea"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
      />
      {open && query.trim() ? (
        <ul className="linea-suggest" role="listbox">
          {matches.length === 0 ? (
            <li className="linea-suggest-empty">Nessuna linea trovata</li>
          ) : (
            matches.map((l) => {
              const kv = tensioneLinea(l);
              return (
                <li key={l.id}>
                  <button type="button" role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(l)}>
                    <span className="linea-suggest-top">
                      <strong>{l.codice}</strong>
                      {kv ? <span className={`kv-badge kv-${kv}`}>{tensioneLabel(kv)}</span> : null}
                    </span>
                    <span>{l.nome}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
