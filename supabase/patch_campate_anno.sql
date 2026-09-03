-- Piano campate per anno. Esegui in Supabase → SQL prima di importare il 2027.
-- Non cancella rapportini né le campate già presenti: le marca come 2026.

alter table campate_lavoro add column if not exists anno integer not null default 2026;
alter table import_campate add column if not exists anno integer not null default 2026;

update campate_lavoro set anno = 2026 where anno is null;
update import_campate set anno = 2026 where anno is null;

drop index if exists campate_lavoro_unica_idx;
create unique index if not exists campate_lavoro_unica_idx
  on campate_lavoro (anno, codice_linea, normalizzata, (coalesce(priorita, '')), tipo);
create index if not exists campate_lavoro_anno_idx on campate_lavoro(anno);
