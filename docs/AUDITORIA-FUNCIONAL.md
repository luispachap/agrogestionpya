# Auditoría funcional de AgroGestión 1.0 — los 67 módulos

> **Generado desde `docs/ESTADO.json` con `node herramientas/estado.mjs`. No se edita a mano:** se cambia el archivo de estado y se vuelve a generar. Es la única fuente de las cifras, los módulos, los pendientes y lo publicado; el tablero de cierre sale de aquí mismo.

Corte: domingo 22 de noviembre de 2026. **16 aprobados · 16 recorridos en parte · 35 sin verificar.**

**Veredicto: NO LISTO** como sistema completo · listo para prueba de campo en la operación diaria. Lo que se ha probado funciona, y lo que falló al probarlo está corregido. Se prefiere una entrega completa y comprobada a forzar una fecha con errores de dinero (decisión de Luis, 22 nov).

## Qué significa cada estado

- **APROBADO**: se usó como una persona, desde un teléfono imitado, contra una nube de imitación que guarda y devuelve con cuentas: capturar datos inventados pero realistas, comprobar el resultado en pantalla **y** en lo guardado, recargar y volver, corregir y cancelar, otros perfiles intentando lo que no les toca, otro teléfono, y su llegada a los módulos que dependen de él.
- **PARCIAL**: lo recorrido pasa, pero faltan partes del módulo, que se nombran. No es aprobado.
- **NO VERIFICADO**: no se ha recorrido con este criterio. La columna «Prueba» dice qué recorrido ya lo tocaba *antes*; es evidencia previa, no la auditoría. «Sólo que abre» no cuenta. Que sus pruebas unitarias pasen tampoco.

**Lo que ningún estado incluye:** teléfonos de verdad, señal del rancho, cámara, impresora, correos reales ni producción. Eso es la prueba de campo, aparte.

## Pruebas ejecutadas sobre la versión vigente

| Qué | Con qué | Resultado |
|---|---|---|
| Reglas y cálculos | `npm test` | 1,287 de 1,287 |
| La base, armada desde cero y atacada por perfil | `npm run test:base` | 163 de 163 |
| Respaldo y restauración, de punta a punta en local | `sh pruebas/respaldo_local/ensayo.sh` | 26 de 26 |
| Todo junto: lo anterior, compilación y 40 recorridos en navegador | `sh pruebas/todo.sh` | Todo pasa (sobre la versión publicada, `14bf671`) |
| Producción cerrada sin sesión | `pruebas/real_sin_sesion.py` | 6 de 6 |
| El sitio publicado, en Android y iPhone imitados | `pruebas/real_sitio.py` | 18 de 18 |
| Lo publicado es exactamente lo probado, byte por byte | `pruebas/real_identico.py` | 18 de 18 archivos idénticos a `14bf671` |
| Producción igual a la base probada | `node pruebas/base/paridad.mjs --consulta` | 7 huellas iguales (última hoja instalada: 56) |
| La base de producción rechaza pisar un identificador ocupado | `prueba directa que se deshace sola` | Otra marca: rechazado · sin marca: rechazado · misma marca: corrige |
| Asistencia con dos teléfonos, semana cerrada y pago hecho | `pruebas/auditoria_ausencias_navegador.py` | 36 de 36 |
| Campo: rancho vacío, parcelas, cultivos, calendario y cosechas con dos teléfonos (posterior a la publicación) | `pruebas/auditoria_campo_navegador.py` | 63 de 63 |

## Qué está publicado y qué no

