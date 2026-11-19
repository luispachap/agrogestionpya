-- ============================================================
--  AGROGESTIÓN — Agregar tablas "config_emisor" y "control_corrida"
--  Agroselectos P&A
--
--  Estas dos tablas son nuevas y la app ya las usa:
--
--   • config_emisor   → datos fiscales para la remisión de venta
--                        (razón social, RFC, domicilio). Un solo registro.
--
--   • control_corrida → control de cada corrida: productividad
--                        (cajas por minuto, lecturas por hora) y
--                        calidad (muestreo AQLS: % de bueno, dientes,
--                        hongo, calavereado, etc.).
--
--  Sin estas tablas, esas funciones guardan SOLO en el teléfono y
--  no se sincronizan a la nube ni entre dispositivos. Después de
--  correr esto, ya quedan respaldadas y compartidas como todo lo demás.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- ---------- 1. Datos fiscales del emisor (para la remisión) ----------
create table if not exists config_emisor (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table config_emisor is 'Datos fiscales del emisor para la remisión de venta (razón social, RFC, domicilio). Un solo registro con id=emisor.';

alter table config_emisor enable row level security;

drop policy if exists "leer config_emisor"   on config_emisor;
drop policy if exists "crear config_emisor"  on config_emisor;
drop policy if exists "editar config_emisor" on config_emisor;
drop policy if exists "borrar config_emisor" on config_emisor;

create policy "leer config_emisor" on config_emisor
  for select using (tiene_perfil());
create policy "crear config_emisor" on config_emisor
  for insert with check (tiene_perfil());
create policy "editar config_emisor" on config_emisor
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar config_emisor" on config_emisor
  for delete using (tiene_perfil());

-- ---------- 2. Control de corrida (productividad + calidad) ----------
create table if not exists control_corrida (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table control_corrida is 'Control de cada corrida: productividad (cajas/min, lecturas por hora) y calidad (muestreo AQLS). El campo tipo distingue productividad vs calidad.';

alter table control_corrida enable row level security;

drop policy if exists "leer control_corrida"   on control_corrida;
drop policy if exists "crear control_corrida"  on control_corrida;
drop policy if exists "editar control_corrida" on control_corrida;
drop policy if exists "borrar control_corrida" on control_corrida;

create policy "leer control_corrida" on control_corrida
  for select using (tiene_perfil());
create policy "crear control_corrida" on control_corrida
  for insert with check (tiene_perfil());
create policy "editar control_corrida" on control_corrida
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar control_corrida" on control_corrida
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. Las dos tablas nuevas ya existen y están protegidas.
--  La remisión y el control de corrida ahora sí suben a la nube.
-- ============================================================
