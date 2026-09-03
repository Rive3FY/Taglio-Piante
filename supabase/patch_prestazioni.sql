-- Catalogo voci del foglio ufficiale (1.4, 1.5, 4.x, 5.1, 5.5–5.7).
-- In Supabase → SQL → Run. L’app le invia anche da sola al login.

insert into prestazioni (id, codice, descrizione, unita_misura, updated_at)
values
  ('pr_1_4', '1.4', 'Potatura di siepi ornamentali di qualsiasi dimensione e natura, con o senza l''ausilio di autocestello', 'M', now()),
  ('pr_1_5', '1.5', 'Taglio di vegetazione meccanico mediante trattore e trinciaforestale, per ogni 100 mq', '100 mq', now()),
  ('pr_4_1', '4.1', 'Scortecciatura piante resinose diam. fino a 30 cm', 'N°', now()),
  ('pr_4_2', '4.2', 'Scortecciatura piante resinose diam. da 30 cm a 50 cm', 'N°', now()),
  ('pr_4_3', '4.3', 'Scortecciatura piante resinose diam. > 50 cm', 'N°', now()),
  ('pr_5_1', '5.1', 'Pulizia di basamento a blocco unico', 'N°', now()),
  ('pr_5_5', '5.5', 'Uso cippatrice su basi linee 132 kV', 'N°', now()),
  ('pr_5_6', '5.6', 'Uso cippatrice su basi linee 220 kV', 'N°', now()),
  ('pr_5_7', '5.7', 'Uso cippatrice su basi linee 380 kV', 'N°', now())
on conflict (id) do update
set descrizione = excluded.descrizione,
    unita_misura = excluded.unita_misura,
    updated_at = excluded.updated_at;
