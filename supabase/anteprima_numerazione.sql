-- SOLO LETTURA: non modifica niente.
-- Mostra come verrebbero rinumerati i rapportini vivi (i cancellati sono esclusi),
-- tenendo l'ordine attuale. Esegui in Supabase → SQL → New query → Run.

with vivi as (
  select
    id,
    numero,
    stato,
    data_lavoro,
    created_at,
    substring(numero from '^(RT-\d{4}-)') as prefisso,
    substring(numero from '^RT-\d{4}-(\d+)$')::int as seq
  from rapportini
  where deleted_at is null and numero ~ '^RT-\d{4}-\d+$'
)
select
  numero as numero_attuale,
  prefisso || lpad(row_number() over (partition by prefisso order by seq, created_at, id)::text, 4, '0') as numero_nuovo,
  stato,
  data_lavoro
from vivi
order by prefisso, seq, created_at, id;

-- Quanti fogli cancellati ci sono (restano cancellati, non vengono toccati):
-- select count(*) from rapportini where deleted_at is not null;
