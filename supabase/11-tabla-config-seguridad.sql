-- ============================================================
--  AGROGESTIÓN — Agregar tabla "config_seguridad"
--  Agroselectos P&A
--
--  Guarda los PINs de dirección (admin, dueño, finanzas) SOLO
--  como hash SHA-256: nadie puede leerlos, ni siquiera viendo
--  la base de datos. Mientras esta tabla esté vacía, la app
--  acepta los PINs de fábrica y lo marca en ROJO en el inicio
--  para que se cambien de inmediato.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists config_seguridad (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table config_seguridad is 'PINs de los perfiles de dirección guardados como hash SHA-256 (nunca en texto plano). Un solo registro con id=seguridad.';

alter table config_seguridad enable row level security;

drop policy if exists "leer config_seguridad"   on config_seguridad;
drop policy if exists "crear config_seguridad"  on config_seguridad;
drop policy if exists "editar config_seguridad" on config_seguridad;
drop policy if exists "borrar config_seguridad" on config_seguridad;

create policy "leer config_seguridad" on config_seguridad
  for select using (tiene_perfil());
create policy "crear config_seguridad" on config_seguridad
  for insert with check (tiene_perfil());
create policy "editar config_seguridad" on config_seguridad
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar config_seguridad" on config_seguridad
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla config_seguridad ya existe y está protegida.
-- ============================================================
