-- ============================================================
--  AGROGESTIÓN — Revisar los PINs de dirección en la nube
--  Agroselectos P&A
--
--  Este SQL NO modifica nada y NO muestra los PINs (van como hash,
--  ilegibles). Solo confirma si la configuración de seguridad
--  llegó a la nube y qué roles tienen PIN puesto.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- ¿Cuántos registros de seguridad hay? (debería ser 1)
select count(*) as registros_de_seguridad from config_seguridad;

-- ¿Qué hay dentro? Mostramos solo QUÉ campos existen, no su valor.
-- Si un rol tiene su PIN puesto, aparecerá "sí (hash guardado)".
select
  id,
  case when datos ? 'pin_admin'    then 'sí (hash guardado)' else 'no configurado' end as pin_direccion_admin,
  case when datos ? 'pin_dueno'    then 'sí (hash guardado)' else 'no configurado' end as pin_dueno,
  case when datos ? 'pin_finanzas' then 'sí (hash guardado)' else 'no configurado' end as pin_finanzas,
  case when datos ? 'resetToken'   then 'sí'                 else 'no'             end as tiene_orden_reseteo,
  actualizado as ultima_actualizacion
from config_seguridad;

-- ============================================================
--  CÓMO LEER EL RESULTADO:
--
--  • Si "registros_de_seguridad" = 0:
--      Los PINs NO han llegado a la nube. Se quedaron en el
--      teléfono donde los configuraste. (Ver nota abajo.)
--
--  • Si = 1 y los pin_* dicen "sí (hash guardado)":
--      Los PINs SÍ están en la nube, correctamente como hash.
--      Si aun así otro dispositivo no los pide, el problema es
--      que ese otro dispositivo no ha bajado los datos nuevos:
--      ábrelo, espera a que sincronice, o usa el botón de
--      "Recargar desde la nube" en Respaldo.
--
--  • La fecha "ultima_actualizacion" te dice cuándo se guardó
--    por última vez. Si es vieja, el cambio reciente no subió.
-- ============================================================
