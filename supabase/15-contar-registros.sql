-- ============================================================
--  AGROGESTIÓN — Contar registros en cada tabla
--  Agroselectos P&A
--
--  Este SQL NO modifica nada. Cuenta cuántos registros tiene
--  CADA tabla en la nube, para que veas con números reales qué
--  está guardado (corridas, embarques, estibas, etc.).
--
--  Si capturaste una corrida y aquí aparece en "corridas" con
--  registros > 0, entonces SÍ está en la nube. Si capturaste algo
--  y sale 0, ese dato se quedó solo en el teléfono (no subió).
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

select
  relname as tabla,
  n_live_tup as registros
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc, relname;

-- ============================================================
--  NOTA: n_live_tup es un conteo aproximado y muy rápido que
--  Postgres mantiene solo. Para la mayoría de los casos es exacto.
--  Si quieres el conteo EXACTO de las tablas que más te importan
--  (corridas y embarques), corre también esto:
-- ============================================================

select 'corridas'        as tabla, count(*) as registros_exactos from corridas
union all
select 'embarques',        count(*) from embarques
union all
select 'estibas',          count(*) from estibas
union all
select 'control_corrida',  count(*) from control_corrida
union all
select 'terminados',       count(*) from terminados
union all
select 'envios_bodega',    count(*) from envios_bodega
union all
select 'aplicaciones',     count(*) from aplicaciones
union all
select 'inventario',       count(*) from inventario
union all
select 'parcelas',         count(*) from parcelas
union all
select 'trabajadores',     count(*) from trabajadores
order by tabla;

-- ============================================================
--  CÓMO LEER EL RESULTADO:
--   • Primera tabla: todas las tablas con su número de registros.
--   • Segunda tabla: conteo exacto de las más importantes.
--   • Si "corridas" o "embarques" tienen registros > 0, están en
--     la nube. Si tú capturaste varios pero salen en 0, hay que
--     revisar la sincronización (avísame y lo vemos).
-- ============================================================
