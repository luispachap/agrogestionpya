-- ============================================================
--  39 · PRÉSTAMOS Y BAJAS TAMBIÉN PIDEN PERMISO
--
--  Un préstamo ya no nace de un renglón que cualquiera con cuenta de encargado
--  podía escribir. Ahora: el encargado SOLICITA (no es deuda); una cuenta con
--  el permiso «autorizar_prestamos» lo autoriza o lo rechaza; y la entrega del
--  dinero —que es lo que genera la deuda— y los abonos piden «autorizar_pagos».
--  Dar de baja a alguien (finiquito o liquidación) pide «determinar_prestaciones»
--  y pagarlo, «autorizar_pagos».
--
--  Aquí queda la LISTA COMPLETA de lo sensible (es la que compara la prueba de
--  la app) y cuáles piden un importe mayor que cero. Y se le quita a los
--  perfiles de encargado y finanzas el permiso de crear o cambiar renglones en
--  la tabla vieja `prestamos`: quedan sólo de lectura.
--
--  No borra ni cambia ningún dato. Requiere las hojas 24 y 37.
-- ============================================================
alter table operaciones_sensibles add column if not exists pide_importe boolean not null default false;

insert into operaciones_sensibles (tipo, operacion, pide_importe) values
  ('cierre_semana',            'cerrar_semana',           false),
  ('reapertura_semana',        'cerrar_semana',           false),
  ('confirmacion_pagos',       'cerrar_semana',           false),
  ('cierre_mes',               'cerrar_mes',              false),
  ('reapertura_mes',           'cerrar_mes',              false),
  ('prestacion_determinada',   'determinar_prestaciones', false),
  ('prestacion_saldo_inicial', 'determinar_prestaciones', false),
  ('baja_personal',            'determinar_prestaciones', false),
  ('pago_personal',            'autorizar_pagos',         true),
  ('pago_prestacion',          'autorizar_pagos',         true),
  ('pago_baja',                'autorizar_pagos',         true),
  ('abono_prestamo',           'autorizar_pagos',         true),
  ('prestamo_entrega',         'autorizar_pagos',         true),
  ('recibo_personal',          'autorizar_pagos',         false),
  ('prestamo_autorizacion',    'autorizar_prestamos',     true),
  ('prestamo_rechazo',         'autorizar_prestamos',     false),
  ('decision_jornada',         'decidir_asistencia',      false),
  ('horas_reconocidas',        'decidir_asistencia',      false),
  ('ajuste',                   'cambiar_reglas',          false)
on conflict (tipo) do update set operacion = excluded.operacion, pide_importe = excluded.pide_importe;

-- La misma validación de la hoja 37, pero qué tipos piden importe ya no está escrito a mano: sale de la lista.
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
    ok := puede_operar(op);
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
  if op is not null and old.estado = 'vigente' and new.estado is distinct from old.estado and not puede_operar(op) then
    new.estado := old.estado;
    new.datos  := old.datos;
    new.cambio_rechazado := now();
  end if;
  return new;
end $$;
revoke execute on function validar_evento() from public, anon, authenticated;

-- La tabla vieja de préstamos: los perfiles que no son superadministrador ya sólo la leen.
update permisos_rol set crear = false, editar = false, actualizado = now()
 where tabla = 'prestamos' and rol in ('encargado', 'finanzas', 'dueno', 'agronomo');
