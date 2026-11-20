-- ============================================================
--  37 · LO SENSIBLE LO AUTORIZA EL SERVIDOR
--
--  Cerrar una semana, determinar una prestación, registrar un pago, decidir
--  cómo se paga un día o cambiar una regla del rancho son operaciones que la
--  APP ya limitaba… pero la pantalla no es la puerta: quien tuviera una cuenta
--  de encargado podía mandar ese registro directo a la base.
--
--  Desde esta hoja, cada evento de esos tipos lo VALIDA la base al recibirlo:
--    · quién lo subió lo dice la sesión (auth.uid()), no lo que venga escrito;
--    · el permiso se busca aquí (tabla `permisos_operacion`), no en el envío;
--    · el resultado queda sellado en columnas que nadie puede escribir:
--      `validacion` = 'autorizado' o 'rechazado'.
--  Un evento sensible rechazado SE GUARDA (queda constancia del intento y la
--  cola del teléfono no se atora), pero la app no le da ningún efecto. Uno que
--  todavía no sube no tiene sello: está "por validar" y tampoco cuenta.
--
--  Tener perfil de encargado NO da ninguno de estos permisos, y un teléfono
--  ligado a la cuenta de un encargado tampoco: sube con esa cuenta y se valida
--  con los permisos de esa cuenta. Los permisos se asignan uno por uno, a una
--  cuenta, por un superadministrador (`otorgar_permiso`), y se pueden quitar.
--
--  Cancelar o corregir un evento sensible también pide el permiso: si no lo
--  hay, el renglón se queda como estaba y se anota `cambio_rechazado`.
--
--  No borra ni cambia lo que dice ningún evento. Requiere las hojas 24, 35 y 36.
-- ============================================================

-- ── 1 · Qué tipos de evento son sensibles y qué permiso piden ──
create table if not exists operaciones_sensibles (
  tipo      text primary key,
  operacion text not null
);
insert into operaciones_sensibles (tipo, operacion) values
  ('cierre_semana',            'cerrar_semana'),
  ('reapertura_semana',        'cerrar_semana'),
  ('confirmacion_pagos',       'cerrar_semana'),
  ('prestacion_determinada',   'determinar_prestaciones'),
  ('prestacion_saldo_inicial', 'determinar_prestaciones'),
  ('pago_personal',            'autorizar_pagos'),
  ('pago_prestacion',          'autorizar_pagos'),
  ('abono_prestamo',           'autorizar_pagos'),
  ('recibo_personal',          'autorizar_pagos'),
  ('decision_jornada',         'decidir_asistencia'),
  ('horas_reconocidas',        'decidir_asistencia'),
  ('ajuste',                   'cambiar_reglas'),
  ('cierre_mes',               'cerrar_mes'),
  ('reapertura_mes',           'cerrar_mes')
on conflict (tipo) do update set operacion = excluded.operacion;
alter table operaciones_sensibles enable row level security;
drop policy if exists "leer operaciones sensibles" on operaciones_sensibles;
create policy "leer operaciones sensibles" on operaciones_sensibles for select using (auth.uid() is not null);
revoke all on operaciones_sensibles from anon;
revoke insert, update, delete, truncate on operaciones_sensibles from authenticated;

-- ── 2 · Los permisos, uno por cuenta y por operación ──
-- No se borran: quitar un permiso le pone fecha. Así queda quién lo dio, quién lo quitó y cuándo.
create table if not exists permisos_operacion (
  id           bigint generated always as identity primary key,
  usuario      uuid not null references perfiles(id),
  operacion    text not null,
  otorgado_por uuid not null,
  otorgado     timestamptz not null default now(),
  revocado     timestamptz,
  revocado_por uuid
);
create unique index if not exists permisos_operacion_vigente on permisos_operacion (usuario, operacion) where revocado is null;
alter table permisos_operacion enable row level security;
drop policy if exists "ver permisos de operacion" on permisos_operacion;
create policy "ver permisos de operacion" on permisos_operacion for select using (es_superadmin() or usuario = auth.uid());
-- Sin política de insert, update ni delete: sólo por las funciones de abajo.
revoke all on permisos_operacion from anon;
revoke insert, update, delete, truncate on permisos_operacion from authenticated;

-- ¿La cuenta de ESTA sesión puede hacer esta operación?
create or replace function puede_operar(p_operacion text)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when (select rol from perfiles where id = auth.uid()) = 'superadmin' then true
    when (select rol from perfiles where id = auth.uid()) is null then false
    else exists (select 1 from permisos_operacion where usuario = auth.uid() and operacion = p_operacion and revocado is null)
  end;
