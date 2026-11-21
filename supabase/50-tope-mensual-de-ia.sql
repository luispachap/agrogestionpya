-- AgroGestión — Hoja 50: tope MENSUAL de gasto en IA, con aviso y bloqueo, y de dónde salió cada llamada.
--
-- Decidido por Luis (21 nov): una foto en una conversación no llama a la IA por su cuenta; la lectura se pide. Y lo que
-- se pida tiene un límite de dinero al mes, configurable, que avisa al 70 % y bloquea al llegar.
--   · `limites.ia_mes_tope_microusd`: cuánto se puede gastar en el mes, en millonésimas de dólar (3,000,000 = 3 USD).
--     Lo cambia un superadministrador (la regla de `limites` de la hoja 27). El tope TOTAL de la importación (hoja 44)
--     sigue aparte y también cuenta dentro del mes.
--   · `limites.ia_mes_aviso_pct`: desde qué porcentaje se avisa.
--   · `uso_ia.operacion` y `uso_ia.origen`: qué pidió la llamada (leer un papel, la foto de un mensaje…) y de qué
--     registro salió. Con `cuenta`, `modelo`, `entrada`, `salida` y `microusd` queda quién, con qué y cuánto.
--   · `reservar_ia_mes`: APARTA lo máximo que puede costar antes de llamar (atómico: dos a la vez no rebasan el tope).
--     Se cierra con `cerrar_ia` (hoja 44), que deja lo que costó de verdad.
--   · `estado_de_ia()`: lo gastado del mes, el tope y si ya avisa o bloquea. Para quien administra.
-- Se puede correr las veces que haga falta.

alter table limites add column if not exists ia_mes_tope_microusd bigint not null default 3000000;
alter table limites add column if not exists ia_mes_aviso_pct integer not null default 70;
alter table uso_ia add column if not exists operacion text;
alter table uso_ia add column if not exists origen text;

-- El mes es el de Zacatecas, no el del servidor.
create or replace function inicio_del_mes_local()
returns timestamptz language sql stable set search_path = public as $$
  select date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
$$;

create or replace function reservar_ia_mes(p_funcion text, p_huella text, p_cuenta uuid, p_modelo text, p_nivel text, p_microusd_max bigint, p_operacion text, p_origen text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare tope bigint; aviso integer; llamadas integer; llevado bigint; hechas integer; nuevo uuid; despues bigint;
begin
  if p_microusd_max is null or p_microusd_max <= 0 then raise exception 'Falta cuánto puede costar la lectura'; end if;
  -- El candado: quien llegue al mismo tiempo espera aquí a que el otro termine de apartar.
  select ia_mes_tope_microusd, ia_mes_aviso_pct, ia_llamadas_mes into tope, aviso, llamadas from limites where id = 'unico' for update;
  if tope is null then return jsonb_build_object('id', null, 'motivo', 'sin_limites'); end if;
  -- Una lectura que se quedó «en curso» más de 15 minutos no se cobró: se suelta lo apartado.
  update uso_ia set estado = 'fallida', microusd = 0, cerrada = now()
   where estado = 'en_curso' and cuando < now() - interval '15 minutes';
  select coalesce(sum(microusd), 0), count(*) filter (where funcion = p_funcion) into llevado, hechas
    from uso_ia where de_cache = false and coalesce(estado, 'hecha') <> 'fallida' and cuando >= inicio_del_mes_local();
  if llevado + p_microusd_max > tope then return jsonb_build_object('id', null, 'motivo', 'tope_del_mes', 'gastado', llevado, 'tope', tope); end if;
  if llamadas is not null and hechas >= llamadas then return jsonb_build_object('id', null, 'motivo', 'tope_de_llamadas', 'llamadas', llamadas); end if;
  insert into uso_ia (huella, funcion, cuenta, de_cache, microusd, modelo, nivel, estado, operacion, origen)
  values (p_huella, p_funcion, p_cuenta, false, p_microusd_max, p_modelo, p_nivel, 'en_curso', p_operacion, p_origen) returning id into nuevo;
  despues := llevado + p_microusd_max;
  return jsonb_build_object('id', nuevo, 'gastado', llevado, 'tope', tope, 'aviso', (despues * 100 >= tope * aviso), 'pct', (despues * 100 / greatest(tope, 1)));
end $$;
revoke all on function reservar_ia_mes(text, text, uuid, text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function reservar_ia_mes(text, text, uuid, text, text, bigint, text, text) to service_role;

-- Lo que ve quien administra: cuánto va del mes, contra qué tope y en qué estado está.
create or replace function estado_de_ia()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare tope bigint; aviso integer; llevado bigint; llamadas integer; pct integer;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol in ('superadmin', 'admin', 'finanzas')) then return null; end if;
  select ia_mes_tope_microusd, ia_mes_aviso_pct into tope, aviso from limites where id = 'unico';
  select coalesce(sum(microusd), 0), count(*) into llevado, llamadas
    from uso_ia where de_cache = false and coalesce(estado, 'hecha') <> 'fallida' and cuando >= inicio_del_mes_local();
  pct := (llevado * 100 / greatest(tope, 1))::integer;
  return jsonb_build_object('gastado_microusd', llevado, 'tope_microusd', tope, 'aviso_pct', aviso, 'pct', pct, 'llamadas', llamadas,
    'estado', case when llevado >= tope then 'bloqueado' when pct >= aviso then 'aviso' else 'bien' end,
    'por_operacion', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
       select coalesce(operacion, funcion) operacion, modelo, count(*) llamadas, coalesce(sum(entrada), 0) entrada, coalesce(sum(salida), 0) salida, coalesce(sum(microusd), 0) microusd
         from uso_ia where de_cache = false and coalesce(estado, 'hecha') <> 'fallida' and cuando >= inicio_del_mes_local() group by 1, 2 order by 6 desc) x));
end $$;
revoke all on function estado_de_ia() from public, anon;
grant execute on function estado_de_ia() to authenticated;
