# Auditoría funcional de AgroGestión 1.0 — los 67 módulos

Corte: domingo 22 de noviembre de 2026. **7 aprobados · 5 recorridos en parte · 55 sin verificar.**
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
| 10 | Finanzas | Una venta cobrada en especie o a cuenta de una deuda se contaba como dinero que entró | P1 | Corregido, **sin publicar** |
| 11 | Corrida de ajo | Salir de la pantalla o recargar a media corrida borraba las cajas contadas, las tarimas, los cortes y los conteos, y partía el reporte del día | P1 | Corregido, **sin publicar** |
| 12 | Ajo terminado | El inventario de ajo terminado se podía ajustar sin decir el motivo | P1 | Corregido, **sin publicar** |
| 13 | Respaldo | Una copia restaurada dejaba abiertas a toda cuenta las funciones de la base (incluida la que firma autorizaciones) | P0 | Corregido antes de estrenarse; nunca estuvo en producción |
| 14 | Deudas / Proveedores | El proveedor se guarda distinto en cada pantalla (texto / ficha) | P2 | Abierto |
| 15 | Caja chica / Almacén | Una compra de almacén pagada de caja y además capturada con costo en Almacén contaría dos veces en el flujo | P2 | Abierto: se revisa al auditar Almacén |
| 16 | Corrida de ajo | Los cortes, conteos y cajas de plástico de la corrida se pueden borrar sin motivo; y la configuración se guarda con un nombre fijo, no por espacio | P2 | Abierto |
| 17 | Consignaciones | Los cobros de un embarque viven dentro del embarque: dos teléfonos cobrando el mismo podrían pisarse (mismo patrón que los abonos) | P2 | Abierto, sin reproducir |

## Lo que no se pudo ejecutar y por qué

- Ligar una salida de caja a un préstamo entregado o a un pago registrado, desde la pantalla: crear esos registros
  pide el recorrido completo de Préstamos y Pagos. La regla está probada en cálculo; el recorrido se hará al auditar
  Pagos al personal.
- Que la base le niegue algo a un perfil no se ve en la nube de imitación (devuelve todo): se prueba atacando la
  base aislada (`pruebas/base/auditoria.test.mjs`, 8 pruebas).
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
| 9 | Aplicaciones | NO VERIFICADO | antes: ejecutores, entrega | — | Falta la auditoría completa |
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
| 33 | Caja chica | **APROBADO** | auditoria_dinero 37 · caja.test | Fondo, las siete clases de salida, por clasificar y clasificar después, cancelar con su gasto ligado, sólo se corrige el concepto, flujo sin duplicar, saldo al centavo | Ligar una salida a un préstamo o pago real: probado en cálculo, sin recorrido en navegador |
| 34 | Papeles | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 35 | Importar documentos | NO VERIFICADO | antes: importar, ia, rayas | — | Falta la auditoría completa |
| 36 | Banco | NO VERIFICADO | antes: sólo que abre; permisos por perfil atacados en la base | — | Falta la auditoría completa |
| 37 | Socios | NO VERIFICADO | antes: sólo que abre; permisos por perfil atacados en la base | — | Falta la auditoría completa |
| 38 | Deudas | **APROBADO** | auditoria_proveedores 27 · base 4 | Mismo crédito y saldo que Proveedores; abonar; el abono sale en el flujo; cancelar abono; el encargado no entra | El proveedor se guarda distinto que en Proveedores (P2 abierto) |
| 39 | Semana | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 40 | Reportes | NO VERIFICADO | antes: mes, cruces | — | Falta la auditoría completa |
| 41 | Temporadas | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 42 | ContPAQi | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 43 | Inventario | NO VERIFICADO | antes: almacen, cruces | — | Falta la auditoría completa |
| 44 | Entregas del almacén | NO VERIFICADO | antes: almacen, dosaparatos | — | Falta la auditoría completa |
| 45 | Conteo y mermas | NO VERIFICADO | antes: almacen | — | Falta la auditoría completa |
| 46 | Solicitudes de compra | NO VERIFICADO | antes: cruces | — | Falta la auditoría completa |
| 47 | Mis compras | NO VERIFICADO | antes: cruces, decisiones | — | Falta la auditoría completa |
| 48 | Registrar compra | NO VERIFICADO | antes: entrega, cruces | — | Falta la auditoría completa |
| 49 | Proveedores | **APROBADO** | auditoria_proveedores 27 · base 4 | Directorio, crédito con vencimiento, abonos en dinero y en especie, cancelar abono (no borrar) con bitácora, recarga, dos teléfonos con uno sin señal, perfiles | — |
| 50 | Equipo | NO VERIFICADO | antes: entrega | — | Falta la auditoría completa |
| 51 | Personal | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 52 | Equipos de trabajo | NO VERIFICADO | antes: cuadrillas, reasignacion, entrega | — | Falta la auditoría completa |
| 53 | Cuadrillas | NO VERIFICADO | antes: eventuales | — | Falta la auditoría completa |
| 54 | Checador | NO VERIFICADO | antes: checador, entrega | — | Falta la auditoría completa |
| 55 | Jornadas | NO VERIFICADO | antes: entrega | — | Falta la auditoría completa |
| 56 | Credenciales | NO VERIFICADO | antes: checador | — | Falta la auditoría completa |
| 57 | Pase de lista | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 58 | Asistencia | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 59 | Pagos al personal | NO VERIFICADO | antes: pagos, prestaciones, bajas, sensibles, entrega | — | Falta la auditoría completa |
| 60 | Aprobar externos | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 61 | Mis días | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 62 | Arranque | NO VERIFICADO | antes: arranque, cuentas | — | Falta la auditoría completa |
| 63 | Organización | NO VERIFICADO | antes: organizacion | — | Falta la auditoría completa |
| 64 | Bitácora | **APROBADO** | auditoria_dinero · auditoria_proveedores · base | Enseña cada cancelación con quién, cuándo y motivo; en la base nadie la edita ni la borra | — |
| 65 | Seguridad | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 66 | Respaldo | NO VERIFICADO | antes: entrega, ensayo local del respaldo | — | Falta la auditoría completa |
| 67 | Subir catálogos | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |

## Orden en que sigue

1. Lo indispensable para operar: Equipo, Parcelas, Checador, Equipos de trabajo, El día, Jornadas, Aplicaciones,
   Inventario, Entregas, Conteo y mermas, Compras, Solicitudes, Pagos al personal (con préstamos y la liga a caja).
2. Terminar Bodega: calidad, categorías aparte, revoltura, re-limpia, salida a nuestra bodega, pago parcial y a
   cuenta de deuda.
3. Dinero que falta: Papeles, Banco, Socios, Semana, Reportes, Temporadas, ContPAQi y los paneles.
4. Agronomía y campo: Hoja de Fito, Variedades, Calendario, Cosechas, Rendimiento, Dron, Ganado, Mapa.
5. Captura anterior y control: Registrar actividad, Registro de varios, Tareas, Indicaciones, Pase de lista,
   Asistencia, Reportar, Seguridad, Subir catálogos, Credenciales.
6. Integrales: seguridad por perfil en todos, respaldo y recuperación reales.
