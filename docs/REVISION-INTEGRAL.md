# Revisión integral — 19 y 20 de noviembre de 2026

Recorrido de punta a punta entre personal, actividades, cuadrillas, vehículos, almacén, costos, pagos y reportes, buscando que una misma operación diga lo mismo en todas las pantallas. Todo con datos de prueba; nada de esto se ha visto con datos del rancho.

## Lo que se encontró y se corrigió (cada uno con su prueba)

| # | Qué pasaba | Qué se hizo | Prueba |
|---|---|---|---|
| 1 | La «utilidad neta» no era la misma en el inicio y en Finanzas: una usaba la mano de obra depurada y la otra la tecleada | Una sola cuenta (`src/resultado.js`) para las dos | `cruces` caso 1 |
| 2 | Ninguna utilidad contaba lo que se le paga a la gente fuera de una parcela (permisos, días de encargados, prestaciones, bajas, operadores) | Entran como renglones propios | `resultado.test.js` |
| 3 | El «flujo de efectivo» contaba la mano de obra el día que se trabajó, no el que se pagó; no veía pagos, préstamos entregados ni abonos | El flujo cuenta el dinero el día que se mueve | `resultado.test.js`, `cruces` |
| 4 | El cierre de mes no veía NADA sin parcela: el trabajo de bodega y las compras del personal no estaban en el total del rancho | Entran: bodega de un cultivo como directo; lo general y las compras como gasto general | `cierreMes.test.js`, `cruces` |
| 5 | El reporte por cultivo repartía solo los gastos generales de bodega entre los cultivos (contra lo decidido) | Ya no los reparte; los dice aparte | `cruces` |
| 6 | Un ajuste negativo clasificado «no es de producción» desaparecía de los costos | Ya no se pierde | `conciliacion.test.js` |
| 7 | Quien fue marcada presente en el pase de lista salía en Pagos como «no vino» | Sale como «vino, falta decir en qué trabajó» | `pagos.test.js`, `cruces` |
| 8 | La pantalla de socios llamaba «utilidad del rancho» a otra cifra | Se llama «ingresos menos gastos capturados» | — |
| 9 | La pantalla vieja de bonificaciones decía que «se suma al costo de mano de obra» (no era cierto) e invitaba a anotar ahí el aguinaldo | Se corrigió el texto y manda a Prestaciones | — |
| 10 | Capturar como gasto de «mano de obra» el pago a una cuadrilla lo contaba dos veces sin aviso | Aviso al escoger esa categoría | `cruces` |
| 11 | El corredor de pruebas dejaba pasar una prueba que tronaba a medias | Corregido | — |

## Lo que se encontró y NO se cambió (pide decisión o un caso real)

- **Maquinaria propia**: la actividad carga el costo por hora de la máquina y, aparte, sus gastos reales (diésel, taller) se capturan como gastos. En la utilidad cuentan los dos. Falta decidir cuál manda.
- **Compras que captura el personal con artículos para el almacén**: los artículos entran sin precio (la compra sólo trae el total). El dinero sí cuenta; el costo por parcela de ese insumo no.
- **Bonificaciones (pantalla vieja)**: lo anotado ahí no entra a costos, pagos ni flujo, y se puede borrar. Falta decidir si se retira o se convierte en un pago con evento.
- **Insumos en la utilidad**: cuentan cuando se compran, no cuando se usan (el cierre de mes sí los cuenta al usarse). Son dos criterios; hay que decir cuál se quiere ver en Resultados.
- **Vacaciones disfrutadas en la conciliación**: se restan por el total, no por fecha.
- Un gasto con parcela Y vehículo a la vez se contaría dos veces; la pantalla no lo permite, pero una importación sí podría.

## Lo que sigue sin validarse en el rancho

Todo. Ver el recorrido de validación para Migue.
