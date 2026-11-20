-- ============================================================
--  40 · EL CATÁLOGO DE SALARIOS MÍNIMOS TAMBIÉN PIDE PERMISO
--
--  Los salarios mínimos oficiales de cada año vienen con la app (con la
--  publicación del Diario Oficial de donde sale cada uno). Agregar el de un año
--  nuevo, o corregir uno, es un evento `salario_minimo`: de él depende el tope
--  de la prima de antigüedad, así que lo valida la base con el permiso
--  «cambiar_reglas», igual que cualquier otra regla del rancho.
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
  ('salario_minimo',           'cambiar_reglas',          false)
on conflict (tipo) do update set operacion = excluded.operacion, pide_importe = excluded.pide_importe;
