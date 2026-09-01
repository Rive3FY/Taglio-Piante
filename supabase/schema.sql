-- Rapportini Taglio — schema Supabase
-- Esegui in Supabase → SQL → New query → Run

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

create table if not exists operatori (
  id text primary key,
  nome text not null,
  updated_at timestamptz not null default now()
);

create table if not exists prestazioni (
  id text primary key,
  codice text not null unique,
  descrizione text not null,
  unita_misura text not null,
  updated_at timestamptz not null default now()
);

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

insert into storage.buckets (id, name, public)
values ('firme', 'firme', true)
on conflict (id) do nothing;

alter table linee enable row level security;
alter table ditte enable row level security;
alter table operatori enable row level security;
alter table prestazioni enable row level security;
alter table rapportini enable row level security;

drop policy if exists "linee_all" on linee;
create policy "linee_all" on linee for all using (true) with check (true);

drop policy if exists "ditte_all" on ditte;
create policy "ditte_all" on ditte for all using (true) with check (true);

drop policy if exists "operatori_all" on operatori;
create policy "operatori_all" on operatori for all using (true) with check (true);

drop policy if exists "prestazioni_all" on prestazioni;
create policy "prestazioni_all" on prestazioni for all using (true) with check (true);

drop policy if exists "rapportini_all" on rapportini;
create policy "rapportini_all" on rapportini for all using (true) with check (true);

drop policy if exists "firme_read" on storage.objects;
create policy "firme_read" on storage.objects for select using (bucket_id = 'firme');

drop policy if exists "firme_write" on storage.objects;
create policy "firme_write" on storage.objects for insert with check (bucket_id = 'firme');

drop policy if exists "firme_update" on storage.objects;
create policy "firme_update" on storage.objects for update using (bucket_id = 'firme');

drop policy if exists "firme_delete" on storage.objects;
create policy "firme_delete" on storage.objects for delete using (bucket_id = 'firme');