| Qué | Estado | Detalle |
|---|---|---|
| La app en app.agroselectos.com | **Publicado** | Versión `14bf671`, la misma sobre la que corrió la batería completa; comparada archivo por archivo contra lo que sirve el sitio. |
| Campo (alta de cultivos, parcelas que no se eliminan con registros, cosechas que no se pisan ni se borran) y dos correcciones de identidad: hechos de nombre propio sin marca y estibas recién cerradas que no subían | **Sin publicar** | Corregido y probado; se publica al pasar la batería completa (corrección ordinaria). |
| Cobros parciales de un embarque desde dos teléfonos (no se pisan; cada cobro con autor, hora y su venta ligada) | **Publicado** | 22 de noviembre, autorizado por Luis. |
| Un identificador ocupado no se pisa: lo rechaza la base y el teléfono reubica su registro | **Instalado en la base** | Hoja 56 en la base y publicado en la app, 22 de noviembre. |
| Asistencia: dos decisiones distintas para el mismo día quedan a la vista; historial de decisiones; una semana cerrada pide reabrirse para cambiarlas | **Publicado** | 22 de noviembre, autorizado por Luis. |
| Las correcciones del almacén: la compra de una solicitud entra como movimiento; la misma compra no sale dos veces; aplicar no es dinero que sale; mermas al costo de su día; lo recibido sin precio; alta de artículos | **Publicado** | 22 de noviembre, autorizado por Luis. |
| Integridad histórica de costos e identidad única: costo guardado al capturar, identificadores que no se repiten entre teléfonos, quién capturó cada registro, aviso de capturas repetidas | **Publicado** | 22 de noviembre, en la misma publicación. |
| Bodega: corrida que no se pierde al salir, ventas sin dinero fuera del flujo, ajuste de ajo terminado con motivo | **Publicado** | 22 de noviembre. |
| Caja chica (clases de salida), abonos a créditos (cancelar en vez de borrar, flujo, dos teléfonos) | **Publicado** | 22 de noviembre. |
| Banco, Socios y ¿Alcanza? fuera del perfil de encargado | **Instalado en la base** | Hoja 54 en la base y publicado en la app. |
| Banco y Socios: Finanzas sólo con permiso otorgado, y sólo consulta | **Instalado en la base** | Hoja 55 en la base; el permiso ya se puede otorgar desde la app. No se le otorgó a nadie. |
| Restaurar conserva quién autorizó y cuándo; nadie puede inventar una autorización | **Instalado en la base** | Hoja 53 en la base y publicado. |
| Respaldo automático de cada noche | **Sin estrenar** | Ensayado en local. Falta el repositorio privado y sus tres secretos (lo hace Luis). |
| Permiso para configurar la organización | **Sin otorgar** | Lo otorga el administrador a su propia cuenta. |

## Defectos encontrados al usar los módulos (39: 35 corregidos, 8 de ellos sin publicar; 4 abiertos)

