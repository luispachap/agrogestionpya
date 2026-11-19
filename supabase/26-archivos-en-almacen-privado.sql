-- ============================================================
--  AGROGESTIÓN — Las fotos y los PDF salen de la base
--  Agroselectos P&A
--
--  Antes la foto de cada ticket viajaba DENTRO del registro: llenaba el
--  teléfono con unas 20 fotos y llenaría la base gratuita (500 MB) en meses.
--
--  Ahora:
--   · La base guarda sólo la FICHA del archivo (tabla "archivos"): su huella,
--     cuánto pesa, de qué tipo es y dónde quedó.
--   · El archivo vive en un almacén PRIVADO ("comprobantes"): nadie lo abre
--     sin sesión y sin permiso; no hay enlaces públicos.
--   · El nombre del archivo ES su huella (SHA-256). La misma foto subida dos
--     veces ocupa una sola vez: la segunda se topa con que ya existe.
--   · Tope por archivo: 3 MB, y sólo imágenes y PDF.
--   · Un comprobante NO se reemplaza ni se borra desde la app: no hay regla
--     de edición ni de borrado. Es evidencia de un pago.
--
--  Requiere la hoja 24. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists archivos (
  id          text primary key,            -- la huella SHA-256 del contenido
  datos       jsonb not null default '{}', -- ruta, tipo, bytes, nombre original, de qué registro es
  actualizado timestamptz not null default now()
);
comment on table archivos is 'Ficha de cada foto o PDF. El archivo en sí vive en el almacén privado "comprobantes"; aquí sólo su referencia.';

alter table archivos enable row level security;
drop policy if exists "leer archivos"   on archivos;
drop policy if exists "crear archivos"  on archivos;
drop policy if exists "editar archivos" on archivos;
create policy "leer archivos"   on archivos for select using (puede('archivos', 'leer'));
create policy "crear archivos"  on archivos for insert with check (puede('archivos', 'crear'));
create policy "editar archivos" on archivos for update using (puede('archivos', 'editar')) with check (puede('archivos', 'editar'));
-- (sin regla de borrado: la ficha de un comprobante no se borra)

-- Quién puede con las fichas. Todos los que capturan papeles las crean;
-- el agrónomo y el dueño sólo las ven.
insert into permisos_rol (rol, tabla, leer, crear, editar, borrar) values
  ('encargado', 'archivos', true, true, true, false),
  ('finanzas',  'archivos', true, true, true, false),
  ('agronomo',  'archivos', true, true, true, false),
  ('dueno',     'archivos', true, false, false, false)
on conflict (rol, tabla) do nothing;

-- ── El almacén privado ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ¿Todavía cabe? Se pregunta ANTES de aceptar un archivo nuevo. El tope
-- sale de la tabla "limites" (hoja 27); si aún no existe, usa 1 GB al 95 %.
create or replace function cabe_otro_archivo()
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare usado bigint; tope bigint := 1024::bigint * 1024 * 1024 * 95 / 100;
begin
  select coalesce(sum((metadata->>'size')::bigint), 0) into usado from storage.objects where bucket_id = 'comprobantes';
  if to_regclass('public.limites') is not null then
    execute 'select archivos_mb::bigint * 1024 * 1024 * tope_pct / 100 from limites limit 1' into tope;
  end if;
  return usado < coalesce(tope, 0);
end $$;

drop policy if exists "ver comprobantes"   on storage.objects;
drop policy if exists "subir comprobantes" on storage.objects;
create policy "ver comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.puede('archivos', 'leer'));
create policy "subir comprobantes" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.puede('archivos', 'crear') and public.cabe_otro_archivo());
-- (sin regla de update ni delete: un comprobante no se reemplaza ni se borra)
