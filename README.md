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

## Chi vede cosa

| Ruolo | Rapportini | Profili e firme |
|-------|-----------|-----------------|
| Operatore | Solo quelli che ha creato | Solo il proprio |
| Tecnico | Tutti | Tutti |

Il filtro non è solo nell'interfaccia: le policy RLS di Supabase legano ogni rapportino al campo `owner_id`, quindi un operatore non può leggere i rapportini degli altri nemmeno chiamando l'API. Al primo accesso dopo l'aggiornamento il dispositivo cancella dalla copia locale i rapportini non suoi già scaricati.

Chi aggiorna un'installazione esistente deve rieseguire `supabase/schema.sql`: è riscrivibile e assegna `owner_id` ai rapportini già presenti in base al nome in `preso_da`. Aggiunge anche le tabelle delle campate operative.

## Campate

Il tecnico carica un file nello stesso formato del fac-simile LIDAR (**Carica file campate**): il parser legge intestazione e righe, non i dati di un file specifico. Ogni file è un **piano di un anno** (Importa piano 20XX): gli anni precedenti e i rapportini restano. «Azzera tutto e riparti» cancella prove e riparte da zero. Chi aggiorna un progetto già in cloud deve eseguire `supabase/patch_campate_anno.sql`. L'elenco è visibile a tecnico e operatori; solo il tecnico importa i file.

## Da riprendere e attenzionare

Elenco parallelo al piano: ci finiscono le campate con un mese di ripresa («da riprendere», col popup del mese) e quelle segnate «da attenzionare» (una spunta, senza popup). Non è uno stato di taglio: le torte restano legate a stato e «da non tagliare». Le due segnalazioni valgono sullo span (urgente e differibile insieme), compaiono una volta sola anche se il piano cambia anno, sopravvivono al reimport dello stesso anno e si tolgono da questo elenco. Il tecnico le chiude con «Tagliata»: la riga resta, barrata. Chi aggiorna un progetto già in cloud deve eseguire `supabase/patch_attenzione_parallelo.sql`.

Il primo accesso richiede la rete. Dopo, l'app si riapre anche offline usando l'ultimo accesso salvato sul dispositivo, così il lavoro sul campo non si blocca.

## Contabilità

Report → Contabilità lavora sul mese scelto (di default quello in corso) e conta solo i rapportini archiviati. **Report del mese** scarica un unico Excel con tre fogli: *Riepilogo* (una riga per linea con rapportini e importi), *Per linea* (le prestazioni linea per linea, sezione Campate e sezione Basi, con il totale della linea) e *Totale mese* (le stesse prestazioni sommate su tutte le linee). Sommando le linee viene il totale del mese, quindi il file quadra con quello che si vede a schermo. Resta anche lo scarico per singola linea, che invece è cumulativo fino a oggi. I prezzi sono quelli di Report → Prezzi.

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
