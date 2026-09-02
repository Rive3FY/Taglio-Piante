"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tensioneLabel, tensioneLinea } from "@/lib/format";
import type { Linea } from "@/lib/types";

export type LineaOpzione = Pick<Linea, "id" | "codice" | "nome"> & { tensioneKv?: number };

type Campo = "codice" | "nome" | "completa";

type Props = {
  linee: LineaOpzione[];
  value: string;
  onChange: (lineaId: string) => void;
  campo?: Campo;
  placeholder?: string;
  onQueryChange?: (query: string) => void;
};

function testoCampo(linea: LineaOpzione, campo: Campo) {
  if (campo === "nome") return linea.nome;
  if (campo === "completa") return `${linea.codice} · ${linea.nome}`;
  return linea.codice;
}

export function LineaPicker({
  linee,
  value,
  onChange,
  campo = "codice",
  placeholder,
  onQueryChange,
}: Props) {
  const selected = linee.find((l) => l.id === value);
  const [query, setQuery] = useState(selected ? testoCampo(selected, campo) : "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) setQuery(testoCampo(selected, campo));
  }, [selected, campo]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    const lista = term
      ? linee.filter(
          (l) =>
            l.codice.toLowerCase().includes(term) || l.nome.toLowerCase().includes(term),
        )
      : [...linee];
    return [...lista]
      .sort((a, b) => {
        if (!term) return a.codice.localeCompare(b.codice, "it");
        const aCode = a.codice.toLowerCase();
        const bCode = b.codice.toLowerCase();
        const aNome = a.nome.toLowerCase();
        const bNome = b.nome.toLowerCase();
        const rank = (code: string, nome: string) =>
          code.startsWith(term) ? 0 : nome.startsWith(term) ? 1 : 2;
        return rank(aCode, aNome) - rank(bCode, bNome) || aCode.localeCompare(bCode, "it");
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

  function pick(linea: LineaOpzione) {
    onChange(linea.id);
    setQuery(testoCampo(linea, campo));
    onQueryChange?.(testoCampo(linea, campo));
    setOpen(false);
  }

  function onQuery(next: string) {
    setQuery(next);
    onQueryChange?.(next);
    setOpen(true);
    const term = next.trim().toLowerCase();
    if (!term) {
      if (value) onChange("");
      return;
    }
    const exactCodice = linee.find((l) => l.codice.toLowerCase() === term);
    if (exactCodice) {
      onChange(exactCodice.id);
      return;
    }
    const omonime = linee.filter((l) => l.nome.toLowerCase() === term);
    if (omonime.length === 1) {
      onChange(omonime[0]!.id);
      return;
    }
    if (value) onChange("");
  }

  const hint =
    placeholder ??
    (campo === "nome"
      ? "Scrivi il nome linea"
      : campo === "completa"
        ? "Codice o nome linea"
        : "Scrivi il codice linea");

  return (
    <div className="linea-picker" ref={wrapRef}>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={hint}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
      />
      {open ? (
        <ul className="linea-suggest" role="listbox">
          {matches.length === 0 ? (
            <li className="linea-suggest-empty">Nessuna linea trovata</li>
          ) : (
            matches.map((l) => {
              const kv = tensioneLinea(l);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(l)}
                  >
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
