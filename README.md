# Rapportini Taglio

PWA per rapportini di taglio vegetazione: operatori sul campo (offline, firma S Pen) e area tecnico (linee, da prendere, in attesa, archivio, PDF).

I **rapportini** si sincronizzano tra dispositivi tramite **Supabase**. Il browser tiene una copia locale (IndexedDB) per lavorare anche senza rete.

## Avvio locale

```bash
npm install
cp .env.example .env.local
# compila NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Supabase (obbligatorio per dati condivisi)

1. Crea un progetto su [supabase.com](https://supabase.com)
2. **SQL** → incolla ed esegui `supabase/schema.sql`
3. **Project Settings → API** → copia URL e `anon` key in `.env.local`
4. Riavvia `npm run dev`

Al primo avvio online l’app carica su Supabase linee, ditte e prestazioni (se il database è vuoto) e scarica i rapportini degli altri dispositivi.

Aggiungi le stesse variabili su **Vercel → Settings → Environment Variables** e rifai deploy (o push su `main` se collegato a GitHub).

## Sincronizzazione

| Stato in alto | Significato |
|---------------|-------------|
| Offline | Nessuna rete: salvi in locale, sync in coda |
| N in coda | Modifiche da inviare a Supabase |
| Sincronizzato | Locale allineato al cloud |

Tocca il pill **Sincronizzato** per forzare sync manuale.

## Git e deploy

```bash
git add .
git commit -m "..."
git push
```

Con Vercel collegato a GitHub, il sito si aggiorna da solo.

## Dati

- **Codice**: GitHub
- **Rapportini**: Supabase (+ copia locale per offline)
- **Reset locale**: DevTools → Application → IndexedDB → `rapportini-taglio`
