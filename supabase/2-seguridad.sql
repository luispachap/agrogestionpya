-- ============================================================
--  AGROGESTIÓN — Seguridad y políticas de acceso (RLS)
--  Agroselectos P&A
--
--  Este script ENCIENDE la protección de todas las tablas.
--  RLS = "Row Level Security": reglas que deciden quién puede
--  leer y escribir en la base de datos.
--
--  Se ejecuta DESPUÉS del archivo "1-esquema.sql".
--
--  MODELO DE SEGURIDAD ELEGIDO:
--  - Solo las personas CON CUENTA (admin, dirección, finanzas,
--    encargado, agrónomo) pueden leer y escribir en la base
--    de datos en la nube.
--  - Los trabajadores, cuadrillas y externos NO se conectan
--    directo a la base de datos: entran por PIN dentro de la
--    app, y la app (ya autenticada con una cuenta) hace los
--    registros por ellos.
--  - Esto protege la información sensible (dinero, costos) y
--    mantiene el acceso simple para los trabajadores en campo.
--
--  Quien NO tenga cuenta válida, no puede tocar nada. Punto.
-- ============================================================

-- ------------------------------------------------------------
--  PASO 1: Encender RLS en la tabla de perfiles
-- ------------------------------------------------------------
alter table perfiles enable row level security;

-- Borrar políticas previas si las hubiera (para poder re-ejecutar)
drop policy if exists "ver mi perfil" on perfiles;
drop policy if exists "admin ve todos los perfiles" on perfiles;
drop policy if exists "crear mi perfil" on perfiles;
drop policy if exists "admin edita perfiles" on perfiles;

-- Cada quien puede ver su propio perfil
create policy "ver mi perfil"
  on perfiles for select
  using (id = auth.uid());

-- Un administrador puede ver todos los perfiles
create policy "admin ve todos los perfiles"
  on perfiles for select
  using (es_admin());

-- Cada quien puede crear su propio perfil (al registrarse)
create policy "crear mi perfil"
  on perfiles for insert
  with check (id = auth.uid());

-- Solo un administrador puede cambiar roles de otros
create policy "admin edita perfiles"
  on perfiles for update
  using (es_admin());

-- ------------------------------------------------------------
--  PASO 2: Encender RLS y aplicar políticas a TODAS las tablas
--           de datos de la aplicación.
--
--  Regla general para todas:
--   - LEER  (select): cualquier persona con cuenta válida.
--   - ESCRIBIR (insert/update/delete): cualquier persona con
--     cuenta válida.
--
--  Si en el futuro quieres ajustar (por ejemplo, que solo el
--  admin pueda borrar finanzas), aquí es donde se hace.
-- ------------------------------------------------------------

-- Bloque que aplica el mismo juego de políticas a las 28 tablas
-- de datos, sin tener que repetir el bloque tabla por tabla.
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
    -- Encender la protección
    execute format('alter table %I enable row level security;', t);

    -- Borrar políticas previas si las hubiera (para poder re-ejecutar)
    execute format('drop policy if exists "leer %1$s" on %1$I;', t);
    execute format('drop policy if exists "crear %1$s" on %1$I;', t);
    execute format('drop policy if exists "editar %1$s" on %1$I;', t);
    execute format('drop policy if exists "borrar %1$s" on %1$I;', t);

    -- LEER: cualquier usuario con perfil válido
    execute format(
      'create policy "leer %1$s" on %1$I for select using (tiene_perfil());', t);

    -- CREAR: cualquier usuario con perfil válido
    execute format(
      'create policy "crear %1$s" on %1$I for insert with check (tiene_perfil());', t);

    -- EDITAR: cualquier usuario con perfil válido
    execute format(
      'create policy "editar %1$s" on %1$I for update using (tiene_perfil());', t);

    -- BORRAR: cualquier usuario con perfil válido
    execute format(
      'create policy "borrar %1$s" on %1$I for delete using (tiene_perfil());', t);
  end loop;
end $$;

-- ============================================================
--  OPCIONAL — PERFIL DE DIRECCIÓN COMO SOLO LECTURA
--
--  El perfil "dueno" (Dirección) está pensado para solo ver,
--  no modificar. La aplicación ya le oculta los botones de
--  editar y borrar, así que en la práctica no escribe nada.
--
--  Si además quieres que la base de datos RECHACE cualquier
--  intento de escritura desde ese perfil (protección extra de
--  fondo), quita los "--" de las siguientes líneas y vuelve a
--  ejecutar este archivo.
-- ============================================================

-- create or replace function es_solo_lectura()
-- returns boolean language sql security definer set search_path = public
-- as $$ select exists (select 1 from perfiles where id = auth.uid() and rol = 'dueno'); $$;

-- Si activas la función de arriba, también descomenta este bloque
-- para excluir al perfil dueno de las escrituras en TODAS las tablas:
-- do $$
-- declare
--   t text;
--   tablas text[] := array[
--     'ranchos','parcelas','cultivos','siembras','trabajadores',
--     'encargados','agronomos','cuadrillas','externos','maquinaria',
--     'inventario','actividades','cosechas','aplicaciones','ingresos',
--     'egresos','compras','entradas_inv','tareas','bonificaciones',
--     'incidencias','prestamos','cajachica','creditos','proveedores',
--     'ciclos','asistencia','envios_bodega'
--   ];
-- begin
--   foreach t in array tablas loop
--     execute format('drop policy if exists "crear %1$s" on %1$I;', t);
--     execute format('drop policy if exists "editar %1$s" on %1$I;', t);
--     execute format('drop policy if exists "borrar %1$s" on %1$I;', t);
--     execute format('create policy "crear %1$s" on %1$I for insert with check (tiene_perfil() and not es_solo_lectura());', t);
--     execute format('create policy "editar %1$s" on %1$I for update using (tiene_perfil() and not es_solo_lectura());', t);
--     execute format('create policy "borrar %1$s" on %1$I for delete using (tiene_perfil() and not es_solo_lectura());', t);
--   end loop;
-- end $$;

-- ============================================================
--  OPCIONAL — PROTECCIÓN EXTRA PARA FINANZAS
--
--  Si quieres que SOLO el administrador pueda BORRAR registros
--  de dinero (ingresos, egresos, créditos, caja chica),
--  quita los "--" de las siguientes líneas y vuelve a ejecutar
--  este archivo. Encargado, agrónomo y finanzas seguirían
--  pudiendo ver y crear, pero no borrar.
-- ============================================================

-- drop policy if exists "borrar ingresos" on ingresos;
-- create policy "borrar ingresos" on ingresos for delete using (es_admin());

-- drop policy if exists "borrar egresos" on egresos;
-- create policy "borrar egresos" on egresos for delete using (es_admin());

-- drop policy if exists "borrar creditos" on creditos;
-- create policy "borrar creditos" on creditos for delete using (es_admin());

-- drop policy if exists "borrar cajachica" on cajachica;
-- create policy "borrar cajachica" on cajachica for delete using (es_admin());

-- ============================================================
--  LISTO. La base de datos queda protegida:
--  nadie sin cuenta válida puede leer ni escribir.
-- ============================================================
