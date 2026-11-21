-- ============================================================
--  44 · LA IA EN LA IMPORTACIÓN DE DOCUMENTOS, CON UN TOPE QUE NO SE PASA
--
--  La importación de documentos puede pedirle a la IA que lea lo que los
--  lectores gratuitos no pudieron (una foto, un escaneo, una hoja desordenada).
--  Eso cuesta dinero, así que la base lleva la cuenta y pone el candado:
--
--   · Hay un TOPE TOTAL en dólares para esta función (4 USD de arranque). No es
--     mensual: es un presupuesto que se acaba y ya. Subirlo es una decisión de
--     un superadministrador, y se hace cambiando un número en «limites».
--   · Antes de cada lectura el servidor APARTA lo máximo que podría costar
--     (`reservar_ia`). Si con eso se pasaría del tope, no se llama a la IA.
--     Apartar es atómico: dos teléfonos a la vez no pueden pasarse juntos.
--   · Al terminar se anota lo que costó de verdad (`cerrar_ia`), con el modelo,
--     las unidades de texto y lo que contestó — para no pagar dos veces por el
--     mismo documento.
--   · El costo se lleva en millonésimas de dólar (un ticket cuesta fracciones
--     de centavo; en centavos enteros saldría «cero» o «uno», y las dos mienten).
--
--  Nada de esto se escribe desde la app: sólo el servidor, con su llave. La app
--  sólo puede PREGUNTAR cuánto se lleva gastado (`presupuesto_ia`).
--
--  No borra ni cambia ningún dato. Requiere las hojas 24, 27 y 28.
-- ============================================================
alter table limites add column if not exists ia_importacion_tope_microusd bigint not null default 4000000;
comment on column limites.ia_importacion_tope_microusd is 'Tope TOTAL (no mensual) de la IA en la importación de documentos, en millonésimas de dólar. 4000000 = 4 USD.';

alter table uso_ia add column if not exists microusd bigint;       -- lo que costó (o lo apartado, mientras está en curso)
alter table uso_ia add column if not exists modelo   text;
alter table uso_ia add column if not exists nivel    text;         -- economico | superior
alter table uso_ia add column if not exists estado   text;         -- en_curso | hecha | fallida
alter table uso_ia add column if not exists cerrada  timestamptz;
create index if not exists uso_ia_funcion on uso_ia (funcion);

-- Apartar. Devuelve el id de la reserva, o null si no alcanza (y entonces NO se llama a la IA).
create or replace function reservar_ia(p_funcion text, p_huella text, p_cuenta uuid, p_modelo text, p_nivel text, p_microusd_max bigint)
returns uuid language plpgsql security definer set search_path = public
as $$
declare tope bigint; llevado bigint; nuevo uuid;
begin
  if p_microusd_max is null or p_microusd_max <= 0 then raise exception 'Falta cuánto puede costar la lectura'; end if;
  -- El candado: quien llegue al mismo tiempo espera aquí a que el otro termine de apartar.
  select ia_importacion_tope_microusd into tope from limites where id = 'unico' for update;
  if tope is null then return null; end if;
  -- Una lectura que se quedó «en curso» más de 15 minutos no se cobró: se suelta lo apartado.
  update uso_ia set estado = 'fallida', microusd = 0, cerrada = now()
   where funcion = p_funcion and estado = 'en_curso' and cuando < now() - interval '15 minutes';
  select coalesce(sum(microusd), 0) into llevado from uso_ia where funcion = p_funcion and de_cache = false;
  if llevado + p_microusd_max > tope then return null; end if;
  insert into uso_ia (huella, funcion, cuenta, de_cache, microusd, modelo, nivel, estado)
  values (p_huella, p_funcion, p_cuenta, false, p_microusd_max, p_modelo, p_nivel, 'en_curso') returning id into nuevo;
  return nuevo;
end $$;

-- Cerrar: lo que costó de verdad. Si falló, cuesta cero y no guarda respuesta.
create or replace function cerrar_ia(p_id uuid, p_entrada integer, p_salida integer, p_microusd bigint, p_resultado jsonb, p_fallo boolean default false)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update uso_ia set entrada = p_entrada, salida = p_salida, microusd = case when p_fallo then 0 else greatest(coalesce(p_microusd, 0), 0) end,
         centavos = case when p_fallo then 0 else ceil(greatest(coalesce(p_microusd, 0), 0) / 10000.0)::integer end,
         resultado = case when p_fallo then null else p_resultado end, estado = case when p_fallo then 'fallida' else 'hecha' end, cerrada = now()
   where id = p_id and estado = 'en_curso';
end $$;

-- Sólo el servidor aparta y cierra. Ni la app ni un superadministrador desde la app.
revoke all on function reservar_ia(text, text, uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function cerrar_ia(uuid, integer, integer, bigint, jsonb, boolean) from public, anon, authenticated;
grant execute on function reservar_ia(text, text, uuid, text, text, bigint) to service_role;
grant execute on function cerrar_ia(uuid, integer, integer, bigint, jsonb, boolean) to service_role;

-- ¿Quién puede pedir una lectura con IA en la importación? Quien administra: no la gente de campo.
create or replace function puede_interpretar()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from perfiles where id = auth.uid() and rol in ('superadmin', 'admin', 'finanzas')); $$;
revoke all on function puede_interpretar() from public, anon;
grant execute on function puede_interpretar() to authenticated;

-- Lo que la app puede preguntar: cuánto hay, cuánto se lleva y cuánto queda. Sin documentos ni respuestas.
create or replace function presupuesto_ia(p_funcion text default 'interpretar-documento')
returns jsonb language sql stable security definer set search_path = public
as $$
  select case when not tiene_perfil() then null else jsonb_build_object(
    'tope', (select ia_importacion_tope_microusd from limites where id = 'unico'),
    'gastado', (select coalesce(sum(microusd), 0) from uso_ia where funcion = p_funcion and de_cache = false and estado = 'hecha'),
    'apartado', (select coalesce(sum(microusd), 0) from uso_ia where funcion = p_funcion and de_cache = false and estado = 'en_curso'),
    'lecturas', (select count(*) from uso_ia where funcion = p_funcion and de_cache = false and estado = 'hecha'),
    'fallidas', (select count(*) from uso_ia where funcion = p_funcion and estado = 'fallida'),
    'de_memoria', (select count(*) from uso_ia where funcion = p_funcion and de_cache = true),
    'por_modelo', (select coalesce(jsonb_object_agg(modelo, j), '{}'::jsonb) from (select modelo, jsonb_build_object('lecturas', count(*), 'microusd', sum(microusd)) j from uso_ia where funcion = p_funcion and de_cache = false and estado = 'hecha' and modelo is not null group by modelo) t)
  ) end;
$$;
revoke all on function presupuesto_ia(text) from public, anon;
grant execute on function presupuesto_ia(text) to authenticated;
