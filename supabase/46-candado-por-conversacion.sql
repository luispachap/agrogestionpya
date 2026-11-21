-- ============================================================
--  HOJA 46 — El candado por conversación, puesto en la base.
--
--  Hasta aquí, quién veía cada conversación lo decidía la pantalla. Ahora lo
--  decide la base: un mensaje de una conversación sólo lo lee, lo escribe o lo
--  cambia quien PARTICIPA en ella. Ser administrador o superadministrador no
--  alcanza.
--
--  TRES NIVELES (decididos por Luis, 21 nov):
--   1. Lo interpretado y lo registrado: se consulta en sus tablas de siempre,
--      con los permisos de siempre. Esta hoja no los toca.
--   2. La EVIDENCIA: los mensajes concretos que sustentan un registro. Quien
--      no participa los ve sólo con el permiso `ver_evidencia`, sólo los
--      marcados como evidencia, y cada consulta queda en la bitácora.
--   3. La conversación COMPLETA de la que no se participa: sólo con el permiso
--      `supervisar_conversaciones`, diciendo el motivo, por tiempo limitado y
--      dejando rastro. No es para vigilar: es supervisión con control.
--
--  Los dos permisos se asignan cuenta por cuenta (como los de pagos o
--  cierres) y aquí NO valen por ser superadministrador: hay que tenerlos
--  otorgados, y otorgarlos también deja rastro de quién lo hizo.
--
--  La conversación general (mensajes sin conversación) sigue como estaba.
-- ============================================================

insert into operaciones_sensibles (tipo, operacion) values
  ('consulta_evidencia',    'ver_evidencia'),
  ('consulta_conversacion', 'supervisar_conversaciones')
on conflict (tipo) do nothing;

-- Quién participa en cada conversación. La llena la base al recibir los eventos; nadie la escribe a mano.
create table if not exists conversacion_miembros (
  conversacion text not null,
  miembro      text,           -- la cuenta (uid) o la persona del catálogo
  rol          text,           -- o un puesto completo
  desde        timestamptz not null default now()
);
create index if not exists conversacion_miembros_idx on conversacion_miembros (conversacion);
create unique index if not exists conversacion_miembros_unico on conversacion_miembros (conversacion, coalesce(miembro, ''), coalesce(rol, ''));

-- Las consultas excepcionales: quién, cuál conversación, por qué y hasta cuándo.
create table if not exists consultas_de_conversacion (
  id           bigint generated always as identity primary key,
  usuario      uuid not null,
  conversacion text not null,
  motivo       text not null,
  desde        timestamptz not null default now(),
  hasta        timestamptz not null
);

alter table conversacion_miembros enable row level security;
alter table consultas_de_conversacion enable row level security;
drop policy if exists "ver participantes" on conversacion_miembros;
create policy "ver participantes" on conversacion_miembros for select using (tiene_perfil());
-- Las consultas excepcionales no son secretas: cualquiera con perfil puede ver quién consultó qué y por qué.
drop policy if exists "ver consultas" on consultas_de_conversacion;
create policy "ver consultas" on consultas_de_conversacion for select using (tiene_perfil());
revoke all on conversacion_miembros, consultas_de_conversacion from anon;
revoke insert, update, delete on conversacion_miembros, consultas_de_conversacion from authenticated;

-- El puesto de la cuenta, como lo entiende la mensajería (un superadministrador es administración).
create or replace function mi_puesto()
returns text language sql stable security definer set search_path = public as $$
  select case rol when 'superadmin' then 'admin' else rol end from perfiles where id = auth.uid();
$$;

-- El permiso tiene que estar OTORGADO a la cuenta. Aquí ser superadministrador no lo da.
create or replace function tiene_otorgado(p_operacion text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from permisos_operacion where usuario = auth.uid() and operacion = p_operacion and revocado is null);
$$;

create or replace function participa_en(p_conversacion text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from conversacion_miembros m
     where m.conversacion = p_conversacion and (m.miembro = auth.uid()::text or m.rol = mi_puesto()));
$$;