| # | Módulo | Qué pasaba | Nivel | Estado |
|---|---|---|---|---|
| 1 | Caja chica | Un gasto de caja sin parcela no llegaba a Resultados ni al flujo | P1 | Corregido y publicado |
| 2 | Caja chica | Toda salida era gasto; ahora dice qué fue (siete clases, política de Luis) | P1 | Corregido y publicado |
| 3 | Caja chica | Se podía cambiar el importe o borrar el movimiento sin rastro | P1 | Corregido y publicado |
| 4 | Caja chica | Cancelar un movimiento dejaba vivo su gasto ligado | P1 | Corregido y publicado |
| 5 | Finanzas | Un gasto de una parcela salía entre los gastos generales | P2 | Corregido y publicado |
| 6 | Proveedores, Deudas | Un abono a un crédito se podía BORRAR con un toque, sin motivo | P1 | Corregido y publicado |
| 7 | Deudas | Los abonos capturados en Deudas no salían en el flujo de efectivo | P1 | Corregido y publicado |
| 8 | Proveedores, Deudas | Dos teléfonos abonando al mismo crédito, uno sin señal: se perdía un abono | P1 | Corregido y publicado |
| 9 | Banco, Socios | El encargado podía ver y capturar estados de cuenta y la cuenta entre socios | P1 | Corregido y publicado |
| 10 | Finanzas | Una venta cobrada en especie o a cuenta de una deuda se contaba como dinero que entró | P1 | Corregido y publicado |
| 11 | Corrida de ajo | Salir de la pantalla o recargar a media corrida borraba las cajas contadas, las tarimas, los cortes y los conteos, y partía el reporte del día | P1 | Corregido y publicado |
| 12 | Ajo terminado | El inventario de ajo terminado se podía ajustar sin decir el motivo | P1 | Corregido y publicado |
| 13 | Respaldo | Una copia restaurada dejaba abiertas a toda cuenta las funciones de la base (incluida la que firma autorizaciones) | P0 | Corregido y publicado: corregido antes de estrenarse; nunca estuvo en producción |
| 14 | Deudas / Proveedores | El proveedor se guarda distinto en cada pantalla (texto / ficha) | P2 | Abierto |
| 15 | Caja chica / Almacén | Una compra de almacén pagada de caja (o capturada en Finanzas) y además metida con costo en Inventario salía dos veces del flujo. Reproducido: $10,000 por una compra de $5,000 | P1 | Corregido y publicado: Inventario → Entradas propone el gasto que coincide y una persona dice «es la misma compra»; Finanzas avisa cuántas hay |
| 16 | Corrida de ajo | Los cortes, conteos y cajas de plástico de la corrida se pueden borrar sin motivo; y la configuración se guarda con un nombre fijo, no por espacio | P2 | Abierto |
| 17 | Consignaciones | Los cobros de un embarque viven dentro del embarque: dos teléfonos cobrando parte del mismo, uno sin señal, dejaban al embarque con un solo cobro ($9,000 en vez de $15,000; las dos ventas sí quedaban) | P1 | Corregido y publicado: reproducido y corregido: los cobros se unen por identificador, igual que los abonos de un crédito |
| 18 | Solicitudes de compra | Al registrar la compra de un artículo que ya existía, la existencia NO subía (5 + 4 seguían siendo 5) y el costo de lo ya consumido cambiaba hacia atrás (el resultado pasó de $2,500 a $7,294 sin que nadie gastara) | P0 | Corregido y publicado: la mercancía entra como movimiento del almacén, con identificador fijo por solicitud (dos teléfonos no la meten doble) |
| 19 | Conteo y mermas | Una merma o un faltante se valuaba al costo de HOY: una compra posterior más cara le cambiaba el importe a una merma vieja, y con él el resultado de un mes ya visto | P1 | Corregido y publicado: vale lo que costaba el día que pasó, y ese costo queda escrito en el propio registro al capturarlo |
| 20 | Aplicaciones / Finanzas | Aplicar un producto que ya estaba en el almacén contaba otra vez como dinero que salió (una vez al comprarlo y otra al aplicarlo) | P1 | Corregido y publicado |
| 21 | Inventario | Lo recibido sin precio se valuaba al promedio de lo demás y además salía como «por valuar» (se veía dos veces); y el valor traía centavos de más o de menos por redondear el promedio | P2 | Corregido y publicado |
| 22 | Inventario, Registrar compra | Se podía dar de alta un artículo sin nombre, o dos con el mismo nombre (parte la existencia en dos) | P2 | Corregido y publicado |
| 23 | Pagos al personal | Dos avisos enseñaban importes sin formato de dinero («faltan 350») | P3 | Corregido y publicado |
| 24 | Todos los registros | Casi todos los identificadores se armaban sólo con la hora del teléfono: dos aparatos capturando en la misma milésima (o uno guardando dos renglones seguidos) podían hacer el mismo, y en la nube el segundo pisaba al primero sin avisar | P1 | Corregido y publicado: todo identificador nuevo lleva una parte al azar; el mismo identificador nunca deja dos renglones; y la base rechaza pisar uno ocupado (defecto 27) |
| 25 | Finanzas | Un gasto o un ingreso tecleado en Finanzas se guardaba sin decir quién lo capturó | P1 | Corregido y publicado: todo registro de dinero o de almacén queda con su autor |
| 26 | Finanzas, Inventario, Aplicaciones | Si dos personas capturaban el mismo gasto, la misma entrada o la misma aplicación, cada una en su teléfono, contaba dos veces y nada lo señalaba | P2 | Corregido y publicado: Finanzas → Resultados avisa «capturas que parecen repetidas», con quién capturó cada una; una persona cancela la que sobra o dice «son distintos». La app no quita nada sola |
| 27 | Todos los registros (base) | La unicidad de los identificadores dependía sólo del azar del teléfono: si dos registros DISTINTOS llegaban con el mismo identificador, la base dejaba que el segundo quedara encima del primero (y en los eventos, descartaba el segundo sin decir nada) | P1 | Corregido y publicado: hoja 56: cada registro capturado lleva una marca de nacimiento y la base rechaza cualquier otro registro en un identificador ocupado, en todas las tablas; el teléfono reubica solo su registro con otro identificador, así que ninguno se pierde. Probado con un choque forzado y atacando la base; comprobado también en producción con una prueba que se deshace sola |
| 28 | Consignaciones | Un cobro de un embarque no decía quién lo capturó ni a qué hora, y no quedaba ligado a la venta que generó | P2 | Corregido y publicado: cada cobro lleva su identificador, importe, fecha, autor, hora de captura y la liga con su venta (y con su abono, si fue a cuenta de una deuda); la venta apunta de regreso al cobro |
| 29 | Pagos al personal (Asistencia) | Si dos administradores decidían distinto cómo se paga la misma salida antes de tiempo, cada uno en su teléfono, se aplicaba la última sin avisarle a nadie (uno creía medio día y el otro completo) | P1 | Corregido y publicado: Asistencia enseña las dos decisiones con quién, cuándo y por qué, dice cuál se está aplicando (la misma en todos los teléfonos) y deja cancelar, con motivo, la que no vale. Siempre vale una sola: nunca dos pagos ni dos cargos. Hay un historial de decisiones donde las canceladas se quedan con quién las canceló y por qué. Con la semana cerrada no se decide ni se cancela sin reabrirla; lo que llegue de otro teléfono sin señal sale como diferencia contra el cierre, diciendo quién y por qué |
| 30 | Cultivos y variedades, Calendario | Un cultivo sólo se podía dar de alta subiendo una hoja de Excel: en un rancho que arranca vacío (como producción) nadie podía crear «Ajo», y sin cultivo no hay calendario, temporadas ni resultado por cultivo | P1 | Corregido **sin publicar**: «Nuevo cultivo» en la misma pantalla (administrador o agrónomo): nombre, días a la cosecha y unidad; no se repite, y el mismo cultivo desde dos teléfonos es uno solo |
| 31 | Parcelas | «Crear parcela» y «Crear rancho» no hacían nada si faltaba un dato y no decían cuál; una parcela creada justo después de su rancho nacía SIN rancho; se podían repetir nombres; y se podía eliminar una parcela con siembras, cosechas o gastos (lo registrado se quedaba apuntando a nada) | P1 | Corregido **sin publicar**: dice qué falta, la parcela siempre nace en su rancho, no se repite, y lo que tiene registros no se elimina (dice qué tiene) |
| 32 | Cosechas | Lo cosechado se anota dentro de un registro por parcela: dos personas anotando desde dos teléfonos, una sin señal, y el segundo que subía dejaba fuera lo del primero; y si los dos anotaban la PRIMERA cosecha de la parcela quedaban dos registros de cosecha y la pantalla sólo leía uno | P1 | Corregido **sin publicar**: los cortes se unen por identificador y la cosecha de cada parcela tiene identidad propia: probado con dos teléfonos sin señal en las dos situaciones |
| 33 | Todos los registros (identidad) | Un hecho «de nombre propio» que lleva dentro el identificador de otra cosa (el gasto de una solicitud comprada, la entrada de una compra recibida, el gasto de una salida de caja) recibía marca de nacimiento como si fuera un registro cualquiera: capturado en dos teléfonos sin señal, la base rechazaba el segundo y la app lo reubicaba como otro — o sea, se duplicaba. El recorrido no lo veía porque usaba identificadores cortos, de mentira | P1 | Corregido **sin publicar**: sólo lleva marca el identificador hecho al momento; el recorrido de identidad ahora usa identificadores como los reales. En producción desde la hoja 56 (unas horas, con la base vacía) |
| 34 | Estibas, Corrida de ajo | Al cerrar una estiba y ponerle su peso en el mismo instante, la corrección subía sin su marca de nacimiento y la base la rechazaba: la estiba quedaba «sin subir» para siempre (los demás teléfonos no veían su peso ni su calibre) | P1 | Corregido **sin publicar**: lo recién creado conserva su marca aunque se corrija en el mismo instante; todos los recorridos de auditoría ahora fallan si la base rechaza algo. En producción desde la hoja 56 (unas horas, con la base vacía) |
| 35 | Cosechas | Un registro de cosecha se borraba con un toque, sin motivo ni rastro | P1 | Corregido **sin publicar**: se cancela con motivo, queda a la vista tachado con quién y por qué, deja de contar y no revive al sincronizar |
| 36 | Calendario | La fecha de cosecha real aceptaba cualquier texto (o una fecha anterior a la siembra), y de esa fecha salen los costos de la temporada | P2 | Corregido **sin publicar** |
| 37 | Comparar variedades | El rendimiento de una variedad se enseñaba sin los ajustes de cosecha (1,450 kg) mientras el rendimiento por hectárea sí los contaba (1,400) | P3 | Corregido **sin publicar** |
| 38 | Calendario, Estado de parcelas | Las etapas de un cultivo (emergencia, bulbificación…) sólo entran por la hoja de Excel: un cultivo dado de alta en la app no tiene etapas y su «avance por fase» sale vacío | P2 | Abierto |
| 39 | Cosechas | La cosecha se lleva una por parcela para siempre: el «costo por kilo» de la pantalla de Cosechas junta todas las temporadas de esa parcela (el resultado por temporada, en Finanzas y en Comparar variedades, sí separa por fechas) | P2 | Abierto |

