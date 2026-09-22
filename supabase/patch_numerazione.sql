-- Numerazione allineata ai rapportini effettivi.
-- Esegui in Supabase → SQL → New query → Run. È riscrivibile.
-- Non cancella niente: cambia solo il campo numero dei rapportini vivi.

-- 1. Il prossimo numero ignora i rapportini cancellati.
create or replace function prossimo_numero(prefisso text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select max(numero) from rapportini
  where numero like prefisso || '%' and deleted_at is null;
$$;

grant execute on function prossimo_numero(text) to authenticated;

-- 2. Il numero di un foglio già sul server lo decide solo il server: un telefono
--    rimasto indietro non può rimettere il numero vecchio.
create or replace function proteggi_numero_rapportino()
returns trigger
language plpgsql
as $$
begin
  if new.numero is distinct from old.numero
     and coalesce(current_setting('app.rinumera', true), '') <> '1' then
    new.numero := old.numero;
  end if;
  return new;
end;
$$;

drop trigger if exists rapportini_proteggi_numero on rapportini;
create trigger rapportini_proteggi_numero
  before update on rapportini
  for each row execute function proteggi_numero_rapportino();

-- 3. Chiude i buchi lasciati dai cancellati, anno per anno, tenendo l'ordine attuale.
create or replace function compatta_numeri()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cambiati integer;
begin
  perform set_config('app.rinumera', '1', true);

  with vivi as (
    select
      id,
      created_at,
      substring(numero from '^(RT-\d{4}-)') as prefisso,
      substring(numero from '^RT-\d{4}-(\d+)$')::int as seq
    from rapportini
    where deleted_at is null and numero ~ '^RT-\d{4}-\d+$'
  ),
  nuovi as (
    select
      id,
      prefisso || lpad(row_number() over (partition by prefisso order by seq, created_at, id)::text, 4, '0') as numero
    from vivi
  )
  update rapportini r
  set numero = n.numero, updated_at = now()
  from nuovi n
  where r.id = n.id and r.numero <> n.numero;

  get diagnostics cambiati = row_count;
  perform set_config('app.rinumera', '', true);
  return cambiati;
end;
$$;

grant execute on function compatta_numeri() to authenticated;

-- 4. Allineamento iniziale dei rapportini esistenti.
select compatta_numeri() as rapportini_rinumerati;
