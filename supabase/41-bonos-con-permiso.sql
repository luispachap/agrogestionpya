-- ============================================================
--  41 · LOS BONOS Y SUS PAGOS TAMBIÉN LOS AUTORIZA LA BASE
--
--  Los bonos e incentivos al personal ya no se anotan en una pantalla aparte:
--  son eventos de Pagos al personal. Otorgar un bono (`bono_personal`) y
--  pagarlo (`pago_bono`) piden el permiso «autorizar_pagos» y un importe mayor
--  que cero, y los valida la base con la cuenta de la sesión, igual que un pago.
--
--  Aquí queda otra vez la LISTA COMPLETA de lo sensible (es la que compara la
--  prueba de la app). No borra ni cambia ningún dato. Requiere las hojas 37 y 39.
-- ============================================================
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
  ('ajuste',                   'cambiar_reglas',          false),
  ('salario_minimo',           'cambiar_reglas',          false),
  ('bono_personal',            'autorizar_pagos',         true),
  ('pago_bono',                'autorizar_pagos',         true)
on conflict (tipo) do update set operacion = excluded.operacion, pide_importe = excluded.pide_importe;

-- La tabla vieja de bonificaciones ya no recibe capturas: lo que tiene se conserva y se puede leer,
-- pero ningún rol agrega, cambia ni borra ahí. (El superadministrador no pasa por esta tabla de permisos;
-- la app ya no le ofrece esa captura.)
update permisos_rol set crear = false, editar = false, borrar = false, actualizado = now()
 where tabla = 'bonificaciones';
