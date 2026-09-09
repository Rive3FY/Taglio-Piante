-- Campata iniziata con un rapportino ma non finita: resta «da tagliare» in torta,
-- in elenco si vede arancione e si può fare un altro foglio un altro giorno.
-- Supabase → SQL → New query → Run. Si può rieseguire.

alter table campate_lavoro add column if not exists non_terminata boolean not null default false;
create index if not exists campate_lavoro_non_terminata_idx on campate_lavoro(non_terminata);

notify pgrst, 'reload schema';