-- ¿Esta cuenta puede leer los mensajes de esta conversación?
create or replace function ve_conversacion(p_conversacion text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_conversacion is null or p_conversacion = '' or p_conversacion = 'general' then true
    else participa_en(p_conversacion)
      or exists (select 1 from consultas_de_conversacion c
                  where c.conversacion = p_conversacion and c.usuario = auth.uid() and now() < c.hasta)
  end;
$$;

-- Los participantes salen del evento con que se abre o se cambia la conversación.
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
    for m in select * from jsonb_array_elements(coalesce(new.datos->'datos'->'miembros', '[]'::jsonb)) loop
      if m->>'tipo' = 'rol' then insert into conversacion_miembros (conversacion, rol) values (v_conv, m->>'rol') on conflict do nothing;
      elsif coalesce(m->>'id', '') <> '' then insert into conversacion_miembros (conversacion, miembro) values (v_conv, m->>'id') on conflict do nothing;
      end if;
    end loop;
  elsif new.tipo = 'conversacion_cambio' then
    v_conv := new.datos->'datos'->>'conversacion';
    -- Sólo un participante cambia a los participantes. Lo demás se guarda como evento, pero no surte efecto.
    if v_conv is null or (auth.uid() is not null and not participa_en(v_conv)) then return new; end if;
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
drop trigger if exists eventos_participantes on eventos;
create trigger eventos_participantes after insert on eventos for each row execute function anotar_participantes();

-- El candado. La general sigue con sus permisos; las demás, además, piden participar.
drop policy if exists "leer chat" on chat;
drop policy if exists "crear chat" on chat;
drop policy if exists "editar chat" on chat;
create policy "leer chat" on chat for select
  using (puede('chat', 'leer') and ve_conversacion(datos->>'conversacion'));
-- Se puede escribir en una conversación en la que se participa. (Si el mensaje llega antes que el evento que la
-- abre —pasa sin señal—, se acepta: quien lo mandó no gana con eso el derecho de leer nada.)
create policy "crear chat" on chat for insert
  with check (puede('chat', 'crear') and (
    coalesce(datos->>'conversacion', 'general') = 'general'
    or participa_en(datos->>'conversacion')
    or not exists (select 1 from conversacion_miembros m where m.conversacion = datos->>'conversacion')));
-- Cambiar un mensaje (contestar lo que falta, confirmar) sólo lo hace un participante: una consulta excepcional es de sólo lectura.
create policy "editar chat" on chat for update
  using (puede('chat', 'editar') and (coalesce(datos->>'conversacion', 'general') = 'general' or participa_en(datos->>'conversacion')))
  with check (puede('chat', 'editar') and (coalesce(datos->>'conversacion', 'general') = 'general' or participa_en(datos->>'conversacion')));

-- Lo que queda escrito de cada consulta, en la bitácora que nadie puede cambiar.
create or replace function anotar_consulta(p_accion text, p_registro text, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_espacio text; v_nombre text;
begin
  select espacio into v_espacio from operacion where id = 'unico';
  select nombre into v_nombre from perfiles where id = auth.uid();
  insert into auditoria (id, fecha, tabla, registroid, accion, quien, datos)
  values ('aud-' || replace(gen_random_uuid()::text, '-', ''), to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD'),
          'chat', p_registro, p_accion, coalesce(v_nombre, auth.uid()::text),
          p_datos || jsonb_build_object('cuenta', auth.uid(), 'cuando', now(), '_espacio', v_espacio));
end $$;

-- NIVEL 3 · Abrir por excepción una conversación en la que no se participa.
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
  insert into consultas_de_conversacion (usuario, conversacion, motivo, hasta) values (auth.uid(), p_conversacion, trim(p_motivo), v_hasta);
  perform anotar_consulta('consulto_conversacion', p_conversacion, jsonb_build_object('motivo', trim(p_motivo), 'hasta', v_hasta));
  return v_hasta;
end $$;

-- NIVEL 2 · Ver los mensajes concretos que sustentan un registro, sin participar en la conversación.
-- Sólo mensajes marcados como evidencia (de ellos salió algo que una persona confirmó). Si el mensaje toca dinero,
-- además hay que poder leer los gastos.
create or replace function ver_evidencia(p_mensajes text[], p_motivo text default null)
returns setof chat language plpgsql security definer set search_path = public as $$
declare v_ids text[];
begin
  if not tiene_otorgado('ver_evidencia') then
    raise exception 'Ver la evidencia pide ese permiso, otorgado a tu cuenta.' using errcode = '42501';
  end if;
  select array_agg(c.id) into v_ids from chat c
   where c.id = any(p_mensajes) and c.borrado is null
     and (c.datos->>'esEvidencia') = 'true'
     and ((c.datos->>'sensible') is distinct from 'true' or puede('egresos', 'leer'));
  if v_ids is null then return; end if;
  perform anotar_consulta('consulto_evidencia', v_ids[1], jsonb_build_object('mensajes', to_jsonb(v_ids), 'motivo', nullif(trim(coalesce(p_motivo, '')), '')));
  return query select * from chat where id = any(v_ids);
end $$;

-- Con quién se puede abrir una conversación: nombre y puesto de las cuentas del rancho. Nada más.
create or replace function directorio_de_cuentas()
returns table (id uuid, nombre text, rol text) language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, case p.rol when 'superadmin' then 'admin' else p.rol end
    from perfiles p where tiene_perfil() order by p.nombre;
$$;

revoke execute on function anotar_consulta(text, text, jsonb), anotar_participantes() from public, anon, authenticated;
revoke execute on function consultar_conversacion(text, text), ver_evidencia(text[], text), directorio_de_cuentas(), ve_conversacion(text), participa_en(text), tiene_otorgado(text), mi_puesto() from public, anon;
grant execute on function consultar_conversacion(text, text), ver_evidencia(text[], text), directorio_de_cuentas(), ve_conversacion(text), participa_en(text), tiene_otorgado(text), mi_puesto() to authenticated;