## Lo que no se pudo ejecutar y por qué

- Un choque real de identificadores entre dos teléfonos no se puede provocar a voluntad: en el recorrido se FUERZA (se congela la hora y se le quita el azar al identificador, no a la marca de nacimiento) y se ataca la base directo.
- Que la base le niegue algo a un perfil no se ve en la nube de imitación (devuelve todo): se prueba atacando la base aislada (`pruebas/base/auditoria.test.mjs`, 12 pruebas).
- Que un trabajador capture su compra entrando con su PIN en un teléfono ligado: la compra se sembró en la nube de imitación como si él la hubiera mandado; aprobar, recibir y valuar sí se hicieron en pantalla.
- «Registrar actividad» (captura tecleada de mano de obra) con cuentas: la pantalla es de varios pasos y no se alcanzó; la cubre `ejecutores` en local.
- Imprimir etiquetas y remisiones: no hay impresora; se comprobó que la pantalla las genera.
- Todo lo que pide un teléfono de verdad.

## Inventario

| # | Módulo | Estado | Prueba | Qué se probó | Qué falta |
|---|---|---|---|---|---|
| 1 | Operación | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 2 | El día | NO VERIFICADO | antes: plan, jornada, reasignacion, entrega | — | Falta la auditoría completa |
| 3 | ¿Alcanza? | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 4 | Resumen | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 5 | ¿Cómo vamos? | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 6 | Mensajes | NO VERIFICADO | antes: mensajes, mensajes_movil, dicho | — | Falta la auditoría completa |
| 7 | Registrar actividad | NO VERIFICADO | antes: ejecutores | — | Falta la auditoría completa |
| 8 | Registro de varios | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 9 | Aplicaciones | **PARCIAL** | auditoria_agronomo 23 · ejecutores | Aplicación con un producto del inventario: descuenta lo aplicado, carga su costo a la parcela una vez, no vuelve a salir del flujo, avisa si no se dice quién aplicó, recarga, otro aparato; una compra posterior más cara no le cambia el costo | Con aplicadores y quién la indicó (visto en local), reentrada y carencia, reporte de la aplicación |
| 10 | Indicaciones | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 11 | Tareas | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 12 | Reportar | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 13 | Mapa del rancho | NO VERIFICADO | antes: mapa, satelite | — | Falta la auditoría completa |
| 14 | Parcelas | **APROBADO** | auditoria_campo 63 | Rancho que arranca vacío: alta de rancho y de parcelas (dice qué falta, no se repiten, la parcela nace en su rancho), corregir hectáreas, ubicación, renglón de su ciclo y foto (la foto no viaja dentro del registro), lo que tiene siembra o cosecha no se elimina y lo vacío sí, un rancho con parcelas no se elimina; recarga, otro teléfono, aparato nuevo; el agrónomo no la tiene | Escoger la ubicación en el mapa satelital (pide mapa real) |
| 15 | Estado de parcelas | **PARCIAL** | auditoria_campo 63 | Enseña cada parcela con su temporada, en qué día del ciclo va, superficie y fecha de siembra; la que no tiene siembra lo dice; el agrónomo la ve | Avance por fase y semáforos (dependen de las etapas del cultivo: defecto 38) |
| 16 | Calendario | **PARCIAL** | auditoria_campo 63 | Asignar un cultivo a una parcela en un mes: nombra la temporada, estima la cosecha, guarda variedad, superficie y de dónde salió la semilla; se pinta en el calendario; detalle de la siembra; darla por cosechada (fecha mal escrita o anterior a la siembra no entra); el encargado no lo tiene | Avance por fase (los cultivos dados de alta en la app no tienen etapas: defecto 38), editar y eliminar una siembra, semilla propia ligada a una cosecha |
| 17 | Cosechas | **APROBADO** | auditoria_campo 63 | Anotar lo cosechado (pide cantidad y quién), total y rendimiento por hectárea, ajuste con motivo y autor, cancelar un registro con motivo (no revive), dos teléfonos sin señal en la misma parcela y en la primera cosecha de otra (nada se pisa ni se duplica), un gasto de Finanzas llega como costo por kilo, apartar semilla (entra al almacén a su costo, no más de lo disponible), mandar a bodega con transporte; encargado, recarga, aparato nuevo | El costo por kilo junta todas las temporadas de la parcela (defecto 39, abierto) |
| 18 | Rendimiento por parcela | **APROBADO** | auditoria_bodega 48 | Se llena solo con la corrida: parcela de origen, cajas, kilos, kilos por hectárea y cajas por calibre | Varias parcelas y una corrida que mezcla parcelas (el reparto está probado en cálculo) |
| 19 | Variedades | **APROBADO** | auditoria_campo 63 | Alta de cultivo desde la app (sin duración no entra, no se repite), variedades (repetida no entra), una variedad sembrada no se quita y una sin usar sí; el agrónomo da de alta otro cultivo y sube; aparato nuevo | — |
| 20 | Comparar variedades | **APROBADO** | auditoria_campo 63 | Dos variedades en dos parcelas, cada una con su rendimiento (con ajustes y sin lo cancelado), su costo directo y su costo por hectárea | — |
| 21 | Hoja de Fito | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 22 | Dron | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 23 | Ganado | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 24 | Corrida de ajo | **PARCIAL** | auditoria_bodega 48 · corridaViva.test | Corrida en vivo completa: tarima de limpio a la mesa, conteo por calibre, cierre de estiba con peso y folio, conteo físico, salir y volver, recargar, terminar el día con ajuste de la tarima, un solo reporte | Pestañas Calidad y Categorías aparte, modo revoltura, cambio de tarima a media corrida, tarima limpiada hoy, cortes de 15 minutos |
| 25 | Estibas | **PARCIAL** | auditoria_bodega 48 | Alta masiva de barbecho desde la parcela, limpio que consume barbecho, saldos, rastreo hasta la parcela, etiquetas, otro teléfono; la estiba recién cerrada sube con su peso (la base no la rechaza) | Re-limpia, alta individual, estiba sin origen, cierre manual de una estiba, imprimir |
| 26 | Ajo terminado | **APROBADO** | auditoria_bodega 48 | Entra solo al cerrar estiba; entrada manual; ajuste con motivo obligatorio e historial; baja al embarcar; recarga; nube | — |
| 27 | Salida de camión | **PARCIAL** | auditoria_bodega 48 | Embarque a cliente: tarima pesada, folio, formato, baja del terminado, queda pendiente de cobro, no es venta todavía | Salida a nuestra bodega, varias tarimas y calibres, estiba de origen, cargar más de lo que hay, remisión impresa |
| 28 | Consignaciones | **PARCIAL** | auditoria_bodega 48 · auditoria_cobros 15 | Pendiente de cobro, cobrar en dinero, nace una sola venta, llega a resultados y flujo, el encargado no entra; pagos parciales desde dos teléfonos sin señal (los dos cobros quedan, cada uno con identidad, importe, fecha, autor y su venta ligada); doble toque registra un solo cobro; el último pago lo deja cobrado sin perder los anteriores | Pago a cuenta de una deuda en pantalla (la regla del flujo sí está probada en cálculo) |
| 29 | Comercialización | **PARCIAL** | auditoria_bodega 48 | Enseña la venta con su cliente y el precio por kilo | Sólo se comprobó una venta; faltan varios clientes y periodos |
| 30 | Mano de obra | NO VERIFICADO | antes: cuadrillas | — | Falta la auditoría completa |
| 31 | Finanzas | **APROBADO** | auditoria_dinero 37 · auditoria_identidad 27 | Gasto general y de parcela, venta, cancelar con motivo, bitácora, flujo y resultados, recarga, otro teléfono, tres perfiles; doble toque, dos teléfonos sin señal con el mismo gasto, aviso de repetidos, quién capturó; un choque forzado de identificadores: la base rechaza el segundo, el teléfono lo dice y lo reubica solo, ninguno se pierde | — |
| 32 | Movimientos | **APROBADO** | auditoria_dinero 37 | Totales del periodo iguales a Finanzas; lo cancelado no cuenta y sigue visible | — |
| 33 | Caja chica | **APROBADO** | auditoria_dinero 37 · auditoria_pagos 40 · caja.test | Ligar una salida a su préstamo o a su pago (toma el importe, no cuenta doble, una segunda no encuentra a qué ligarse y queda por ligar). Fondo, las siete clases de salida, por clasificar y clasificar después, cancelar con su gasto ligado, sólo se corrige el concepto, flujo sin duplicar, saldo al centavo | Ligar una salida a un préstamo o pago real: probado en cálculo, sin recorrido en navegador |
| 34 | Papeles | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 35 | Importar documentos | NO VERIFICADO | antes: importar, ia, rayas | — | Falta la auditoría completa |
| 36 | Banco | NO VERIFICADO | antes: sólo que abre; permisos por perfil atacados en la base | — | Falta la auditoría completa |
| 37 | Socios | NO VERIFICADO | antes: sólo que abre; permisos por perfil atacados en la base | — | Falta la auditoría completa |
| 38 | Deudas | **APROBADO** | auditoria_proveedores 27 · base 4 | Mismo crédito y saldo que Proveedores; abonar; el abono sale en el flujo; cancelar abono; el encargado no entra | El proveedor se guarda distinto que en Proveedores (P2 abierto) |
| 39 | Semana | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 40 | Reportes | NO VERIFICADO | antes: mes, cruces | — | Falta la auditoría completa |
| 41 | Temporadas | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 42 | ContPAQi | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 43 | Inventario | **APROBADO** | auditoria_almacen 45 · movimientos.test · resultado.test · auditoria_identidad 27 | Alta (sin nombre o repetido no entra), entrada con costo como movimiento, valor a costo promedio, «es la misma compra» contra un gasto de caja, recarga, otro aparato, Dirección, dos aparatos sin señal | Ficha técnica de agroquímicos y pestaña Cosechas |
| 44 | Entregas del almacén | **PARCIAL** | auditoria_entregas 13 · auditoria_almacen 45 · almacen 55 (local) | Entregar a una persona (exige quién recibe), entregar no es gastar, se ve quién lo trae, cerrar con lo usado y lo regresado, ahí nace el costo; los dos teléfonos cerrando la misma entrega sin señal: cuenta una vez y queda «por revisar»; uso directo | Con cuentas: herramientas prestadas, «sigue en uso», bajas con causa y traslados entre bodegas (recorridos en local) |
| 45 | Conteo y mermas | **APROBADO** | auditoria_almacen 45 · movimientos.test | Conteo a ciegas (no enseña el número antes), causa obligatoria si no cuadra, merma con causa, importe al costo del día, baja el valor del inventario y no es salida de dinero | Conteo en otra bodega |
| 46 | Solicitudes de compra | **APROBADO** | auditoria_almacen 45 · auditoria_identidad 27 | El encargado pide (no mueve nada), no se le ofrece comprar; el administrador registra la compra: sube la existencia, sale el dinero una vez, no cambia el resultado; ya comprada no se repite; la misma solicitud comprada desde dos teléfonos sin señal entra una vez | Cotizar por WhatsApp (abre otra aplicación) |
| 47 | Mis compras | **PARCIAL** | auditoria_almacen 45 · decisiones (local) | Aprobar no mete al almacén; recibir sin precio queda por valuar (ni cero ni al promedio); valuar; el flete es gasto; el flujo la cuenta una vez; la misma compra recibida desde dos teléfonos sin señal entra una vez | La captura del trabajador con su PIN y la foto del ticket |
| 48 | Registrar compra | **APROBADO** | auditoria_agronomo 23 | Insumo nuevo y existente, costo promedio, no es gasto, sale una vez del flujo, nombre repetido no entra, el encargado no la tiene | — |
| 49 | Proveedores | **APROBADO** | auditoria_proveedores 27 · base 4 | Directorio, crédito con vencimiento, abonos en dinero y en especie, cancelar abono (no borrar) con bitácora, recarga, dos teléfonos con uno sin señal, perfiles | — |
| 50 | Equipo | **PARCIAL** | entrega 68 · auditoria_pagos · auditoria_semana | Alta de trabajadores con sueldo y PIN (repetido o sin nombre no entra), llega a otro aparato | Editar, baja, maquinaria, encargados |
| 51 | Personal | **PARCIAL** | auditoria_pagos 40 | Préstamos de punta a punta: solicitud (no es deuda), autorización por menos, entrega (ahí nace la deuda, no más de lo autorizado), abonos, abono de más, dos aparatos sin señal, el encargado no autoriza ni abona | Pestañas Actividades y Cuadrillas |
| 52 | Equipos de trabajo | **PARCIAL** | entrega 68 · auditoria_pagos · auditoria_semana | Asignar a una parcela desde ahorita, cambio de parcela, el costo sigue a la asignación | Pago por tarea, vehículo, aclarar el tiempo sin asignar (recorridos en local) |
| 53 | Cuadrillas | **PARCIAL** | auditoria_semana 26 · eventuales (local) | El día de una cuadrilla por día: vacío no se guarda, costo a la parcela, una cuenta por responsable | Destajo, precio por el trabajo, flete y vehículo propio con cuentas |
| 54 | Checador | **PARCIAL** | entrega 68 · auditoria_pagos · auditoria_semana | Entrada y salida con PIN, jornada de 8 horas, lo que le toca al checar | Credencial con código (pide cámara), aparato ligado sin sesión |
| 55 | Jornadas | NO VERIFICADO | antes: entrega | — | Falta la auditoría completa |
| 56 | Credenciales | NO VERIFICADO | antes: checador | — | Falta la auditoría completa |
| 57 | Pase de lista | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 58 | Asistencia | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 59 | Pagos al personal | **PARCIAL** | auditoria_pagos 40 · auditoria_semana 26 · auditoria_ausencias 36 · auditoria_identidad 27 · entrega | Lo que corresponde, pago (sellado por la base), el préstamo no descuenta solo, cuenta de cuadrilla por responsable, bonos (otorgar es costo, pagar no), recibo con versión, cerrar, confirmar y reabrir la semana, Finanzas y encargado sin permiso, recarga, otro aparato; el mismo pago hecho en dos teléfonos sin señal queda a la vista como entregado de más; salida antes de tiempo (nada se descuenta solo; decisión con motivo, sellada por la base; dos teléfonos decidiendo distinto quedan a la vista y se cancela la que no vale); ausencias (quien no vino es una pregunta, no una falta; permiso con causa y quién autorizó; se paga y va como costo sin parcela, no a la parcela); historial de decisiones con las canceladas; ya pagado, cancelar una decisión no toca el pago y deja el pendiente a la vista; con la semana cerrada no se cambia sin reabrir, y lo que llega tarde de otro teléfono sale como diferencia con su autor y motivo; aparato recién entrado ve lo mismo | Con cuentas faltan: horas adicionales, prestaciones y bajas (recorridos en local: pagos 33, prestaciones 49, bajas 34) |
| 60 | Aprobar externos | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 61 | Mis días | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 62 | Arranque | NO VERIFICADO | antes: arranque, cuentas | — | Falta la auditoría completa |
| 63 | Organización | NO VERIFICADO | antes: organizacion | — | Falta la auditoría completa |
| 64 | Bitácora | **APROBADO** | auditoria_dinero · auditoria_proveedores · base | Enseña cada cancelación con quién, cuándo y motivo; en la base nadie la edita ni la borra | — |
| 65 | Seguridad | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 66 | Respaldo | NO VERIFICADO | antes: entrega, ensayo local del respaldo | — | Falta la auditoría completa |
| 67 | Subir catálogos | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |

