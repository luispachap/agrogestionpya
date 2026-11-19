-- ============================================================
--  AGROGESTIÓN — Limpieza de políticas RLS previas
--  Agroselectos P&A
--
--  Usa este archivo SOLO si ya habías corrido el SQL de
--  seguridad antes y quieres volver a empezar limpio sin
--  borrar tus tablas ni tus datos.
--
--  Qué hace:
--   - Borra todas las políticas RLS de la base.
--   - No toca tus tablas, no borra tus datos.
--
--  Después de ejecutar este archivo, corre nuevamente el
--  archivo "2-seguridad.sql" completo.
-- ============================================================

-- ------------------------------------------------------------
--  Borrar políticas de la tabla perfiles
-- ------------------------------------------------------------
drop policy if exists "ver mi perfil" on perfiles;
drop policy if exists "admin ve todos los perfiles" on perfiles;
drop policy if exists "crear mi perfil" on perfiles;
drop policy if exists "admin edita perfiles" on perfiles;

-- ------------------------------------------------------------
--  Borrar políticas de TODAS las tablas de datos
-- ------------------------------------------------------------
do $$
declare
  t text;
  tablas text[] := array[
    'ranchos','parcelas','cultivos','siembras','trabajadores',
    'encargados','agronomos','cuadrillas','externos','maquinaria',
    'inventario','actividades','cosechas','aplicaciones','ingresos',
    'egresos','compras','entradas_inv','tareas','bonificaciones',
    'incidencias','prestamos','cajachica','creditos','proveedores',
    'ciclos','asistencia','envios_bodega'
  ];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists "leer %1$s" on %1$I;', t);
    execute format('drop policy if exists "crear %1$s" on %1$I;', t);
    execute format('drop policy if exists "editar %1$s" on %1$I;', t);
    execute format('drop policy if exists "borrar %1$s" on %1$I;', t);
  end loop;
end $$;

-- ============================================================
--  LISTO. Las políticas anteriores fueron borradas.
--  Tus tablas y tus datos siguen intactos.
--
--  Ahora ejecuta "2-seguridad.sql" para aplicar las políticas
--  nuevas, limpias y completas.
-- ============================================================
