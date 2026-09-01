# Rapportini Taglio

PWA per rapportini di taglio vegetazione: operatori sul campo (offline, firma S Pen, salvataggio locale, sync automatica) e area tecnico (linee, da prendere, in attesa, archivio, PDF).

## Avvio

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Per un tablet in rete locale:

```bash
npm run dev:https
```

## Dati

Al primo avvio vengono caricate anagrafiche di esempio in IndexedDB (linee, campate/basi, operatori TERNA, ditte, prestazioni, rapportini). Restano sul dispositivo anche senza rete.

Per ripartire da zero: in DevTools → Application → IndexedDB → elimina `rapportini-taglio`.
