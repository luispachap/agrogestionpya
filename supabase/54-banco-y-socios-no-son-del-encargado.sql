-- ============================================================
--  AgroGestión — Hoja 54: Banco y Socios no son del encargado
--
--  Decisión de Luis (22 nov): el perfil «encargado» NO consulta ni captura estados de cuenta, titulares, bolsas ni
--  aportaciones de los socios. Esos módulos son de Dirección y de la administración.
--  La pantalla ya no se los ofrece; esta hoja cierra la puerta de abajo: aunque llame directo a la base, no lee
--  ni escribe nada de esas cuatro tablas.
--
--  No borra ningún dato. Se puede correr las veces que haga falta. Requiere la hoja 24.
-- ============================================================
update permisos_rol
   set leer = false, crear = false, editar = false, borrar = false
 where rol = 'encargado' and tabla in ('estados_cuenta', 'titulares', 'bolsas', 'aportaciones');

-- CÓMO COMPROBAR
--   select tabla, leer, crear, editar, borrar from permisos_rol
--    where rol = 'encargado' and tabla in ('estados_cuenta', 'titulares', 'bolsas', 'aportaciones');
--   → las cuatro en false.
