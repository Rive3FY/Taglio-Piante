-- Rapportini Taglio — schema Supabase
-- Esegui in Supabase → SQL → New query → Run.
-- È riscrivibile: puoi rieseguirlo senza perdere dati.

-- La vecchia tabella operatori è sostituita da profili (collegata agli account).
drop table if exists operatori;

create table if not exists linee (
  id text primary key,
  codice text not null unique,
  nome text not null,
  tensione_kv numeric,
  zona text,
  updated_at timestamptz not null default now()
);

create table if not exists ditte (
  id text primary key,
  ragione_sociale text not null,
  partita_iva text,
  updated_at timestamptz not null default now()
);

create table if not exists prestazioni (
  id text primary key,
  codice text not null unique,
  descrizione text not null,
  unita_misura text not null,
  updated_at timestamptz not null default now()
);

-- Un profilo per ogni account: decide chi è tecnico e chi operatore.
create table if not exists profili (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  ruolo text not null default 'operatore' check (ruolo in ('operatore', 'tecnico')),
  firma text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Firma salvata una volta sola: finisce in automatico come firma TERNA.
alter table profili add column if not exists firma text;

create table if not exists rapportini (
  id text primary key,
  numero text not null,
  linea_id text not null references linee(id),
  campata text not null,
  data_lavoro date not null,
  ditta text not null,
  rappresentante_ditta text not null default '',
  dipendente_terna text not null default '',
  n_operatori integer not null default 0,
  stato text not null check (stato in ('bozza', 'da_prendere', 'in_attesa', 'archiviato')),
  righe jsonb not null default '[]'::jsonb,
  firma_operatore_path text,
  firma_terna_path text,
  preso_da text,
  preso_at timestamptz,
  inviato_at timestamptz,
  archiviato_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists rapportini_linea_stato_idx on rapportini(linea_id, stato);
create index if not exists rapportini_updated_idx on rapportini(updated_at);
create index if not exists rapportini_deleted_idx on rapportini(deleted_at) where deleted_at is null;

-- Bucket firme privato: si legge solo con un account valido.
insert into storage.buckets (id, name, public)
values ('firme', 'firme', false)
on conflict (id) do update set public = false;

alter table linee enable row level security;
alter table ditte enable row level security;
alter table prestazioni enable row level security;
alter table profili enable row level security;
alter table rapportini enable row level security;

-- Nessun accesso anonimo: serve un account (ruolo authenticated).
drop policy if exists "linee_all" on linee;
create policy "linee_all" on linee for all to authenticated using (true) with check (true);

drop policy if exists "ditte_all" on ditte;
create policy "ditte_all" on ditte for all to authenticated using (true) with check (true);

drop policy if exists "prestazioni_all" on prestazioni;
create policy "prestazioni_all" on prestazioni for all to authenticated using (true) with check (true);

drop policy if exists "rapportini_all" on rapportini;
create policy "rapportini_all" on rapportini for all to authenticated using (true) with check (true);

-- I profili si leggono, ma si creano e cancellano solo dal server (service role).
drop policy if exists "profili_read" on profili;
create policy "profili_read" on profili for select to authenticated using (true);

drop policy if exists "firme_read" on storage.objects;
create policy "firme_read" on storage.objects
  for select to authenticated using (bucket_id = 'firme');

drop policy if exists "firme_write" on storage.objects;
create policy "firme_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'firme');

drop policy if exists "firme_update" on storage.objects;
create policy "firme_update" on storage.objects
  for update to authenticated using (bucket_id = 'firme');

drop policy if exists "firme_delete" on storage.objects;
create policy "firme_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'firme');
