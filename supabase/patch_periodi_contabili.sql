-- Inizio e chiusura del mese contabile, decisi dal tecnico dal calendario della Contabilità.
-- In Supabase → SQL → Run, una volta sola. Senza questa tabella l'app salva il periodo
-- solo sul dispositivo dove lo imposti.

create table if not exists periodi_contabili (
  mese text primary key,          -- 2026-09
  dal date,                       -- null = giorno dopo la chiusura del mese prima
  al date,                        -- null = ultimo giorno del mese
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table periodi_contabili enable row level security;

drop policy if exists "periodi_contabili_tecnico" on periodi_contabili;
create policy "periodi_contabili_tecnico" on periodi_contabili
  for all to authenticated using (is_tecnico()) with check (is_tecnico());
