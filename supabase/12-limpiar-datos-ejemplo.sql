-- ============================================================
--  AGROGESTIÓN — Borrón de datos de EJEMPLO
--  Agroselectos P&A
--
--  Vacía todas las tablas de movimientos y catálogos de ejemplo,
--  CONSERVANDO lo único real que ya tienes capturado:
--      • parcelas      (tus 23 parcelas reales)
--      • trabajadores  (tus 11 trabajadores reales)
--      • ranchos       (Agroselectos P&A)
--
--  Después de correr esto, la app queda "en blanco" salvo esos
--  catálogos reales, lista para empezar a capturar de verdad.
--
--  ⚠️ IMPORTANTE — ANTES DE CORRER ESTO:
--  1. Esto NO se puede deshacer. Si tienes la MENOR duda de que
--     hay algo real capturado, primero entra a la app → 💾 Respaldo
--     y descarga una copia. Con ese respaldo puedes recuperar todo.
--  2. Si más adelante quieres que TAMBIÉN se borren parcelas o
--     trabajadores, quita el "--" de las líneas correspondientes
--     al final de este archivo.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- Movimientos y catálogos de ejemplo: se vacían por completo.
truncate table
  cultivos,
  siembras,
  encargados,
  agronomos,
  cuadrillas,
  externos,
  maquinaria,
  inventario,
  actividades,
  cosechas,
  aplicaciones,
  ingresos,
  egresos,
  compras,
  entradas_inv,
  tareas,
  bonificaciones,
  incidencias,
  prestamos,
  cajachica,
  creditos,
  proveedores,
  ciclos,
  asistencia,
  envios_bodega,
  solicitudes_compra,
  bitacora,
  avances_fase,
  embarques,
  terminados,
  corridas,
  estibas
;

-- ============================================================
--  LO QUE SE CONSERVA (NO se toca):
--    parcelas, trabajadores, ranchos, config_seguridad, config_contpaqi
--
--  Si en el futuro quieres borrar TAMBIÉN estos, quita el "--":
--  truncate table parcelas;
--  truncate table trabajadores;
--  truncate table ranchos;
-- ============================================================

-- ============================================================
--  LISTO. La base quedó limpia de datos de ejemplo.
--  Tus parcelas y trabajadores reales siguen intactos.
--  Cierra la app por completo y vuelve a abrirla para ver el cambio.
-- ============================================================
