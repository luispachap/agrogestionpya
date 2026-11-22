# Auditoría funcional de AgroGestión 1.0 — los 67 módulos

Corte: domingo 22 de noviembre de 2026. **11 aprobados · 14 recorridos en parte · 42 sin verificar.**
Sigue módulo por módulo, aunque pase del lunes. Ningún módulo sale de este inventario.

## Qué significa cada estado

- **APROBADO**: se usó como una persona, desde un teléfono imitado (Pixel 7, Galaxy S9+; iPhone 13 cuando toca),
  contra una nube de imitación que guarda y devuelve con cuentas: capturar datos inventados pero realistas, comprobar
  el resultado en pantalla **y** en lo guardado, recargar y volver, corregir y cancelar, otros perfiles intentando lo
  que no les toca, otro teléfono, y su llegada a los módulos que dependen de él.
- **PARCIAL**: lo recorrido pasa, pero faltan partes del módulo, que se nombran. No es aprobado.
- **NO VERIFICADO**: no se ha recorrido con este criterio. La columna «Prueba» dice qué recorrido de la batería ya
  lo tocaba *antes*; es evidencia previa, no la auditoría. «Sólo que abre» no cuenta.

**Lo que ningún estado incluye:** teléfonos de verdad, señal del rancho, cámara, impresora, correos reales ni
producción. Eso es la prueba de campo, aparte.

## Defectos encontrados al usar los módulos

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
| 9 | Banco, Socios | El encargado podía ver y capturar estados de cuenta y la cuenta entre socios | P1 | Cerrado en la app y en la base (decisión de Luis), publicado |
| 10 | Finanzas | Una venta cobrada en especie o a cuenta de una deuda se contaba como dinero que entró | P1 | Corregido y publicado |
| 11 | Corrida de ajo | Salir de la pantalla o recargar a media corrida borraba las cajas contadas, las tarimas, los cortes y los conteos, y partía el reporte del día | P1 | Corregido y publicado |
| 12 | Ajo terminado | El inventario de ajo terminado se podía ajustar sin decir el motivo | P1 | Corregido y publicado |
| 13 | Respaldo | Una copia restaurada dejaba abiertas a toda cuenta las funciones de la base (incluida la que firma autorizaciones) | P0 | Corregido antes de estrenarse; nunca estuvo en producción |
| 14 | Deudas / Proveedores | El proveedor se guarda distinto en cada pantalla (texto / ficha) | P2 | Abierto |
| 15 | Caja chica / Almacén | Una compra de almacén pagada de caja (o capturada en Finanzas) y además metida con costo en Inventario salía dos veces del flujo. Reproducido: $10,000 por una compra de $5,000 | P1 | Corregido, **sin publicar**: Inventario → Entradas propone el gasto que coincide y una persona dice «es la misma compra»; Finanzas avisa cuántas hay |
| 16 | Corrida de ajo | Los cortes, conteos y cajas de plástico de la corrida se pueden borrar sin motivo; y la configuración se guarda con un nombre fijo, no por espacio | P2 | Abierto |
| 17 | Consignaciones | Los cobros de un embarque viven dentro del embarque: dos teléfonos cobrando el mismo podrían pisarse (mismo patrón que los abonos) | P2 | Abierto, sin reproducir |
| 18 | Solicitudes de compra | Al registrar la compra de un artículo que ya existía, la existencia NO subía (5 + 4 seguían siendo 5) y el costo de lo ya consumido cambiaba hacia atrás (el resultado pasó de $2,500 a $7,294 sin que nadie gastara) | **P0** | Corregido, **sin publicar**: la mercancía entra como movimiento del almacén, con identificador fijo por solicitud (dos teléfonos no la meten doble) |
| 19 | Conteo y mermas | Una merma o un faltante se valuaba al costo de HOY: una compra posterior más cara le cambiaba el importe a una merma vieja, y con él el resultado de un mes ya visto | P1 | Corregido, **sin publicar**: vale lo que costaba el día que pasó |
| 20 | Aplicaciones / Finanzas | Aplicar un producto que ya estaba en el almacén contaba otra vez como dinero que salió (una vez al comprarlo y otra al aplicarlo) | P1 | Corregido, **sin publicar** |
| 21 | Inventario | Lo recibido sin precio se valuaba al promedio de lo demás y además salía como «por valuar» (se veía dos veces); y el valor traía centavos de más o de menos por redondear el promedio | P2 | Corregido, **sin publicar** |
| 22 | Inventario, Registrar compra | Se podía dar de alta un artículo sin nombre, o dos con el mismo nombre (parte la existencia en dos) | P2 | Corregido, **sin publicar** |
| 23 | Pagos al personal | Dos avisos enseñaban importes sin formato de dinero («faltan 350») | P3 | Corregido, **sin publicar** |

