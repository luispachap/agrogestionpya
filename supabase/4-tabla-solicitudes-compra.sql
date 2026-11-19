-- ============================================================
--  AGROGESTIÓN — Agregar tabla "solicitudes_compra"
--  Agroselectos P&A
--
--  Esta tabla guarda las solicitudes de compra itemizadas que
--  crea el personal (agrónomo, encargados, etc.) y que gestiona
--  finanzas/admin.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- 1. Crear la tabla (mismo molde que las demás tablas de movimientos)
create table if not exists solicitudes_compra (
  id          text primary key,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table solicitudes_compra is 'Solicitudes de compra itemizadas. Las crea el personal y las gestiona finanzas/admin.';

-- 2. Encender la seguridad (RLS) y aplicar las mismas políticas
--    que el resto de tablas: solo cuentas con perfil válido pueden
--    leer y escribir.
alter table solicitudes_compra enable row level security;

-- Quitar políticas previas si existían (para poder re-ejecutar sin error)
drop policy if exists "leer solicitudes_compra"   on solicitudes_compra;
drop policy if exists "crear solicitudes_compra"   on solicitudes_compra;
drop policy if exists "editar solicitudes_compra"  on solicitudes_compra;
drop policy if exists "borrar solicitudes_compra"  on solicitudes_compra;

-- Leer: cualquier cuenta con perfil válido
create policy "leer solicitudes_compra" on solicitudes_compra
  for select using (tiene_perfil());

-- Crear: cualquier cuenta con perfil válido
create policy "crear solicitudes_compra" on solicitudes_compra
  for insert with check (tiene_perfil());

-- Editar: cualquier cuenta con perfil válido
create policy "editar solicitudes_compra" on solicitudes_compra
  for update using (tiene_perfil()) with check (tiene_perfil());

-- Borrar: cualquier cuenta con perfil válido
create policy "borrar solicitudes_compra" on solicitudes_compra
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla solicitudes_compra ya existe y está protegida.
--  Ahora la app puede guardar solicitudes en la nube.
-- ============================================================
