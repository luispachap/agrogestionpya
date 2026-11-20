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

## Decisiones de Luis del 20 de noviembre (ya aplicadas)

| Decisión | Cómo quedó | Prueba |
|---|---|---|
| Maquinaria: cuota por hora y costo real nunca se suman | La cuota es el costo aplicado; a los costos sólo entra además la diferencia contra el real, con su tratamiento (`maq_diferencia`). El cierre enseña aplicado, real y diferencia por máquina | `vehiculos.test.js`, `escenario.test.js`, `decisiones` |
| Insumos: costo al consumirse | Resultados cuenta consumos, uso general, mermas y ajustes de valuación; las compras son inventario; el flujo las cuenta al pagarse | `resultado.test.js`, `escenario.test.js` |
| Bonificaciones dentro de Pagos al personal | Pestaña «Bonos»: otorgar (costo) y pagar (no costo); la pantalla vieja ya no captura y sus registros se conservan | `bonos.test.js`, `decisiones` |
| Compras del personal para el almacén | Aprobar ya no mete al almacén; se recibe (con o sin precio) y se valúa; sin precio queda pendiente de valoración | `movimientos.test.js`, `compras.test.js`, `decisiones` |

## Riesgos que quedan a la vista

- **Una compra de almacén que nunca se registra como entrada** se queda en «inventario» o «por valuar» para siempre y nunca llega a costo. La app lo enseña (pendientes de recibir o de valuar), pero alguien tiene que cerrarlo.
- **Una máquina con cuota y sin ningún costo real capturado** no se concilia: se queda con lo aplicado y lo dice. Si nadie captura diésel ni taller, la cuota nunca se corrige.
- **La depreciación** sale de `depreciacion_mes` en la ficha de la máquina. Hoy ninguna la tiene: mientras no se capture, el costo real no la incluye.
- **Bonos que integran**: la app marca por defecto que el de productividad cuenta para el salario integrado y el extraordinario no. Es un criterio, no un dictamen.
- **Ajustes de valuación de un consumo hecho desde una actividad** van a la parcela de la actividad sólo si el movimiento la traía; los de vehículo salen como gasto general de almacén, no dentro del costo del vehículo.
- Lo anotado en la pantalla vieja de bonificaciones no entra a nada. Si alguno fue un bono real, hay que otorgarlo en la pestaña nueva.

## Lo que se encontró y NO se cambió (pide decisión o un caso real)

- (Maquinaria propia, compras del personal, bonificaciones e insumos en la utilidad: ya decididos y aplicados; ver arriba.)
- **Qué hacer con la diferencia de maquinaria**: hoy queda pendiente de distribuir. Falta escoger: repartirla con la misma base de la cuota, o mandarla a gasto general.
- **Vacaciones disfrutadas en la conciliación**: se restan por el total, no por fecha.
- Un gasto con parcela Y vehículo a la vez se contaría dos veces; la pantalla no lo permite, pero una importación sí podría.

## Lo que sigue sin validarse en el rancho

Todo. Ver el recorrido de validación para Migue.
