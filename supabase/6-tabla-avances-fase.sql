-- ============================================================
--  AGROGESTIÓN — Agregar tabla "avances_fase"
--  Agroselectos P&A
--
--  Guarda los avances de fase reportados a mano en campo
--  (ej. "la emergencia va al 60%"). Cada reporte queda con
--  su fecha y quién lo hizo.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists avances_fase (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table avances_fase is 'Avances de fase reportados manualmente en campo (porcentaje y estado por etapa fenológica).';

alter table avances_fase enable row level security;

drop policy if exists "leer avances_fase"   on avances_fase;
drop policy if exists "crear avances_fase"   on avances_fase;
drop policy if exists "editar avances_fase"  on avances_fase;
drop policy if exists "borrar avances_fase"  on avances_fase;

create policy "leer avances_fase" on avances_fase
  for select using (tiene_perfil());
create policy "crear avances_fase" on avances_fase
  for insert with check (tiene_perfil());
create policy "editar avances_fase" on avances_fase
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar avances_fase" on avances_fase
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla avances_fase ya existe y está protegida.
-- ============================================================
