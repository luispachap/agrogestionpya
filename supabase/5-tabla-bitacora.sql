-- ============================================================
--  AGROGESTIÓN — Agregar tabla "bitacora"
--  Agroselectos P&A
--
--  Historial de notas de manejo por parcela: observaciones,
--  problemas, aplicaciones, decisiones, clima, etc.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists bitacora (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table bitacora is 'Notas de manejo por parcela (bitácora). Tipos: observación, problema, aplicación, decisión, clima, otro.';

alter table bitacora enable row level security;

drop policy if exists "leer bitacora"   on bitacora;
drop policy if exists "crear bitacora"   on bitacora;
drop policy if exists "editar bitacora"  on bitacora;
drop policy if exists "borrar bitacora"  on bitacora;

create policy "leer bitacora" on bitacora
  for select using (tiene_perfil());
create policy "crear bitacora" on bitacora
  for insert with check (tiene_perfil());
create policy "editar bitacora" on bitacora
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar bitacora" on bitacora
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla bitacora ya existe y está protegida.
-- ============================================================
