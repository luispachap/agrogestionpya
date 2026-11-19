-- ============================================================
--  AGROGESTIÓN — Agregar tabla "corridas"
--  Agroselectos P&A
--
--  Registra las corridas de ajo: el encajado por calibre tras la
--  seleccionadora. Cada corrida se liga a su siembra/parcela de
--  origen (trazabilidad), guarda las líneas por calibre (cajas,
--  peso bruto, tara, neto), alimenta el inventario de terminados
--  y genera la remisión.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists corridas (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table corridas is 'Corridas de ajo (encajado por calibre tras seleccionadora). Cada corrida liga a su siembra/parcela de origen, guarda líneas por calibre con peso bruto/tara/neto, y alimenta el inventario de terminados.';

alter table corridas enable row level security;

drop policy if exists "leer corridas"   on corridas;
drop policy if exists "crear corridas"   on corridas;
drop policy if exists "editar corridas"  on corridas;
drop policy if exists "borrar corridas"  on corridas;

create policy "leer corridas" on corridas
  for select using (tiene_perfil());
create policy "crear corridas" on corridas
  for insert with check (tiene_perfil());
create policy "editar corridas" on corridas
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar corridas" on corridas
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla corridas ya existe y está protegida.
-- ============================================================
