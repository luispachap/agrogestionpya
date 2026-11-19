-- ============================================================
--  AGROGESTIÓN — Lo borrado ya no revive, y nada se borra de verdad
--  Agroselectos P&A
--
--  El problema: se borraba una tarea en un teléfono y otro teléfono, que
--  todavía la tenía guardada, la volvía a subir. Lo borrado "revivía".
--
--  La solución: borrar ya NO quita el renglón. Le pone una LÁPIDA (la fecha
--  en que se borró). Los demás teléfonos ven la lápida y lo quitan de su
--  pantalla; y aunque un teléfono viejo lo vuelva a subir, sigue borrado.
--
--  De paso: desde la app ya no existe forma de borrar un renglón de verdad.
--  El contenido se conserva y un superadministrador puede restaurarlo.
--  Se quitan TODAS las reglas de borrado directo.
--
--  Requiere la hoja 24. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

do $$
declare t text; p record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('perfiles', 'permisos_rol', 'auditoria', 'limites', 'uso_ia', 'operacion', 'invitaciones', 'preferencias')
  loop
    execute format('alter table %I add column if not exists borrado timestamptz', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE' loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- Borrar = poner la lápida. Respeta los mismos permisos de siempre.
create or replace function borrar_registro(p_tabla text, p_id text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if p_tabla in ('ingresos', 'egresos', 'prestamos', 'cajachica', 'creditos', 'estados_cuenta', 'archivos', 'auditoria') then
    raise exception 'Esto no se borra: se cancela';
  end if;
  if to_regclass('public.' || quote_ident(p_tabla)) is null
     or p_tabla in ('perfiles', 'permisos_rol', 'limites', 'uso_ia', 'operacion', 'invitaciones', 'preferencias') then
    raise exception 'Tabla desconocida';
  end if;
  if not puede(p_tabla, 'borrar') then
    raise exception 'No tienes permiso para borrar en %', p_tabla;
  end if;
  perform set_config('agro.lapida', 'si', true);
  execute format('update %I set borrado = now(), actualizado = now() where id = $1 and borrado is null', p_tabla) using p_id;
  perform set_config('agro.lapida', '', true);
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Restaurar: sólo superadministradores.
create or replace function restaurar_registro(p_tabla text, p_id text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if not es_superadmin() then raise exception 'Sólo un superadministrador restaura'; end if;
  if to_regclass('public.' || quote_ident(p_tabla)) is null then raise exception 'Tabla desconocida'; end if;
  perform set_config('agro.lapida', 'si', true);
  execute format('update %I set borrado = null, actualizado = now() where id = $1', p_tabla) using p_id;
  perform set_config('agro.lapida', '', true);
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- La lápida no se quita ni se pone escribiendo el renglón directamente:
-- un teléfono viejo que vuelve a subir su copia no lo revive.
create or replace function cuidar_lapida()
returns trigger language plpgsql
as $$
begin
  if current_setting('agro.lapida', true) is distinct from 'si' then
    new.borrado := old.borrado;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('perfiles', 'permisos_rol', 'auditoria', 'limites', 'uso_ia', 'operacion', 'invitaciones', 'preferencias')
  loop
    execute format('drop trigger if exists %I on %I', t || '_lapida', t);
    execute format('create trigger %I before update on %I for each row execute function cuidar_lapida()', t || '_lapida', t);
  end loop;
end $$;
