-- Coordinate LIDAR (C. est int / C. nord int) sulle campate.
-- Esegui in Supabase → SQL Editor.

alter table campate_lavoro add column if not exists est_int numeric;
alter table campate_lavoro add column if not exists nord_int numeric;