## Orden en que sigue

1. Terminar lo que quedó en parte de la operación diaria, con cuentas: Entregas (a una persona y cierre), Cuadrillas (destajo, precio, flete), Equipos de trabajo (pago por tarea, vehículo), ausencias, prestaciones y bajas, El día y Jornadas, Registrar actividad, Mano de obra.
2. Terminar Bodega: calidad, categorías aparte, revoltura, re-limpia, salida a nuestra bodega, pago parcial y a cuenta de deuda; y los dos pendientes abiertos (16 y 17).
3. Dinero que falta: Papeles, Banco, Socios (con la consulta autorizada de Finanzas), Semana, Reportes, Temporadas, ContPAQi y los paneles (Operación, ¿Alcanza?, Resumen, ¿Cómo vamos?).
4. Agronomía y campo: Hoja de Fito, Variedades, Calendario, Cosechas, Rendimiento, Dron, Ganado, Mapa.
5. Captura anterior y control: Registro de varios, Tareas, Indicaciones, Pase de lista, Asistencia, Reportar, Seguridad, Subir catálogos, Credenciales, Arranque, Organización, Mensajes, Importar documentos.
6. Integrales: seguridad por perfil en todos, respaldo y recuperación reales.

## Qué falta para decir «listo»

1. **Respaldo real.** Luis crea el repositorio privado y sus tres secretos (docs/RESPALDO-AUTOMATICO.md). Después se corre el primer respaldo y se restaura en un proyecto aislado.
2. **Prueba de campo.** Una hora, en los teléfonos de verdad, con la guía docs/PRUEBA-DEL-DOMINGO.md.
3. **Terminar la auditoría.** Recorrer como persona cada módulo que falta, corregir lo que salga y volver a probar.
4. **Criterio de Miguel, Fito y Dirección.** Organización, jornada y especialidades esperan su validación; no es una decisión técnica.

