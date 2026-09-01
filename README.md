# Rapportini Taglio

PWA per rapportini di taglio vegetazione: operatori sul campo (offline, firma S Pen) e area tecnico (linee, in attesa, archivio, PDF, gestione operatori).

Accesso e dati passano da **Supabase**: ogni persona ha un account email + password e senza account non si vede nulla. Il browser tiene una copia locale (IndexedDB) per lavorare anche senza rete.

## Avvio locale

```bash
npm install
cp .env.example .env.local
# compila le variabili Supabase
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Configurazione Supabase

1. Crea un progetto su [supabase.com](https://supabase.com)
2. **SQL** → incolla ed esegui `supabase/schema.sql`
3. **Project Settings → API** → copia in `.env.local`:
   - URL → `NEXT_PUBLIC_SUPABASE_URL`
   - chiave `anon` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - chiave `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (mai con prefisso `NEXT_PUBLIC_`)
4. Crea l'account del tecnico: **Authentication → Users → Add user**, con "Auto Confirm User" attivo
5. **SQL** → apri `supabase/tecnico.sql`, metti l'email appena usata ed esegui

Le stesse tre variabili vanno su **Vercel → Settings → Environment Variables**, poi serve un nuovo deploy.

## Account

| Ruolo | Come nasce |
|-------|------------|
| Tecnico | Creato a mano in Supabase + `supabase/tecnico.sql` |
| Operatore | Creato dal tecnico in **Tecnico → Operatori** |

Il tecnico può rinominare un operatore, assegnargli una nuova password o eliminarne l'account.

Il primo accesso richiede la rete. Dopo, l'app si riapre anche offline usando l'ultimo accesso salvato sul dispositivo, così il lavoro sul campo non si blocca.

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
- **Rapportini e firme**: Supabase (+ copia locale per offline)
- **Reset locale**: DevTools → Application → IndexedDB → `rapportini-taglio`
