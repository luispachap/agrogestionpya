# AgroGestión 1.0 — evaluación del sistema completo

Este documento ya no lleva cifras propias, para que no puedan contradecirse con las de otro lado.

**La única fuente del estado es `docs/ESTADO.json`.** De ahí se generan, siempre iguales entre sí:

- `docs/AUDITORIA-FUNCIONAL.md`: veredicto, pruebas ejecutadas, qué está publicado, defectos, los 67 módulos uno por
  uno, lo que no se pudo ejecutar, lo que falta para decir «listo», pendientes y riesgos.
- `docs/tablero-de-cierre.html`: lo mismo, para verlo (es lo que se publica como tablero de cierre).

Para cambiar algo: se edita `docs/ESTADO.json` y se corre `node herramientas/estado.mjs`. Una prueba
(`src/estado.test.js`) falla si el documento o el tablero no coinciden con el archivo, si un módulo dice aprobado sin
un recorrido de auditoría que lo respalde, o si un defecto corregido no dice si está publicado.

## Cómo comprobarlo uno mismo

| Qué | Con qué |
|---|---|
| Reglas y cálculos | `npm test` |
| La base, armada desde cero y atacada por perfil | `npm run test:base` |
| Respaldo y restauración, de punta a punta en local | `sh pruebas/respaldo_local/ensayo.sh` |
| Todo junto: lo anterior, compilación y todos los recorridos en navegador | `sh pruebas/todo.sh` |
| Producción cerrada sin sesión | `pruebas/real_sin_sesion.py` |
| El sitio publicado, en Android y iPhone imitados | `pruebas/real_sitio.py` |
| Producción igual a la base probada | `node pruebas/base/paridad.mjs --consulta` |

Los resultados de la última corrida están en `docs/AUDITORIA-FUNCIONAL.md`, sección «Pruebas ejecutadas».
