-- AgroGestión — Hoja 51: el tope MENSUAL de IA cubre también la lectura de la importación.
--
-- Había dos límites que no se veían entre sí:
--   · el TOTAL de la importación (hoja 44, `ia_importacion_tope_microusd`, 4 USD en total, no por mes), y
--   · el MENSUAL (hoja 50, `ia_mes_tope_microusd`), que sólo lo respetaba la lectura de fotos.
-- Desde aquí la importación respeta LOS DOS: no pasa de su total, y tampoco hace que el mes rebase su límite.
-- Las dos únicas funciones que pagan IA (`leer-papel` e `interpretar-documento`) quedan bajo el tope del mes.
-- Se puede correr las veces que haga falta.

create or replace function reservar_ia(p_funcion text, p_huella text, p_cuenta uuid, p_modelo text, p_nivel text, p_microusd_max bigint)
returns uuid language plpgsql security definer set search_path = public
as $$
declare tope bigint; tope_mes bigint; llevado bigint; del_mes bigint; nuevo uuid;
begin
  if p_microusd_max is null or p_microusd_max <= 0 then raise exception 'Falta cuánto puede costar la lectura'; end if;
  -- El candado: quien llegue al mismo tiempo espera aquí a que el otro termine de apartar.
  select ia_importacion_tope_microusd, ia_mes_tope_microusd into tope, tope_mes from limites where id = 'unico' for update;
  if tope is null then return null; end if;
  -- Una lectura que se quedó «en curso» más de 15 minutos no se cobró: se suelta lo apartado.
  update uso_ia set estado = 'fallida', microusd = 0, cerrada = now()
   where estado = 'en_curso' and cuando < now() - interval '15 minutes';
  select coalesce(sum(microusd), 0) into llevado from uso_ia where funcion = p_funcion and de_cache = false;
  if llevado + p_microusd_max > tope then return null; end if;
  select coalesce(sum(microusd), 0) into del_mes from uso_ia where de_cache = false and coalesce(estado, 'hecha') <> 'fallida' and cuando >= inicio_del_mes_local();
  if tope_mes is not null and del_mes + p_microusd_max > tope_mes then return null; end if;
  insert into uso_ia (huella, funcion, cuenta, de_cache, microusd, modelo, nivel, estado, operacion)
  values (p_huella, p_funcion, p_cuenta, false, p_microusd_max, p_modelo, p_nivel, 'en_curso', 'importar_documento') returning id into nuevo;
  return nuevo;
end $$;
revoke all on function reservar_ia(text, text, uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function reservar_ia(text, text, uuid, text, text, bigint) to service_role;