## Lo que no se pudo ejecutar y por qué

- Que la base le niegue algo a un perfil no se ve en la nube de imitación (devuelve todo): se prueba atacando la
  base aislada (`pruebas/base/auditoria.test.mjs`, 12 pruebas).
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
| 9 | Aplicaciones | **PARCIAL** | auditoria_agronomo 20 · ejecutores | Aplicación con un producto del inventario: descuenta lo aplicado, carga su costo a la parcela una vez, no vuelve a salir del flujo, avisa si no se dice quién aplicó, recarga, otro aparato | Con aplicadores y quién la indicó (visto en local), reentrada y carencia, reporte de la aplicación |
| 10 | Indicaciones | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 11 | Tareas | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 12 | Reportar | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 13 | Mapa del rancho | NO VERIFICADO | antes: mapa, satelite | — | Falta la auditoría completa |
| 14 | Parcelas | NO VERIFICADO | antes: entrega | — | Falta la auditoría completa |
| 15 | Estado de parcelas | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 16 | Calendario | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 17 | Cosechas | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 18 | Rendimiento por parcela | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 19 | Variedades | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 20 | Comparar variedades | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 21 | Hoja de Fito | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 22 | Dron | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 23 | Ganado | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 24 | Corrida de ajo | **PARCIAL** | auditoria_bodega 46 · corridaViva.test | Corrida en vivo completa: tarima de limpio a la mesa, conteo por calibre, cierre de estiba con peso y folio, conteo físico, salir y volver, recargar, terminar el día con ajuste de la tarima, un solo reporte | Pestañas Calidad y Categorías aparte, modo revoltura, cambio de tarima a media corrida, tarima limpiada hoy, cortes de 15 minutos |
| 25 | Estibas | **PARCIAL** | auditoria_bodega 46 | Alta masiva de barbecho desde la parcela, limpio que consume barbecho, saldos, rastreo hasta la parcela, etiquetas, otro teléfono | Re-limpia, alta individual, estiba sin origen, cierre manual de una estiba, imprimir |
| 26 | Ajo terminado | **APROBADO** | auditoria_bodega 46 | Entra solo al cerrar estiba; entrada manual; ajuste con motivo obligatorio e historial; baja al embarcar; recarga; nube | — |
| 27 | Salida de camión | **PARCIAL** | auditoria_bodega 46 | Embarque a cliente: tarima pesada, folio, formato, baja del terminado, queda pendiente de cobro, no es venta todavía | Salida a nuestra bodega, varias tarimas y calibres, estiba de origen, cargar más de lo que hay, remisión impresa |
| 28 | Consignaciones | **PARCIAL** | auditoria_bodega 46 | Pendiente de cobro, cobrar en dinero, nace una sola venta, llega a resultados y flujo, el encargado no entra | Pago parcial, pago a cuenta de una deuda (la regla del flujo sí está probada en cálculo), dos teléfonos |
| 29 | Comercialización | **PARCIAL** | auditoria_bodega 46 | Enseña la venta con su cliente y el precio por kilo | Sólo se comprobó una venta; faltan varios clientes y periodos |
| 30 | Mano de obra | NO VERIFICADO | antes: cuadrillas | — | Falta la auditoría completa |
| 31 | Finanzas | **APROBADO** | auditoria_dinero 37 | Gasto general y de parcela, venta, cancelar con motivo, bitácora, flujo y resultados, recarga, otro teléfono, tres perfiles | — |
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
| 43 | Inventario | **APROBADO** | auditoria_almacen 45 · movimientos.test · resultado.test | Alta (sin nombre o repetido no entra), entrada con costo como movimiento, valor a costo promedio, «es la misma compra» contra un gasto de caja, recarga, otro aparato, Dirección, dos aparatos sin señal | Ficha técnica de agroquímicos y pestaña Cosechas |
| 44 | Entregas del almacén | **PARCIAL** | auditoria_almacen 45 · almacen 55 (local) | Uso directo a una parcela: exige destino, costo promedio del momento, ahí nace el costo; dos aparatos sin señal | Entregar a una persona, cerrar, bajas y traslados con cuentas (recorridos en local) |
| 45 | Conteo y mermas | **APROBADO** | auditoria_almacen 45 · movimientos.test | Conteo a ciegas (no enseña el número antes), causa obligatoria si no cuadra, merma con causa, importe al costo del día, baja el valor del inventario y no es salida de dinero | Conteo en otra bodega |
| 46 | Solicitudes de compra | **APROBADO** | auditoria_almacen 45 | El encargado pide (no mueve nada), no se le ofrece comprar; el administrador registra la compra: sube la existencia, sale el dinero una vez, no cambia el resultado; ya comprada no se repite | Cotizar por WhatsApp (abre otra aplicación) |
| 47 | Mis compras | **PARCIAL** | auditoria_almacen 45 · decisiones (local) | Aprobar no mete al almacén; recibir sin precio queda por valuar (ni cero ni al promedio); valuar; el flete es gasto; el flujo la cuenta una vez | La captura del trabajador con su PIN y la foto del ticket |
| 48 | Registrar compra | **APROBADO** | auditoria_agronomo 20 | Insumo nuevo y existente, costo promedio, no es gasto, sale una vez del flujo, nombre repetido no entra, el encargado no la tiene | — |
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
| 59 | Pagos al personal | **PARCIAL** | auditoria_pagos 40 · auditoria_semana 26 · entrega | Lo que corresponde, pago (sellado por la base), el préstamo no descuenta solo, cuenta de cuadrilla por responsable, bonos (otorgar es costo, pagar no), recibo con versión, cerrar, confirmar y reabrir la semana, Finanzas y encargado sin permiso, recarga, otro aparato | Con cuentas faltan: ausencias y decisiones de un día, horas adicionales, prestaciones y bajas (recorridos en local: pagos 33, prestaciones 49, bajas 34) |
| 60 | Aprobar externos | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 61 | Mis días | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 62 | Arranque | NO VERIFICADO | antes: arranque, cuentas | — | Falta la auditoría completa |
| 63 | Organización | NO VERIFICADO | antes: organizacion | — | Falta la auditoría completa |
| 64 | Bitácora | **APROBADO** | auditoria_dinero · auditoria_proveedores · base | Enseña cada cancelación con quién, cuándo y motivo; en la base nadie la edita ni la borra | — |
| 65 | Seguridad | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 66 | Respaldo | NO VERIFICADO | antes: entrega, ensayo local del respaldo | — | Falta la auditoría completa |
| 67 | Subir catálogos | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |

## Orden en que sigue

1. Terminar lo que quedó en parte de la operación diaria, con cuentas: Entregas (a una persona y cierre), Cuadrillas
   (destajo, precio, flete), Equipos de trabajo (pago por tarea, vehículo), ausencias, prestaciones y bajas, El día y
   Jornadas, Registrar actividad, Mano de obra.
2. Terminar Bodega: calidad, categorías aparte, revoltura, re-limpia, salida a nuestra bodega, pago parcial y a
   cuenta de deuda; y los dos pendientes abiertos (16 y 17).
3. Dinero que falta: Papeles, Banco, Socios (con la consulta autorizada de Finanzas), Semana, Reportes, Temporadas,
   ContPAQi y los paneles (Operación, ¿Alcanza?, Resumen, ¿Cómo vamos?).
4. Agronomía y campo: Hoja de Fito, Variedades, Calendario, Cosechas, Rendimiento, Dron, Ganado, Mapa.
5. Captura anterior y control: Registro de varios, Tareas, Indicaciones, Pase de lista, Asistencia, Reportar,
   Seguridad, Subir catálogos, Credenciales, Arranque, Organización, Mensajes, Importar documentos.
6. Integrales: seguridad por perfil en todos, respaldo y recuperación reales.