## Lo que le toca a Luis

- Crear el repositorio privado de respaldos y sus tres secretos.
- Hacer la prueba de campo con la familia.
- Otorgarse el permiso para configurar la organización (Arranque → Cuentas), si la va a usar.
- Decidir a qué cuenta de Finanzas, si a alguna, se le otorga la consulta de Banco y Socios.

## Pendientes menores que pueden esperar

- «Nueva parcela» trae una lista fija de ubicaciones heredada. Hay que decidir si se queda.
- El reparto hablado entiende «deshierbar» como «limpiar la parcela».
- El insumo aplicado cuenta una sola vez, pero en Resultados sale bajo «Gastos capturados» y no bajo «Insumos consumidos».
- Mientras una subida falla, la pantalla dice «Sincronizando…» en vez de decir que está reintentando.
- El archivo principal pesa 2.7 MB: la primera carga con mala señal es lenta.
- En producción quedan los datos de la prueba de avisos (1 conversación, 3 mensajes). Hay que retirarlos.
- Eliminar una siembra del calendario avisa que sus costos quedan sin temporada, pero lo permite.
- Defecto 14 (Deudas / Proveedores): El proveedor se guarda distinto en cada pantalla (texto / ficha).
- Defecto 16 (Corrida de ajo): Los cortes, conteos y cajas de plástico de la corrida se pueden borrar sin motivo; y la configuración se guarda con un nombre fijo, no por espacio.
- Defecto 38 (Calendario, Estado de parcelas): Las etapas de un cultivo (emergencia, bulbificación…) sólo entran por la hoja de Excel: un cultivo dado de alta en la app no tiene etapas y su «avance por fase» sale vacío.
- Defecto 39 (Cosechas): La cosecha se lleva una por parcela para siempre: el «costo por kilo» de la pantalla de Cosechas junta todas las temporadas de esa parcela (el resultado por temporada, en Finanzas y en Comparar variedades, sí separa por fechas).

