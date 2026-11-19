-- ============================================================
--  AGROGESTIÓN — Agregar tabla "terminados"
--  Agroselectos P&A
--
--  Inventario de producto terminado (ajo encajado por calibre).
--  Es la base de la trazabilidad: el ajo entra aquí después de
--  la seleccionadora y el encajado, y sale con los embarques.
--  Cada registro es un lote por cultivo + calibre, con su
--  existencia (cajas y kg) y su historial de movimientos.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists terminados (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table terminados is 'Inventario de ajo terminado por calibre. Cada lote (cultivo + calibre + variedad opcional) guarda existencia en cajas y kg, más el historial de entradas (encajado), salidas (embarques) y ajustes.';

alter table terminados enable row level security;

drop policy if exists "leer terminados"   on terminados;
drop policy if exists "crear terminados"   on terminados;
drop policy if exists "editar terminados"  on terminados;
drop policy if exists "borrar terminados"  on terminados;

create policy "leer terminados" on terminados
  for select using (tiene_perfil());
create policy "crear terminados" on terminados
  for insert with check (tiene_perfil());
create policy "editar terminados" on terminados
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar terminados" on terminados
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla terminados ya existe y está protegida.
-- ============================================================
