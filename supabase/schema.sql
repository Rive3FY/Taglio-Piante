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

-- Proprietario del rapportino: l'operatore vede solo i suoi, il tecnico vede tutto.
alter table rapportini add column if not exists owner_id uuid references auth.users(id);

-- Rapportini già esistenti: il proprietario si ricava dal nome in preso_da.
update rapportini r
set owner_id = p.user_id
from profili p
where r.owner_id is null and r.preso_da = p.nome;

create index if not exists rapportini_linea_stato_idx on rapportini(linea_id, stato);
create index if not exists rapportini_updated_idx on rapportini(updated_at);
create index if not exists rapportini_deleted_idx on rapportini(deleted_at) where deleted_at is null;
create index if not exists rapportini_owner_idx on rapportini(owner_id);

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

-- Il ruolo si legge dal profilo. security definer: serve anche dentro le policy.
create or replace function is_tecnico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profili where user_id = auth.uid() and ruolo = 'tecnico'
  );
$$;

grant execute on function is_tecnico() to authenticated;

-- Ogni operatore vede e modifica solo i propri rapportini; il tecnico tutti.
drop policy if exists "rapportini_all" on rapportini;

drop policy if exists "rapportini_select" on rapportini;
create policy "rapportini_select" on rapportini
  for select to authenticated using (is_tecnico() or owner_id = auth.uid());

drop policy if exists "rapportini_insert" on rapportini;
create policy "rapportini_insert" on rapportini
  for insert to authenticated with check (is_tecnico() or owner_id = auth.uid());

drop policy if exists "rapportini_update" on rapportini;
create policy "rapportini_update" on rapportini
  for update to authenticated
  using (is_tecnico() or owner_id = auth.uid())
  with check (is_tecnico() or owner_id = auth.uid());

drop policy if exists "rapportini_delete" on rapportini;
create policy "rapportini_delete" on rapportini
  for delete to authenticated using (is_tecnico() or owner_id = auth.uid());

-- La numerazione deve restare unica anche se l'operatore non vede i rapportini altrui.
create or replace function prossimo_numero(prefisso text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select max(numero) from rapportini where numero like prefisso || '%';
$$;

grant execute on function prossimo_numero(text) to authenticated;

-- I profili si creano e cancellano solo dal server (service role).
-- In lettura l'operatore vede solo il proprio: le firme degli altri non escono dal database.
drop policy if exists "profili_read" on profili;
create policy "profili_read" on profili
  for select to authenticated using (is_tecnico() or user_id = auth.uid());

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

alter table rapportini add column if not exists esiti_campate jsonb not null default '[]'::jsonb;

create table if not exists campate_lavoro (
  id text primary key,
  linea_id text not null references linee(id),
  codice_linea text not null,
  nome_linea text not null default '',
  tensione_kv numeric,
  originale text not null,
  normalizzata text not null,
  tipo text not null default 'campata' check (tipo in ('campata', 'base')),
  priorita text check (priorita is null or priorita in ('urgente', 'differibile')),
  stato text not null check (stato in ('da_tagliare', 'tagliata', 'tralasciata')),
  origine text not null check (origine in ('prevista', 'aggiuntiva')),
  data_taglio date,
  operatore text,
  note text,
  attenzionare boolean not null default false,
  rapportino_id text,
  import_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table campate_lavoro add column if not exists tipo text not null default 'campata';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'campate_lavoro_tipo_check'
  ) then
    alter table campate_lavoro
      add constraint campate_lavoro_tipo_check
      check (tipo in ('campata', 'base'));
  end if;
end $$;

-- Stessa campata fisica può essere sia urgente sia differibile: due interventi distinti.
-- La base (pulizia 5.2–5.4) è un registro a parte, stesso numero di sostegno.
drop index if exists campate_lavoro_unica_idx;
create unique index if not exists campate_lavoro_unica_idx
  on campate_lavoro (codice_linea, normalizzata, (coalesce(priorita, '')), tipo);
create index if not exists campate_lavoro_linea_idx on campate_lavoro(linea_id);
create index if not exists campate_lavoro_stato_idx on campate_lavoro(stato);

alter table campate_lavoro add column if not exists attenzionare boolean not null default false;
alter table campate_lavoro add column if not exists dist_int numeric;

create table if not exists campate_storico (
  id text primary key,
  campata_id text not null references campate_lavoro(id) on delete cascade,
  evento text not null,
  stato text,
  priorita text,
  operatore text,
  rapportino_id text,
  note text,
  created_at timestamptz not null
);

create index if not exists campate_storico_campata_idx on campate_storico(campata_id, created_at);

create table if not exists import_campate (
  id text primary key,
  file_name text not null,
  created_at timestamptz not null,
  created_by text not null,
  riconosciute integer not null default 0,
  nuove integer not null default 0,
  esistenti integer not null default 0,
  duplicati integer not null default 0,
  scartate integer not null default 0
);

alter table campate_lavoro enable row level security;
alter table campate_storico enable row level security;
alter table import_campate enable row level security;

drop policy if exists "campate_lavoro_select" on campate_lavoro;
create policy "campate_lavoro_select" on campate_lavoro
  for select to authenticated using (true);

drop policy if exists "campate_lavoro_write" on campate_lavoro;
create policy "campate_lavoro_write" on campate_lavoro
  for all to authenticated using (true) with check (true);

drop policy if exists "campate_storico_select" on campate_storico;
create policy "campate_storico_select" on campate_storico
  for select to authenticated using (true);

drop policy if exists "campate_storico_insert" on campate_storico;
drop policy if exists "campate_storico_write" on campate_storico;
create policy "campate_storico_write" on campate_storico
  for all to authenticated using (true) with check (true);

drop policy if exists "import_campate_select" on import_campate;
create policy "import_campate_select" on import_campate
  for select to authenticated using (true);

drop policy if exists "import_campate_write" on import_campate;
create policy "import_campate_write" on import_campate
  for all to authenticated using (is_tecnico()) with check (is_tecnico());
