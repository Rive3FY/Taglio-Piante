"use client";

import { useEffect, useState } from "react";
import { FIRMA_SEPARATA, firmeMancanti } from "@/lib/db";
import type { Rapportino } from "@/lib/types";

/**
 * Apre un foglio le cui firme sono ancora solo sul server: le scarica e dice
 * quando il form può partire. Il form legge la firma una volta sola, all'avvio;
 * senza rete si prosegue lo stesso e il foglio resta segnato come firmato.
 */
export function useFirmePronte(item: Rapportino | null | undefined) {
  const id = item?.id;
  const segnate = Boolean(
    item && (item.firmaOperatore === FIRMA_SEPARATA || item.firmaTerna === FIRMA_SEPARATA),
  );
  const [pronto, setPronto] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !segnate || !item) return;
    let annullato = false;
    void (async () => {
      try {
        if (await firmeMancanti(item)) {
          const { scaricaFirmeMancanti } = await import("@/lib/supabase/remote");
          await scaricaFirmeMancanti([id]);
          // Scaricate: `item` si aggiorna da Dexie con le immagini e `segnate` diventa falso.
          // L'attesa copre il caso di una sola delle due firme recuperabile.
          if (!(await firmeMancanti(item))) await new Promise((r) => setTimeout(r, 400));
        }
      } catch {
        // si apre comunque: il foglio resta segnato come firmato
      }
      if (!annullato) setPronto(id);
    })();
    return () => {
      annullato = true;
    };
    // Si riparte solo cambiando foglio: l'arrivo delle immagini aggiorna `item`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, segnate]);

  return !segnate || pronto === id;
}
