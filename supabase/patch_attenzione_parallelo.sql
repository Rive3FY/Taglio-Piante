-- «Da attenzionare» entra nell'elenco parallelo insieme al rinvio: serve la chiusura
-- del tecnico, che lascia la riga in elenco senza toccare stato e torte.
-- Supabase → SQL → New query → Run. Si può rieseguire.

alter table campate_lavoro add column if not exists attenzionare boolean not null default false;
alter table campate_lavoro add column if not exists attenzionare_by text;
alter table campate_lavoro add column if not exists attenzionare_fatta_il timestamptz;
alter table campate_lavoro add column if not exists attenzionare_fatta_by text;

create index if not exists campate_lavoro_attenzionare_idx on campate_lavoro(attenzionare);

notify pgrst, 'reload schema';
