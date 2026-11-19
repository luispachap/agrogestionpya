-- ============================================================
--  AGROGESTIÓN — La gente de campo sube por el teléfono de su encargado
--  Agroselectos P&A
--
--  Los trabajadores y las cuadrillas no tienen cuenta: entran con su PIN en
--  el teléfono de un encargado, que SÍ tiene cuenta. Lo que capturan sube con
--  la sesión de ese encargado. No hay cuenta técnica compartida.
--
--  Para que se sepa siempre quién fue quién, cada renglón lleva DOS firmas:
--   · dentro del registro, la persona que capturó (su nombre y su id);
--   · puestas por la BASE, sin que el teléfono pueda cambiarlas: la cuenta
--     que lo subió por primera vez ("creado_por") y la última que lo tocó
--     ("subido_por").
--
--  Requiere la hoja 24. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

-- Lo que la gente de campo escribe y al encargado le faltaba.
insert into permisos_rol (rol, tabla, leer, crear, editar, borrar) values
  ('encargado', 'compras', true, true, true, false)
on conflict (rol, tabla) do update set leer = true, crear = true, editar = true;

create or replace function sellar_cuenta()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
  else
    new.creado_por := old.creado_por;   -- quien lo creó no se reescribe
  end if;
  new.subido_por := auth.uid();
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
    execute format('alter table %I add column if not exists creado_por uuid', t);
    execute format('alter table %I add column if not exists subido_por uuid', t);
    execute format('drop trigger if exists %I on %I', t || '_sello_cuenta', t);
    execute format('create trigger %I before insert or update on %I for each row execute function sellar_cuenta()', t || '_sello_cuenta', t);
  end loop;
end $$;
