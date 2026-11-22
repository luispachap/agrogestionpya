-- ============================================================
--  AgroGestión — Hoja 53: restaurar un respaldo conserva quién autorizó y cuándo
--
--  El sello de lo sensible (hoja 37) lo pone la base con la cuenta que SUBE el evento. Eso está bien al capturar,
--  pero al restaurar un respaldo quien sube es quien restaura: un pago que autorizó una persona en noviembre
--  quedaba «autorizado» por otra, con la fecha del día de la restauración; y si quien restauraba no tenía ese
--  permiso, la decisión quedaba RECHAZADA y dejaba de contar. Una restauración no puede reescribir la historia.
--
--  Lo que hace:
--    · Una restauración se ABRE a propósito (`abrir_restauracion`, sólo superadministrador, con motivo) y dura una
--      hora. Queda anotada en `restauraciones`, que nadie puede editar ni borrar.
--    · Mientras está abierta, un evento que NO existe en la base y llega con su sello original (`_selloOriginal`,
--      tomado del respaldo) lo recupera tal cual: quién autorizó, con qué perfil, cuándo, y cuándo lo recibió la base.
--    · Ese evento queda marcado para siempre como restaurado: `restaurado` y `restaurado_por` los pone la base con
--      la cuenta de quien restaura. Así nunca pasa por original: se ve quién autorizó Y quién lo restauró.
--    · Un evento que SÍ existe no se toca: conserva su sello y no se marca como restaurado.
--    · Fuera de una restauración abierta, o si quien sube no es superadministrador, `_selloOriginal` se ignora y el
--      sello se pone como siempre. Nadie se autoriza solo mandando un sello escrito.
--    · NADIE PUEDE INVENTAR UNA AUTORIZACIÓN RESTAURANDO: cada sello lleva una FIRMA que pone la base con una llave
--      que ninguna cuenta puede leer (`sellos_llave`). La firma amarra el evento (su identificador, su tipo y lo que
--      dice) con quién lo autorizó, con qué perfil y cuándo. Al restaurar, la base vuelve a calcularla: si el sello
--      no es exactamente el que ella misma puso, no lo acepta y el evento se valida como cualquier otro. Ni un
--      superadministrador puede escribir «lo autorizó Fulano» ni cambiarle el importe a un pago restaurado.
--
--  Lo que NO hace: no da permisos, no cambia ningún sello existente, no permite editar ni borrar eventos.
--  Se puede correr las veces que haga falta. Requiere las hojas 36, 37 y 52.
-- ============================================================

alter table eventos add column if not exists restaurado     timestamptz;  -- cuándo se restauró (lo pone la base)
alter table eventos add column if not exists restaurado_por uuid;         -- la cuenta que lo restauró
alter table eventos add column if not exists sello_firma    text;         -- la firma del sello (la pone la base)

-- La llave con que la base firma. Ninguna cuenta la lee: sin reglas de acceso, y sin permisos.
create table if not exists sellos_llave (
  id    text primary key default 'unico' check (id = 'unico'),
  llave text not null
);
alter table sellos_llave enable row level security;
revoke all on sellos_llave from anon, authenticated, service_role;   -- ni la llave de servicio la lee: sólo las funciones de la base
insert into sellos_llave (id, llave)
  select 'unico', encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text || gen_random_uuid()::text, 'UTF8')), 'hex')
  where not exists (select 1 from sellos_llave where id = 'unico');

-- La firma de un sello: el evento entero (qué es, lo que dice y en qué estado está: vigente, cancelado o corregido)
-- + su sello. Cada cancelación o corrección aceptada se vuelve a firmar, así que tampoco se puede revivir un pago
-- cancelado ni cancelar uno vigente a la hora de restaurar.
create or replace function firma_de_sello(p_id text, p_tipo text, p_estado text, p_datos jsonb, p_validacion text, p_dice text, p_por uuid, p_rol text, p_cuando timestamptz, p_recibido timestamptz)
returns text language sql stable security definer set search_path = public
as $$
  select encode(sha256(convert_to(
    (select llave from sellos_llave where id = 'unico') || '|' ||
    encode(sha256(convert_to(concat_ws('|', p_id, p_tipo, coalesce(p_estado, ''), md5((p_datos - array['_actualizado', '_selloOriginal'])::text),
      coalesce(p_validacion, ''), coalesce(p_dice, ''), coalesce(p_por::text, ''), coalesce(p_rol, ''),
      coalesce(extract(epoch from p_cuando)::text, ''), coalesce(extract(epoch from p_recibido)::text, '')), 'UTF8')), 'hex')
    || '|' || (select llave from sellos_llave where id = 'unico'), 'UTF8')), 'hex')
