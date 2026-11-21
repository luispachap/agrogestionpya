-- ============================================================
--  AgroGestión — Hoja 52: la organización y el catálogo de actividades los captura sólo quien está autorizado
--
--  La pantalla «Organización» (etapa 1) escondía sus botones a quien no es administrador, pero esconder un botón
--  no es una puerta: cualquier cuenta que puede guardar eventos podía, llamando directo a la base, dar de alta,
--  cambiar o cerrar una unidad. Esta hoja pone esa puerta en la base, con el mismo mecanismo de la hoja 37:
--
--    · Los hechos de la organización (áreas, equipos, responsables, adscripciones, apoyos) y los del catálogo de
--      actividades (actividades, equivalencias y requisitos) pasan a ser operaciones validadas por la base, con UNA
--      operación nueva: `configurar_organizacion`.
--    · Ese permiso NO viene con ningún perfil, tampoco con ser superadministrador: hay que tenerlo otorgado, cuenta
--      por cuenta, y otorgarlo deja rastro de quién lo hizo (igual que `ver_evidencia`). Administrar el sistema,
--      tener autoridad operativa y estar autorizado a una operación son tres cosas aparte.
--    · Sin el permiso el hecho se guarda (la cola del teléfono no se atora) pero queda RECHAZADO y no cuenta.
--      Cancelar un hecho ajeno sin el permiso tampoco surte efecto.
--
--  Lo que NO hace: no concede ningún permiso a nadie, no cambia ningún permiso existente, no crea ninguna unidad
--  ni asigna a ninguna persona. No es la etapa 3 (facultades de mando).
--  Se puede correr las veces que haga falta. Requiere las hojas 37, 39 y 46.
-- ============================================================

alter table operaciones_sensibles add column if not exists solo_otorgado boolean not null default false;

insert into operaciones_sensibles (tipo, operacion, pide_importe, solo_otorgado) values
  ('org_unidad',          'configurar_organizacion', false, true),
  ('org_unidad_cambio',   'configurar_organizacion', false, true),
  ('org_unidad_cierre',   'configurar_organizacion', false, true),
  ('org_cargo',           'configurar_organizacion', false, true),
  ('org_cargo_fin',       'configurar_organizacion', false, true),
  ('org_adscripcion',     'configurar_organizacion', false, true),
  ('org_adscripcion_fin', 'configurar_organizacion', false, true),
  ('org_apoyo',           'configurar_organizacion', false, true),
  ('act_actividad',       'configurar_organizacion', false, true),
  ('act_equivalencia',    'configurar_organizacion', false, true),
  ('act_requisito',       'configurar_organizacion', false, true)
on conflict (tipo) do update set operacion = excluded.operacion, pide_importe = excluded.pide_importe, solo_otorgado = excluded.solo_otorgado;

-- ¿La cuenta de esta sesión puede hacer esta operación AL SUBIR UN EVENTO? Las que son «sólo otorgadas» no valen
-- por el perfil: hay que tenerlas dadas a la cuenta.
create or replace function puede_operar_evento(p_operacion text)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when exists (select 1 from operaciones_sensibles where operacion = p_operacion and solo_otorgado) then tiene_otorgado(p_operacion)
    else puede_operar(p_operacion)
  end;
$$;
revoke execute on function puede_operar_evento(text) from public, anon;
grant execute on function puede_operar_evento(text) to authenticated;

-- La misma validación de la hoja 39; sólo cambia a quién le pregunta si la cuenta puede.
create or replace function validar_evento()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  op    text;
  pide  boolean;
  ok    boolean;
  dice  text;
  monto numeric;
begin
  select operacion, pide_importe into op, pide from operaciones_sensibles where tipo = new.tipo;

  if tg_op = 'INSERT' then
    new.validacion := null; new.validacion_dice := null; new.validado_por := null;
    new.validado_rol := null; new.validado := null; new.cambio_rechazado := null;
    if op is null then return new; end if;
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
    return new;
  end if;

  new.validacion := old.validacion; new.validacion_dice := old.validacion_dice; new.validado_por := old.validado_por;
  new.validado_rol := old.validado_rol; new.validado := old.validado; new.cambio_rechazado := old.cambio_rechazado;
  if op is not null and old.estado = 'vigente' and new.estado is distinct from old.estado and not puede_operar_evento(op) then
    new.estado := old.estado;
    new.datos  := old.datos;
    new.cambio_rechazado := now();
  end if;
  return new;
end $$;
revoke execute on function validar_evento() from public, anon, authenticated;