## Riesgos que quedan aunque todo pase

- Riesgo técnico por evaluar (Luis, 22 nov): que una semana cerrada pida reabrirse para cambiar sus decisiones lo cuida la app, no la base. Una decisión que llegue por fuera de la app (o de un teléfono que no sabía del cierre) sí entra; no pasa callada —sale como diferencia contra el cierre, con quién y por qué— pero la base no la rechaza.
- Sin copias automáticas todavía: hasta el ensayo real, la copia es el archivo que un administrador descarga a mano.
- Lo que un respaldo no recupera: las sesiones abiertas, los secretos y el despliegue de las funciones del servidor, la configuración del correo, las suscripciones de avisos y lo capturado después del último respaldo que ningún teléfono conserve.
- Casi cada módulo auditado ha destapado al menos un defecto: es razonable esperar más en los que faltan.
- El repositorio del código es público. No tiene llaves ni datos, pero la documentación nombra a la familia. Los respaldos irán en uno privado.
- El teléfono ligado guarda lo que ve la cuenta del encargado: por eso nunca se liga la de un administrador.
- El PIN no es identidad: lo que mueve dinero se hace con cuenta, y la base lo exige.
- La base gratuita se pausa si pasan varios días sin uso. Se reactiva sin perder nada.
- Producción está vacía: una cuenta, sin personal, sin parcelas y sin fecha de inicio declarada.
