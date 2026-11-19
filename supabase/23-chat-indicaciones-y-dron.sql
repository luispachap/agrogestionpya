-- ============================================================
--  AGROGESTIÓN — El chat del rancho, las indicaciones y los vuelos del dron
--  Agroselectos P&A
--
--  TRES TABLAS QUE RESUELVEN LA MISMA COSA: que lo que se dice llegue a
--  quien le toca, y quede el rastro de que llegó.
--
--  Hoy eso pasa en un grupo de WhatsApp. Fito manda la foto de su hoja de
--  fertirriego, Gera dice por audio quién anduvo dónde, y alguien contesta
--  "va". Funciona hasta que alguien tiene que buscar, tres meses después,
--  qué se le aplicó a la parcela 53 — y son cuatrocientos mensajes.
--
--  1 · CHAT — el mismo grupo, pero adentro de la app. Cada mensaje se queda
--      con su foto o su audio original, y con lo que el sistema entendió.
--
--  2 · INDICACIONES — lo que Fito o Gera mandan HACER, ya asignado a alguien.
--      Es lo que convierte un mensaje en trabajo con dueño y con fecha.
--
--  3 · VUELOS — el recorrido del dron: fotos fechadas y ubicadas por parcela.
--      No es fotogrametría (eso es un servicio aparte y cuesta): son fotos
--      con fecha y con GPS, en línea del tiempo, con observaciones.
--
--  UNA REGLA EN LAS TRES: lo que entró NO SE BORRA.
--  Un mensaje se puede rechazar —queda marcado como rechazado— pero no
--  desaparece. Si el mensaje se pudiera borrar, la aclaración de dos meses
--  después no tiene con qué hacerse. Por eso ninguna de las tres tiene
--  política de delete: sin política, Postgres la niega, y ni el admin puede.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- ── 1 · El chat del rancho ──────────────────────────────────
create table if not exists chat (
  id          text primary key,
  fecha       text,          -- el día, para agrupar el hilo
  tipo        text,          -- texto | foto | audio | hoja
  estado      text,          -- pendiente | confirmado | corregido | rechazado | por_identificar
  deQuien     text,          -- quién lo mandó
  datos       jsonb not null default '{}',   -- el texto, la foto, el audio, lo entendido, el origen
  actualizado timestamptz not null default now()
);

comment on table chat is
  'El chat del rancho. Cada mensaje conserva su foto o su audio original junto con lo que el sistema entendió. NO tiene política de delete: un mensaje se rechaza, no se borra, porque el rastro es justo para lo que sirve.';

create index if not exists chat_fecha_idx  on chat (fecha);
create index if not exists chat_estado_idx on chat (estado);

alter table chat enable row level security;
drop policy if exists "leer chat"   on chat;
drop policy if exists "crear chat"  on chat;
drop policy if exists "editar chat" on chat;
drop policy if exists "borrar chat" on chat;

create policy "leer chat"  on chat for select using (tiene_perfil());
create policy "crear chat" on chat for insert with check (tiene_perfil());
-- Editar SÍ: confirmar o corregir un mensaje cambia su estado. Borrar NO.
create policy "editar chat" on chat for update using (tiene_perfil());

-- ── 2 · Lo que se manda hacer ───────────────────────────────
create table if not exists indicaciones (
  id          text primary key,
  fecha       text,          -- para cuándo es
  tipo        text,          -- fertirriego | tarea | compra | revision
  estado      text,          -- propuesta | mandada | confirmada | hecha | no_se_pudo
  parcela_id  text,
  asignado_a  text,          -- a quién le toca. Sin esto, no se manda a nadie.
  datos       jsonb not null default '{}',   -- los productos, las dosis, el origen, quién la mandó
  actualizado timestamptz not null default now()
);

comment on table indicaciones is
  'Lo que Fito o Gera mandan hacer, ya con dueño y con fecha. Una indicación SIN asignado_a no se manda: se queda como propuesta. Repartir mal el trabajo es peor que no repartirlo.';

create index if not exists indicaciones_fecha_idx    on indicaciones (fecha);
create index if not exists indicaciones_asignado_idx on indicaciones (asignado_a, estado);
create index if not exists indicaciones_parcela_idx  on indicaciones (parcela_id);

alter table indicaciones enable row level security;
drop policy if exists "leer indicaciones"   on indicaciones;
drop policy if exists "crear indicaciones"  on indicaciones;
drop policy if exists "editar indicaciones" on indicaciones;
drop policy if exists "borrar indicaciones" on indicaciones;

create policy "leer indicaciones"   on indicaciones for select using (tiene_perfil());
create policy "crear indicaciones"  on indicaciones for insert with check (tiene_perfil());
-- Editar SÍ: el trabajador confirma, y después marca que ya la hizo.
create policy "editar indicaciones" on indicaciones for update using (tiene_perfil());

-- ── 3 · El recorrido del dron ───────────────────────────────
create table if not exists vuelos (
  id          text primary key,
  fecha       text,          -- el día del vuelo
  parcela_id  text,
  datos       jsonb not null default '{}',   -- las fotos con su GPS, las observaciones, la revisión
  actualizado timestamptz not null default now()
);

comment on table vuelos is
  'Fotos del dron, fechadas y ubicadas por parcela, para ver cómo va cambiando cada pedazo. NO es fotogrametría: no hay ortomosaico ni NDVI calibrado. Lo que diga la revisión con IA es una OBSERVACIÓN sobre unas fotos, no una medición, y nunca dispara un movimiento sola.';

create index if not exists vuelos_parcela_fecha_idx on vuelos (parcela_id, fecha);

alter table vuelos enable row level security;
drop policy if exists "leer vuelos"   on vuelos;
drop policy if exists "crear vuelos"  on vuelos;
drop policy if exists "editar vuelos" on vuelos;
drop policy if exists "borrar vuelos" on vuelos;

create policy "leer vuelos"   on vuelos for select using (tiene_perfil());
create policy "crear vuelos"  on vuelos for insert with check (tiene_perfil());
-- Editar SÍ: agregar una observación a un vuelo ya subido.
create policy "editar vuelos" on vuelos for update using (tiene_perfil());

-- ── Comprobar que quedaron las tres ─────────────────────────
select
  t.tabla,
  case when to_regclass(t.tabla) is null then 'FALTA' else 'ok' end as existe,
  (select count(*) from pg_policies p
    where p.tablename = t.tabla and p.cmd = 'DELETE') as politicas_de_borrado
from (values ('chat'), ('indicaciones'), ('vuelos')) as t(tabla);
-- politicas_de_borrado debe salir 0 en las tres. Eso es lo que las hace
-- imborrables, y es a propósito.
