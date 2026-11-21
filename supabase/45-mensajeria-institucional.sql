-- ============================================================
--  HOJA 45 — Mensajería institucional: quién puede escribir.
--
--  El chat de adentro pasa a ser la mensajería de trabajo del rancho
--  (conversaciones entre personas y grupos; `src/mensajeria.js`). Para que el
--  agrónomo y finanzas puedan escribir —antes sólo leían— se les abre crear y
--  editar en `chat`. Editar hace falta porque contestar lo que le falta a una
--  propuesta o firmarla cambia el mensaje donde nació esa propuesta.
--
--  Dirección sigue de sólo lectura, como en todo lo demás.
--
--  LO QUE ESTA HOJA NO HACE (pendiente, dicho en docs/MENSAJERIA.md):
--  el candado POR CONVERSACIÓN en la base. Hoy quién ve cada conversación lo
--  decide la app; quien tenga cuenta con lectura de `chat` puede leer la tabla
--  completa llamando directo a la base.
-- ============================================================

update permisos_rol set crear = true, editar = true
 where tabla = 'chat' and rol in ('agronomo', 'finanzas');
