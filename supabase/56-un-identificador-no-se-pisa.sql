-- ============================================================
--  AgroGestión — Hoja 56: un identificador ocupado no se pisa
--
--  Cada registro nuevo que capturan los teléfonos nace con un identificador hecho de la hora más una parte al azar.
--  Eso hace una coincidencia casi imposible, pero «casi» lo decide el teléfono. La base no debe depender de eso: si
--  dos registros DISTINTOS llegan con el mismo identificador, el segundo NO puede quedarse encima del primero.
--
--  Cómo: cada registro capturado lleva dentro una marca de nacimiento (`_nace`), al azar, que se pone una sola vez al
--  crearlo y viaja con él para siempre (al corregirlo, cancelarlo, restaurarlo o volverlo a subir). Si llega un
--  registro a un identificador que ya existe y su marca de nacimiento NO es la del que está guardado, no es una
--  corrección del mismo registro: es OTRO registro. La base lo rechaza con un error claro y el guardado queda intacto.
--  La app lo enseña a quien lo capturó; nada se pierde en silencio.
--
--  Lo que NO cambia:
--    · Volver a subir el MISMO registro (un reintento, una corrección, una restauración): misma marca, pasa.
--    · Los registros con identificador de nombre propio (la recepción de una compra, la compra de una solicitud, el
--      gasto de una salida de caja, una configuración): no llevan marca, y siguen siendo «el mismo hecho, una vez».
--    · Los registros de antes de esta hoja, que no traen marca: se les puede poner una vez; después ya no cambia.
--
--  Vale para TODAS las tablas con columna `datos`, también `eventos`. Se puede correr las veces que haga falta.
-- ============================================================

create or replace function cuidar_identidad()
returns trigger language plpgsql set search_path = public
as $$
declare vieja text; nueva text;
begin
  vieja := old.datos->>'_nace';
  if vieja is null then return new; end if;                    -- el guardado no tiene marca: nada que cuidar
  nueva := new.datos->>'_nace';
  if nueva is distinct from vieja then
    raise exception 'identificador_ocupado: ya existe otro registro con el identificador "%" en %. No se sobrescribió.', old.id, tg_table_name
      using errcode = '23505';
  end if;
  return new;
end $$;
-- Sólo la usa el candado de cada tabla: ninguna cuenta la llama.
revoke all on function cuidar_identidad() from public, anon, authenticated;

do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables b on b.table_schema = c.table_schema and b.table_name = c.table_name and b.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'datos' and c.data_type = 'jsonb'
      and exists (select 1 from information_schema.columns i where i.table_schema = 'public' and i.table_name = c.table_name and i.column_name = 'id')
  loop
    -- El nombre empieza con «a_» para que corra ANTES que los demás candados de la tabla: primero se sabe si es el mismo registro.
    execute format('drop trigger if exists a_cuidar_identidad on %I', t);
    execute format('create trigger a_cuidar_identidad before update on %I for each row execute function cuidar_identidad()', t);
  end loop;
end $$;
