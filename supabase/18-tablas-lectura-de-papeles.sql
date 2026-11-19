-- ============================================================
--  AGROGESTIÓN — Agregar tablas "lecturas" y "patrones_lectura"
--  Agroselectos P&A
--
--  Para qué son:
--
--  · "lecturas"  — el buzón de papeles. Cada foto que se sube (un ticket,
--    una remisión, la carátula del horómetro) queda aquí con lo que se
--    alcanzó a leer, quién lo confirmó y si hubo que corregirlo. La FOTO
--    SIEMPRE se guarda, aunque no se haya podido leer: el encargado paga
--    $2,340 en efectivo por una banda y guarda el ticket en la bolsa de la
--    camisa; esa camisa se lava el sábado.
--
--  · "patrones_lectura" — lo que el sistema APRENDIÓ de cada proveedor.
--    Guarda DÓNDE estaba cada dato en el papel (junto a qué palabra), NUNCA
--    cuál era el valor. El rancho le compra a los mismos veinte proveedores
--    todo el año, y el ticket de agosto tiene el mismo formato que el de
--    julio: con esto, el mes que entra ese proveedor se lee gratis, sin
--    señal y sin pedirle nada a ninguna IA.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- ── El buzón de papeles ─────────────────────────────────────
create table if not exists lecturas (
  id          text primary key,
  tipo        text,                    -- ticket, factura, remision, horometro, "por identificar"
  estado      text,                    -- por revisar, confirmada, corregida, no se pudo leer
  fecha       text,                    -- la fecha del papel (AAAA-MM-DD), no la de la foto
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table lecturas is
  'Buzón de papeles: cada foto de comprobante con lo que se leyó, quién lo confirmó y si se corrigió. La foto se guarda aunque no se pueda leer.';
comment on column lecturas.estado is
  'por revisar | confirmada | corregida | no se pudo leer. "corregida" es la que importa medir: cuenta cuántas sobrevivieron sin que nadie las tocara.';

-- ── Lo que el sistema aprendió de cada proveedor ────────────
create table if not exists patrones_lectura (
  id          text primary key,
  emisor      text,                    -- "AGROVETERINARIA EL SURCO"
  tipo        text,                    -- qué clase de papel emite
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table patrones_lectura is
  'Reglas aprendidas por proveedor: junto a qué palabra estaba cada dato. Guarda la POSICIÓN, nunca el valor.';

create index if not exists patrones_lectura_emisor_idx on patrones_lectura (emisor);
create index if not exists lecturas_estado_idx on lecturas (estado);

-- ── Seguridad, igual que las demás tablas ───────────────────
alter table lecturas          enable row level security;
alter table patrones_lectura  enable row level security;

drop policy if exists "leer lecturas"   on lecturas;
drop policy if exists "crear lecturas"  on lecturas;
drop policy if exists "editar lecturas" on lecturas;
drop policy if exists "borrar lecturas" on lecturas;

create policy "leer lecturas" on lecturas
  for select using (tiene_perfil());
create policy "crear lecturas" on lecturas
  for insert with check (tiene_perfil());
create policy "editar lecturas" on lecturas
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar lecturas" on lecturas
  for delete using (tiene_perfil());

drop policy if exists "leer patrones_lectura"   on patrones_lectura;
drop policy if exists "crear patrones_lectura"  on patrones_lectura;
drop policy if exists "editar patrones_lectura" on patrones_lectura;
drop policy if exists "borrar patrones_lectura" on patrones_lectura;

create policy "leer patrones_lectura" on patrones_lectura
  for select using (tiene_perfil());
create policy "crear patrones_lectura" on patrones_lectura
  for insert with check (tiene_perfil());
create policy "editar patrones_lectura" on patrones_lectura
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar patrones_lectura" on patrones_lectura
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. Ahora son 41 tablas de la app (42 con 'perfiles').
--  Vuelve a correr el SQL 14 para confirmar que ya las revisa todas.
--
--  Una nota sobre el borrado: como en las 11 hojas anteriores, "borrar"
--  se le permite a cualquiera con perfil. Eso sigue pendiente de apretar
--  para TODAS las tablas a la vez (ver la sección "Pendiente" de
--  CLAUDE.md). Aquí importa menos que en las de dinero: un patrón
--  borrado se vuelve a aprender solo la próxima vez.
-- ============================================================
