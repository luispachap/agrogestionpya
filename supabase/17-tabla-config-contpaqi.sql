-- ============================================================
--  AGROGESTIÓN — Agregar tabla "config_contpaqi"
--  Agroselectos P&A
--
--  Guarda la configuración contable de CONTPAQi (el mapeo de
--  cuentas para exportar pólizas). Antes vivía SOLO en el
--  dispositivo: si cambiabas de teléfono o recargabas desde la
--  nube, se perdía y había que configurarla otra vez.
--
--  Después de correr esto, se respalda y comparte como todo lo demás.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists config_contpaqi (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table config_contpaqi is 'Configuración contable CONTPAQi (mapeo de cuentas para pólizas). Un solo registro.';

alter table config_contpaqi enable row level security;

drop policy if exists "leer config_contpaqi"   on config_contpaqi;
drop policy if exists "crear config_contpaqi"  on config_contpaqi;
drop policy if exists "editar config_contpaqi" on config_contpaqi;
drop policy if exists "borrar config_contpaqi" on config_contpaqi;

create policy "leer config_contpaqi" on config_contpaqi
  for select using (tiene_perfil());
create policy "crear config_contpaqi" on config_contpaqi
  for insert with check (tiene_perfil());
create policy "editar config_contpaqi" on config_contpaqi
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar config_contpaqi" on config_contpaqi
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La configuración de CONTPAQi ahora vive en la nube.
--  (Vuelve a correr el SQL 14 para confirmar: ya revisa 40 tablas.)
-- ============================================================
