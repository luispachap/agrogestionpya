-- ============================================================
--  AGROGESTIÓN — Agregar tabla "estibas"
--  Agroselectos P&A
--
--  Trazabilidad por lotes. Cada estiba de ajo recibe un código
--  único (ej. AS-B-0625-A3F) y se etiqueta. Al avanzar de fase
--  (barbecho → 2ª limpia → selección) nacen estibas nuevas que
--  guardan de qué estiba(s) padre vienen (genealogía), de modo
--  que cualquier estiba terminada se rastrea hasta su(s)
--  parcela(s) de origen, aunque se hayan combinado.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists estibas (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table estibas is 'Estibas de ajo con código de trazabilidad por fase (barbecho/limpia/selección). Cada estiba guarda sus cajas, parcela/siembra de origen y las estibas padre (genealogía) para rastrear el origen completo.';

alter table estibas enable row level security;

drop policy if exists "leer estibas"   on estibas;
drop policy if exists "crear estibas"   on estibas;
drop policy if exists "editar estibas"  on estibas;
drop policy if exists "borrar estibas"  on estibas;

create policy "leer estibas" on estibas
  for select using (tiene_perfil());
create policy "crear estibas" on estibas
  for insert with check (tiene_perfil());
create policy "editar estibas" on estibas
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar estibas" on estibas
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. La tabla estibas ya existe y está protegida.
-- ============================================================
