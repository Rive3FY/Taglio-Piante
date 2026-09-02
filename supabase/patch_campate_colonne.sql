-- Colonne che l’app si aspetta su campate_lavoro.
-- Supabase → SQL → New query → Run. Si può rieseguire.

alter table campate_lavoro add column if not exists dist_int numeric;
alter table campate_lavoro add column if not exists da_non_tagliare boolean not null default false;
alter table campate_lavoro add column if not exists da_non_tagliare_by text;
alter table campate_lavoro add column if not exists attenzionare_by text;

notify pgrst, 'reload schema';
