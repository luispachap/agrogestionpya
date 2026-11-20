-- ============================================================
--  42 · DECIDIR SI UN BONO CUENTA PARA EL SALARIO INTEGRADO
--
--  La app ya no lo decide por el nombre del bono: si no se sabe, queda «por
--  revisar». Decidirlo después es un evento (`bono_revision`) con su fundamento,
--  y cambia la base con que se calcula una indemnización: lo valida la base con
--  la cuenta de la sesión y pide el permiso «autorizar_pagos». No lleva importe.
--
--  Aquí queda otra vez la LISTA COMPLETA de lo sensible (es la que compara la
--  prueba de la app). No borra ni cambia ningún dato. Requiere las hojas 37 y 41.
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
  ('pago_bono',                'autorizar_pagos',         true),
  ('bono_revision',            'autorizar_pagos',         false)
on conflict (tipo) do update set operacion = excluded.operacion, pide_importe = excluded.pide_importe;
