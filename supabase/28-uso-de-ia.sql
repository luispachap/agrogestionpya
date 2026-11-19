-- ============================================================
--  AGROGESTIÓN — La IA se usa una vez por documento, y con presupuesto
--  Agroselectos P&A
--
--  Cada lectura con IA queda anotada con la HUELLA del documento y lo que
--  contestó. Si el mismo documento vuelve a llegar —otro teléfono, otra
--  persona, otro día— se devuelve lo ya leído: no se paga dos veces.
--
--  Y hay un tope mensual de llamadas (tabla "limites"). Al llegar, la lectura
--  con IA se detiene sola hasta el mes siguiente; capturar a mano sigue
--  funcionando igual.
--
--  Esta tabla NO se escribe desde la app: sólo la función del servidor. Por
--  eso no tiene regla de inserción — nadie puede inflar ni borrar el consumo.
--
--  Requiere las hojas 24 y 27. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists uso_ia (
  id        uuid primary key default gen_random_uuid(),
  huella    text not null,               -- SHA-256 del documento
  funcion   text not null,               -- leer-papel, oir-audio, revisar-parcela
  cuenta    uuid,                        -- quién la pidió
  cuando    timestamptz not null default now(),
  de_cache  boolean not null default false,  -- true = se contestó con lo ya leído (no costó)
  entrada   integer,                     -- unidades de texto enviadas
  salida    integer,                     -- unidades de texto recibidas
  centavos  integer,                     -- costo estimado; en blanco si no hay precio configurado
  resultado jsonb                        -- lo que contestó, para no volver a preguntar
);
create index if not exists uso_ia_huella on uso_ia (funcion, huella) where resultado is not null;
create index if not exists uso_ia_cuando on uso_ia (cuando);

alter table uso_ia enable row level security;
drop policy if exists "leer uso_ia" on uso_ia;
create policy "leer uso_ia" on uso_ia for select using (es_superadmin());
-- (sin reglas de insert, update ni delete: sólo escribe la función del servidor)
