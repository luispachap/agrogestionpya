-- ============================================================
--  AgroGestión — Hoja 58: lo que la app ya les pedía y la base no les dejaba
--
--  Decisiones de Luis (24 nov), después de la primera prueba con teléfonos:
--    · El ENCARGADO puede dar de alta a un externo. «Soy externo» se registra en el teléfono ligado a la cuenta del
--      encargado, y la base lo rechazaba. Sólo el alta (nombre y fecha): corregir la ficha y la tarifa sigue siendo de la
--      administración, y lo que se le paga lo aprueba quien aprueba.
--    · El AGRÓNOMO puede dar de alta la actividad que nace al marcar como hecha una indicación (quién trabajó, cuántas
--      horas, en qué parcela) y la indicación de fertirriego que confirma en Mensajes. Las dos las ofrecía la app y la
--      base las rechazaba.
--
--  Sólo dar de ALTA: ninguno de los dos puede corregir ni borrar lo que ya está (editar y borrar siguen en false).
--  Volver a subir lo mismo después de una respuesta perdida no es corregir: la app lo comprueba (src/subir.js).
--  No borra ningún dato. Se puede correr las veces que haga falta. Requiere la hoja 24.
-- ============================================================
update permisos_rol set crear = true
 where (rol = 'encargado' and tabla = 'externos')
    or (rol = 'agronomo' and tabla in ('actividades', 'indicaciones'));

-- CÓMO COMPROBAR
--   select rol, tabla, leer, crear, editar, borrar from permisos_rol
--    where (rol = 'encargado' and tabla = 'externos') or (rol = 'agronomo' and tabla in ('actividades', 'indicaciones'));
--   → leer y crear en true; editar y borrar en false.
