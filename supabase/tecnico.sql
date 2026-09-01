-- Crea il profilo tecnico per un account già registrato.
--
-- Prima crea l'account in Supabase:
--   Authentication → Users → Add user → Create new user
--   Email: quella del tecnico, Password: quella scelta, spunta "Auto Confirm User".
--
-- Poi sostituisci l'email qui sotto ed esegui questa query.

insert into profili (user_id, nome, email, ruolo)
select id, 'Vincenzo D''Ascenzio', email, 'tecnico'
from auth.users
where email = 'EMAIL-DEL-TECNICO@esempio.it'
on conflict (user_id) do update
  set ruolo = 'tecnico',
      nome = excluded.nome,
      email = excluded.email,
      updated_at = now();
