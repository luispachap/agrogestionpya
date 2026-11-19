-- ============================================================
--  AGROGESTIÓN — Vaciar catálogos para volver a subir limpio
--  Agroselectos P&A
--
--  ⚠️  Solo úsalo si quieres VACIAR los catálogos y volver a
--  subir el Excel desde la app. NO borra cuentas ni perfiles.
--  NO borra las políticas RLS.
--
--  Tablas que se vacían (los catálogos del Excel):
--   - ranchos, parcelas, cultivos, trabajadores
--   - encargados, agronomos, cuadrillas, proveedores
--
--  Tablas que se mantienen intactas:
--   - perfiles (tus cuentas de admin/agrónomo/etc.)
--   - auth.users (las cuentas en sí)
--   - Todas las tablas de movimientos (siguen vacías)
-- ============================================================

truncate table proveedores  cascade;
truncate table cuadrillas   cascade;
truncate table agronomos    cascade;
truncate table encargados   cascade;
truncate table trabajadores cascade;
truncate table cultivos     cascade;
truncate table parcelas     cascade;
truncate table ranchos      cascade;

-- ============================================================
--  LISTO. Las tablas de catálogos están vacías y listas
--  para recibir tu Excel corregido desde la app.
-- ============================================================
