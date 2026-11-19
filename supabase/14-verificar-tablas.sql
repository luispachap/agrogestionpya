-- ============================================================
--  AGROGESTIÓN — Verificar que TODAS las tablas necesarias existen
--  Agroselectos P&A
--
--  Este SQL NO modifica nada. Solo revisa y te muestra un reporte:
--  cada tabla que la app necesita, con ✅ si existe o ❌ si falta.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
--  Mira la columna "estado" en los resultados.
-- ============================================================

with necesarias(tabla) as (
  values
    ('ranchos'), ('parcelas'), ('cultivos'), ('siembras'), ('trabajadores'),
    ('encargados'), ('agronomos'), ('cuadrillas'), ('externos'), ('maquinaria'),
    ('inventario'), ('actividades'), ('cosechas'), ('aplicaciones'), ('ingresos'),
    ('egresos'), ('compras'), ('entradas_inv'), ('tareas'), ('bonificaciones'),
    ('incidencias'), ('prestamos'), ('cajachica'), ('creditos'), ('proveedores'),
    ('ciclos'), ('asistencia'), ('envios_bodega'), ('solicitudes_compra'),
    ('bitacora'), ('avances_fase'), ('embarques'), ('terminados'), ('corridas'),
    ('estibas'), ('config_seguridad'), ('config_emisor'), ('control_corrida'),
    ('config_contpaqi'),
    ('perfiles')
)
select
  n.tabla,
  case when t.table_name is null then '❌ FALTA' else '✅ existe' end as estado,
  case
    when t.table_name is null then 'Falta crear esta tabla'
    when c.relrowsecurity then 'Protegida (RLS activo)'
    else '⚠️ Sin RLS — revisar seguridad'
  end as seguridad
from necesarias n
left join information_schema.tables t
  on t.table_name = n.tabla and t.table_schema = 'public'
left join pg_class c
  on c.relname = n.tabla and c.relnamespace = 'public'::regnamespace
order by
  case when t.table_name is null then 0 else 1 end,  -- las que faltan, primero
  n.tabla;

-- ============================================================
--  RESUMEN: cuántas existen, cuántas faltan, y cuáles faltan
-- ============================================================
with necesarias(tabla) as (
  values
    ('ranchos'), ('parcelas'), ('cultivos'), ('siembras'), ('trabajadores'),
    ('encargados'), ('agronomos'), ('cuadrillas'), ('externos'), ('maquinaria'),
    ('inventario'), ('actividades'), ('cosechas'), ('aplicaciones'), ('ingresos'),
    ('egresos'), ('compras'), ('entradas_inv'), ('tareas'), ('bonificaciones'),
    ('incidencias'), ('prestamos'), ('cajachica'), ('creditos'), ('proveedores'),
    ('ciclos'), ('asistencia'), ('envios_bodega'), ('solicitudes_compra'),
    ('bitacora'), ('avances_fase'), ('embarques'), ('terminados'), ('corridas'),
    ('estibas'), ('config_seguridad'), ('config_emisor'), ('control_corrida'),
    ('config_contpaqi'),
    ('perfiles')
)
select
  count(*) filter (where t.table_name is not null) as tablas_ok,
  count(*) filter (where t.table_name is null)     as tablas_faltantes,
  count(*)                                          as total_necesarias,
  coalesce(string_agg(n.tabla, ', ') filter (where t.table_name is null), 'ninguna ✅') as cuales_faltan
from necesarias n
left join information_schema.tables t
  on t.table_name = n.tabla and t.table_schema = 'public';

-- ============================================================
--  CÓMO LEER EL RESULTADO:
--   • Primera tabla de resultados: lista cada tabla con su estado.
--     Las que digan "❌ FALTA" aparecen hasta arriba.
--   • Segunda tabla: el resumen. Si "tablas_faltantes" es 0 y
--     "cuales_faltan" dice "ninguna ✅", todo está completo.
--   • Si falta config_emisor o control_corrida → corre el SQL 13.
--   • La columna "seguridad" avisa si alguna tabla quedó sin RLS.
-- ============================================================
