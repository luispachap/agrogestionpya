-- AgroGestión — Hoja 49: la conversación de cada quien con AgroGestión (el asistente) es privada.
--
-- «Dile a la app» pasó a ser una conversación más de Mensajes: la de cada persona con el asistente del sistema.
-- Es una conversación de clase 'asistente' y usa el mismo candado de la hoja 46 (sólo sus participantes la leen).
-- Esta hoja agrega lo que la hace distinta de un grupo:
--   1. Su único participante es la cuenta que la abre, diga lo que diga el evento.
--   2. No se le agrega ni se le quita gente.
--   3. No se abre por consulta excepcional, ni con el permiso de supervisión.
-- Lo que de ahí se CONFIRMA sigue quedando en los registros de siempre, con sus permisos de siempre, y su mensaje de
-- origen se puede ver como evidencia (nivel 2 de la hoja 46) igual que el de cualquier otra conversación.
-- Se puede correr las veces que haga falta.

create or replace function es_con_asistente(p_conversacion text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from eventos where id = p_conversacion and tipo = 'conversacion' and datos->'datos'->>'clase' = 'asistente');
$$;
revoke all on function es_con_asistente(text) from public, anon;
grant execute on function es_con_asistente(text) to authenticated;

create or replace function anotar_participantes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conv text; m jsonb;
begin
  if new.tipo = 'conversacion' then
    v_conv := new.id;
    -- Si ya tenía participantes (la misma conversación directa abierta desde otro aparato), no se toca.
    if exists (select 1 from conversacion_miembros where conversacion = v_conv) then return new; end if;
    if auth.uid() is not null then
      insert into conversacion_miembros (conversacion, miembro) values (v_conv, auth.uid()::text) on conflict do nothing;
    end if;
    -- La conversación con el asistente es de UNA persona: quien la abre. Lo que diga la lista de integrantes no cuenta.
    if new.datos->'datos'->>'clase' = 'asistente' then return new; end if;
    for m in select * from jsonb_array_elements(coalesce(new.datos->'datos'->'miembros', '[]'::jsonb)) loop
      if m->>'tipo' = 'rol' then insert into conversacion_miembros (conversacion, rol) values (v_conv, m->>'rol') on conflict do nothing;
      elsif coalesce(m->>'id', '') <> '' then insert into conversacion_miembros (conversacion, miembro) values (v_conv, m->>'id') on conflict do nothing;
      end if;
    end loop;
  elsif new.tipo = 'conversacion_cambio' then
    v_conv := new.datos->'datos'->>'conversacion';
    -- Sólo un participante cambia a los participantes. Lo demás se guarda como evento, pero no surte efecto.
    if v_conv is null or (auth.uid() is not null and not participa_en(v_conv)) then return new; end if;
    -- A la conversación con el asistente no se le agrega ni se le quita gente.
    if es_con_asistente(v_conv) then return new; end if;
    for m in select * from jsonb_array_elements(coalesce(new.datos->'datos'->'quitar', '[]'::jsonb)) loop
      delete from conversacion_miembros where conversacion = v_conv
         and ((m->>'tipo' = 'rol' and rol = m->>'rol') or (coalesce(m->>'tipo', 'persona') <> 'rol' and miembro = m->>'id'));
    end loop;
    for m in select * from jsonb_array_elements(coalesce(new.datos->'datos'->'agregar', '[]'::jsonb)) loop
      if m->>'tipo' = 'rol' then insert into conversacion_miembros (conversacion, rol) values (v_conv, m->>'rol') on conflict do nothing;
      elsif coalesce(m->>'id', '') <> '' then insert into conversacion_miembros (conversacion, miembro) values (v_conv, m->>'id') on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end $$;

create or replace function consultar_conversacion(p_conversacion text, p_motivo text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_hasta timestamptz := now() + interval '24 hours';
begin
  if not tiene_otorgado('supervisar_conversaciones') then
    raise exception 'Esta consulta pide el permiso de supervisión de conversaciones, otorgado a tu cuenta.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'Di el motivo de la consulta (queda anotado y lo pueden ver los demás).' using errcode = 'P0001';
  end if;
  if coalesce(p_conversacion, '') in ('', 'general') or not exists (select 1 from conversacion_miembros where conversacion = p_conversacion) then
    raise exception 'Esa conversación no existe.' using errcode = 'P0001';
  end if;
  if es_con_asistente(p_conversacion) then
    raise exception 'La conversación de cada quien con AgroGestión es privada: no se abre por consulta.' using errcode = '42501';
  end if;
  insert into consultas_de_conversacion (usuario, conversacion, motivo, hasta) values (auth.uid(), p_conversacion, trim(p_motivo), v_hasta);
  perform anotar_consulta('consulto_conversacion', p_conversacion, jsonb_build_object('motivo', trim(p_motivo), 'hasta', v_hasta));
  return v_hasta;
end $$;
