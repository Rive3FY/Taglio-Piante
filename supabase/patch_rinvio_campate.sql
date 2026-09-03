-- Elenco parallelo «Da riprendere»: promemoria di mese/anno sulle campate.
-- Non è uno stato di taglio: le torte restano legate a stato e da_non_tagliare.
-- Supabase → SQL → New query → Run. Si può rieseguire.

alter table campate_lavoro add column if not exists rinvio_mese integer;
alter table campate_lavoro add column if not exists rinvio_anno integer;
alter table campate_lavoro add column if not exists rinvio_note text;
alter table campate_lavoro add column if not exists rinvio_by text;
alter table campate_lavoro add column if not exists rinvio_fatta_il timestamptz;
alter table campate_lavoro add column if not exists rinvio_fatta_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campate_lavoro_rinvio_mese_check'
  ) then
    alter table campate_lavoro
      add constraint campate_lavoro_rinvio_mese_check
      check (rinvio_mese is null or rinvio_mese between 1 and 12);
  end if;
end $$;

create index if not exists campate_lavoro_rinvio_idx on campate_lavoro(rinvio_mese);

notify pgrst, 'reload schema';