$$;
revoke all on function firma_de_sello(text, text, text, jsonb, text, text, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

-- Un evento sólo nace cancelado o corregido si es uno restaurado con su firma (la marca `restaurado` la pone la base).
drop policy if exists "crear eventos" on eventos;
create policy "crear eventos" on eventos for insert with check (puede('eventos', 'crear') and (estado = 'vigente' or restaurado is not null));

create table if not exists restauraciones (
  id          uuid primary key default gen_random_uuid(),
  abierta_por uuid not null,
  motivo      text not null,
  desde       timestamptz not null default now(),
  hasta       timestamptz not null,
  eventos     integer not null default 0     -- cuántos eventos recuperaron su sello original
);
alter table restauraciones enable row level security;
drop policy if exists "ver restauraciones" on restauraciones;
create policy "ver restauraciones" on restauraciones for select using (es_admin());
-- Sin reglas de alta, cambio ni borrado: sólo se escribe por las funciones de abajo.
revoke insert, update, delete on restauraciones from anon, authenticated;

create or replace function abrir_restauracion(p_motivo text)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare fin timestamptz := now() + interval '60 minutes';
begin
  if auth.uid() is null or not es_superadmin() then raise exception 'Sólo un superadministrador puede restaurar un respaldo'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Hay que decir por qué se restaura'; end if;
  update restauraciones set hasta = now() where abierta_por = auth.uid() and hasta > now();
  insert into restauraciones (abierta_por, motivo, hasta) values (auth.uid(), trim(p_motivo), fin);
  return fin;
end $$;
revoke all on function abrir_restauracion(text) from public, anon;
grant execute on function abrir_restauracion(text) to authenticated;

-- La misma función de la hoja 52, con la restauración al principio.
create or replace function validar_evento()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  op    text;
  pide  boolean;
  ok    boolean;
  dice  text;
  monto numeric;
  sello jsonb;
  abierta uuid;
  s_val text; s_dice text; s_por uuid; s_rol text; s_cuando timestamptz; s_rec timestamptz;
begin
  -- El sello original viaja dentro del evento sólo para restaurar: nunca se guarda como parte de lo que el evento dice.
  sello := new.datos->'_selloOriginal';
  new.datos := new.datos - '_selloOriginal';
  select operacion, pide_importe into op, pide from operaciones_sensibles where tipo = new.tipo;

  if tg_op = 'INSERT' then
    new.validacion := null; new.validacion_dice := null; new.validado_por := null;
    new.validado_rol := null; new.validado := null; new.cambio_rechazado := null;
    new.restaurado := null; new.restaurado_por := null; new.sello_firma := null;

    if sello is not null and jsonb_typeof(sello) = 'object' and auth.uid() is not null and es_superadmin() then
      select id into abierta from restauraciones where abierta_por = auth.uid() and now() between desde and hasta order by desde desc limit 1;
      if abierta is not null then
        begin
          s_val := sello->>'validacion'; s_dice := sello->>'dice'; s_por := (sello->>'por')::uuid; s_rol := sello->>'rol';
          s_cuando := (sello->>'cuando')::timestamptz; s_rec := (sello->>'recibido')::timestamptz;
          -- Sólo vale el sello que la propia base firmó para ESTE evento: ni inventado, ni de otro evento, ni con otro importe.
          if s_rec is not null and sello->>'firma' is not null
             and sello->>'firma' = firma_de_sello(new.id, new.tipo, new.estado, new.datos, s_val, s_dice, s_por, s_rol, s_cuando, s_rec)
             and (case when op is null then s_val is null else s_val in ('autorizado', 'rechazado') end) then
            new.recibido := s_rec;
            new.validacion := s_val; new.validacion_dice := s_dice; new.validado_por := s_por; new.validado_rol := s_rol; new.validado := s_cuando;
            new.sello_firma := sello->>'firma';
            new.restaurado := now(); new.restaurado_por := auth.uid();
            update restauraciones set eventos = eventos + 1 where id = abierta;
            return new;
          end if;
        exception when others then
          -- Un sello mal escrito no restaura nada: se sigue por el camino de siempre.
          new.validacion := null; new.validacion_dice := null; new.validado_por := null; new.validado_rol := null; new.validado := null;
          new.restaurado := null; new.restaurado_por := null; new.sello_firma := null; new.recibido := now();
        end;
      end if;
    end if;

    if op is null then
      new.sello_firma := firma_de_sello(new.id, new.tipo, new.estado, new.datos, null, null, null, null, null, new.recibido);
      return new;
    end if;
    ok := puede_operar_evento(op);
    dice := case when ok then null else 'sin_permiso' end;
    if ok and pide then
      begin
        monto := (new.datos->'datos'->>'monto')::numeric;
      exception when others then
        monto := null;
      end;
      if monto is null or monto <= 0 then ok := false; dice := 'importe'; end if;
    end if;
    new.validacion      := case when ok then 'autorizado' else 'rechazado' end;
    new.validacion_dice := dice;
    new.validado_por    := auth.uid();
    new.validado_rol    := (select rol from perfiles where id = auth.uid());
    new.validado        := now();
    new.sello_firma     := firma_de_sello(new.id, new.tipo, new.estado, new.datos, new.validacion, new.validacion_dice, new.validado_por, new.validado_rol, new.validado, new.recibido);
    return new;
  end if;

  new.validacion := old.validacion; new.validacion_dice := old.validacion_dice; new.validado_por := old.validado_por;
  new.validado_rol := old.validado_rol; new.validado := old.validado; new.cambio_rechazado := old.cambio_rechazado;
  new.restaurado := old.restaurado; new.restaurado_por := old.restaurado_por;
  if op is not null and old.estado = 'vigente' and new.estado is distinct from old.estado and not puede_operar_evento(op) then
    new.estado := old.estado;
    new.datos  := old.datos;
    new.cambio_rechazado := now();
  end if;
  -- Lo cancelado o corregido ya no se mueve (lo cuida `cuidar_evento`, que corre después y deja el renglón viejo): su firma tampoco.
  if old.estado <> 'vigente' then new.sello_firma := old.sello_firma;
  else new.sello_firma := firma_de_sello(new.id, new.tipo, new.estado, new.datos, new.validacion, new.validacion_dice, new.validado_por, new.validado_rol, new.validado, old.recibido);
  end if;
  return new;
end $$;

-- Lo que ya estaba en la base antes de esta hoja se firma una vez, con el sello que ya tenía (sin cambiarlo).
alter table eventos disable trigger user;
update eventos set sello_firma = firma_de_sello(id, tipo, estado, datos, validacion, validacion_dice, validado_por, validado_rol, validado, recibido), actualizado = now()
 where sello_firma is null and recibido is not null;
alter table eventos enable trigger user;