$$;
revoke execute on function puede_operar(text) from public, anon;
grant execute on function puede_operar(text) to authenticated;

-- Lo que puede la cuenta de esta sesión (para que la app no ofrezca lo que la base va a rechazar).
create or replace function mis_permisos()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'rol', (select rol from perfiles where id = auth.uid()),
    'operaciones', coalesce((select jsonb_agg(operacion order by operacion) from permisos_operacion where usuario = auth.uid() and revocado is null), '[]'::jsonb));
$$;
revoke execute on function mis_permisos() from public, anon;
grant execute on function mis_permisos() to authenticated;

-- Dar un permiso: sólo un superadministrador, a una cuenta con perfil, de una operación que exista.
create or replace function otorgar_permiso(p_usuario uuid, p_operacion text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not es_superadmin() then
    raise exception 'Los permisos de operación los asigna un superadministrador.' using errcode = '42501';
  end if;
  if not exists (select 1 from operaciones_sensibles where operacion = p_operacion) then
    raise exception 'Esa operación no existe.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from perfiles where id = p_usuario) then
    raise exception 'Esa cuenta no tiene perfil.' using errcode = 'P0001';
  end if;
  if exists (select 1 from permisos_operacion where usuario = p_usuario and operacion = p_operacion and revocado is null) then
    return;
  end if;
  insert into permisos_operacion (usuario, operacion, otorgado_por) values (p_usuario, p_operacion, auth.uid());
end $$;
revoke execute on function otorgar_permiso(uuid, text) from public, anon;
grant execute on function otorgar_permiso(uuid, text) to authenticated;

create or replace function revocar_permiso(p_usuario uuid, p_operacion text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not es_superadmin() then
    raise exception 'Los permisos de operación los quita un superadministrador.' using errcode = '42501';
  end if;
  update permisos_operacion set revocado = now(), revocado_por = auth.uid()
   where usuario = p_usuario and operacion = p_operacion and revocado is null;
end $$;
revoke execute on function revocar_permiso(uuid, text) from public, anon;
grant execute on function revocar_permiso(uuid, text) to authenticated;

-- ── 3 · El sello de validación en cada evento ──
alter table eventos add column if not exists validacion       text check (validacion in ('autorizado', 'rechazado'));
alter table eventos add column if not exists validacion_dice  text;        -- 'sin_permiso' | 'importe'
alter table eventos add column if not exists validado_por     uuid;        -- la cuenta que lo subió (la sesión, no lo que diga el evento)
alter table eventos add column if not exists validado_rol     text;
alter table eventos add column if not exists validado         timestamptz;
alter table eventos add column if not exists cambio_rechazado timestamptz; -- alguien sin permiso intentó cancelarlo o corregirlo

create or replace function validar_evento()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  op    text;
  ok    boolean;
  dice  text;
  monto numeric;
begin
  select operacion into op from operaciones_sensibles where tipo = new.tipo;

  if tg_op = 'INSERT' then
    -- Nada de esto lo decide quien sube: se pone aquí, venga lo que venga.
    new.validacion := null; new.validacion_dice := null; new.validado_por := null;
    new.validado_rol := null; new.validado := null; new.cambio_rechazado := null;
    if op is null then return new; end if;
    ok := puede_operar(op);
    dice := case when ok then null else 'sin_permiso' end;
    -- Un pago o un abono sin importe válido no se autoriza, lo suba quien lo suba.
    if ok and new.tipo in ('pago_personal', 'pago_prestacion', 'abono_prestamo') then
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
    return new;
  end if;

  -- Al actualizar, el sello no se mueve.
  new.validacion := old.validacion; new.validacion_dice := old.validacion_dice; new.validado_por := old.validado_por;
  new.validado_rol := old.validado_rol; new.validado := old.validado; new.cambio_rechazado := old.cambio_rechazado;
  -- Cancelar o corregir algo sensible también pide el permiso. Sin él, el renglón
  -- se queda como estaba (no truena: la cola del teléfono no se atora) y queda anotado.
  if op is not null and old.estado = 'vigente' and new.estado is distinct from old.estado and not puede_operar(op) then
    new.estado := old.estado;
    new.datos  := old.datos;
    new.cambio_rechazado := now();
  end if;
  return new;
end $$;

-- Corre después de `eventos_a_recibido` y antes de `eventos_z_cuidar` (van por orden alfabético).
drop trigger if exists eventos_b_validar on eventos;
create trigger eventos_b_validar before insert or update on eventos for each row execute function validar_evento();
revoke execute on function validar_evento() from public, anon, authenticated;
