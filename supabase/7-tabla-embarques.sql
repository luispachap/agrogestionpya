-- ============================================================
--  AGROGESTIÓN — Agregar tabla "embarques"
--  Agroselectos P&A
--
--  Guarda las salidas de camión (embarques de ajo): cada envío
--  con sus tarimas pesadas (peso bruto, tara del pallet y neto),
--  el calibre de cada tarima, y los datos del transporte y
--  cliente. La app calcula el peso neto = bruto - tara.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists embarques (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table embarques is 'Salidas de camión / embarques de ajo. Cada embarque incluye sus tarimas pesadas (calibre, cajas, peso bruto, tara, neto), totales y datos de transporte (cliente, destino, transportista, placas, chofer).';

alter table embarques enable row level security;

drop policy if exists "leer embarques"   on embarques;
drop policy if exists "crear embarques"   on embarques;
drop policy if exists "editar embarques"  on embarques;
drop policy if exists "borrar embarques"  on embarques;

create policy "leer embarques" on embarques
  for select using (tiene_perfil());
create policy "crear embarques" on embarques
  for insert with check (tiene_perfil());
create policy "editar embarques" on embarques
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar embarques" on embarques
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla embarques ya existe y está protegida.
--  A partir de ahora, las salidas de camión que registres en
--  la app se guardarán también en la nube y se sincronizarán
--  entre dispositivos.
-- ============================================================
