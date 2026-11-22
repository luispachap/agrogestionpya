# Auditoría funcional de AgroGestión 1.0 — los 67 módulos

Corte: 22 de noviembre de 2026, madrugada. **Va en 6 de 67.** Sigue módulo por módulo, aunque pase del lunes.
Ningún módulo sale de este inventario: lo que no se ha recorrido dice NO VERIFICADO.

## Qué cuenta como aprobado

Usar el módulo como una persona, desde un teléfono imitado (Pixel 7, Galaxy S9+; iPhone 13 cuando toca), contra una
nube de imitación que guarda y devuelve con cuentas:

1. Recorrer botones, formularios y pestañas, capturando datos inventados pero realistas.
2. Comprobar el resultado en la pantalla **y** en lo que quedó guardado en la nube.
3. Recargar, salir y volver: que siga ahí, una sola vez.
4. Corregir y cancelar sin duplicar ni borrar.
5. Entrar con otros perfiles e intentar lo que no les toca; y atacar la base directo donde la imitación no alcanza.
6. Dos teléfonos, y uno de ellos sin señal.
7. Que lo capturado llegue a los otros módulos que dependen de él.

**Lo que NO es:** teléfonos de verdad, señal del rancho, cámara, correos reales ni producción. Eso es la prueba de
campo, que es aparte y no la sustituye. «Que abra sin tronar» tampoco cuenta: es la columna «antes».

## Defectos encontrados al usar los módulos

| # | Módulo | Qué pasaba | Nivel | Estado |
|---|---|---|---|---|
| 1 | Caja chica | Un gasto de caja sin parcela no llegaba a Resultados ni al flujo | P1 | Corregido y publicado |
| 2 | Caja chica | Toda salida era gasto; ahora dice qué fue (siete clases, política de Luis) | P1 | Corregido y publicado |
| 3 | Caja chica | Se podía cambiar el importe o borrar el movimiento sin rastro | P1 | Corregido y publicado |
| 4 | Caja chica | Cancelar un movimiento dejaba vivo su gasto ligado | P1 | Corregido y publicado |
| 5 | Finanzas | Un gasto de una parcela salía entre los gastos generales | P2 | Corregido y publicado |
| 6 | Proveedores, Deudas | Un abono a un crédito se podía BORRAR con un toque, sin motivo | P1 | Corregido, **sin publicar** |
| 7 | Deudas | Los abonos capturados en Deudas no salían en el flujo de efectivo | P1 | Corregido, **sin publicar** |
| 8 | Proveedores, Deudas | Dos teléfonos abonando al mismo crédito, uno sin señal: se perdía un abono | P1 | Corregido, **sin publicar** |
| 9 | Deudas / Proveedores | El proveedor se guarda distinto en cada pantalla (texto / ficha) | P2 | Abierto |
| 10 | Caja chica | Una compra de almacén pagada de caja y además capturada con costo en Almacén contaría dos veces en el flujo | P2 | Abierto: se revisa al auditar Almacén |

## Preguntas de negocio que salieron

- **El perfil «encargado» puede ver y capturar Banco (estados de cuenta) y Socios (quién puso y quién sacó).** Así
  está en el menú y en los permisos de la base. Si un encargado es un capataz, probablemente no debería. Lo decide Luis.

## Lo que no se pudo ejecutar y por qué

- Ligar una salida de caja a un préstamo entregado o a un pago registrado, desde la pantalla: crear esos registros
  pide el recorrido completo de Préstamos y Pagos. La regla está probada en cálculo (`caja.test.js`); el recorrido
  en navegador se hará al auditar Pagos al personal.
- Que la base le niegue los créditos al encargado no se puede ver en la nube de imitación (devuelve todo): se probó
  atacando la base aislada (`pruebas/base/auditoria.test.mjs`).

## Inventario

«Antes» = qué recorrido de la batería ya lo tocaba; es evidencia previa, no la auditoría.

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
| 24 | Corrida de ajo | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 25 | Estibas | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 26 | Ajo terminado | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 27 | Salida de camión | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 28 | Consignaciones | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 29 | Comercialización | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 30 | Mano de obra | NO VERIFICADO | antes: cuadrillas | — | Falta la auditoría completa |
| 31 | Finanzas | **APROBADO** | auditoria_dinero 37 | Gasto general y de parcela, venta, cancelar con motivo, bitácora, flujo y resultados, recarga, otro teléfono, tres perfiles | — |
| 32 | Movimientos | **APROBADO** | auditoria_dinero 37 | Totales del periodo iguales a Finanzas; lo cancelado no cuenta y sigue visible | — |
| 33 | Caja chica | **APROBADO** | auditoria_dinero 37 · caja.test 15 | Fondo, las siete clases de salida, por clasificar y clasificar después, cancelar con su gasto ligado, sólo se corrige el concepto, flujo sin duplicar, saldo al centavo | Ligar una salida a un préstamo o pago real: probado en cálculo, sin recorrido en navegador |
| 34 | Papeles | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 35 | Importar documentos | NO VERIFICADO | antes: importar, ia, rayas | — | Falta la auditoría completa |
| 36 | Banco | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 37 | Socios | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |
| 38 | Deudas | **APROBADO** | auditoria_proveedores 25 · base 4 | Mismo crédito y saldo que Proveedores; abonar; el abono sale en el flujo; cancelar abono; el encargado no entra | Un crédito creado aquí guarda el proveedor como texto y el de Proveedores como ficha: no se ven igual en las dos pantallas (P2). Correcciones sin publicar |
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
| 49 | Proveedores | **APROBADO** | auditoria_proveedores 25 · base 4 | Directorio, crédito con vencimiento, abonos en dinero y en especie, cancelar abono (no borrar) con bitácora, recarga, dos teléfonos con uno sin señal, perfiles | Correcciones sin publicar |
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
| 66 | Respaldo | NO VERIFICADO | antes: entrega | — | Falta la auditoría completa |
| 67 | Subir catálogos | NO VERIFICADO | antes: sólo que abre | — | Falta la auditoría completa |

## Orden en que sigue

1. Lo indispensable para operar: Equipo, Parcelas, Checador, Equipos de trabajo, El día, Jornadas, Aplicaciones,
   Inventario, Entregas, Conteo y mermas, Compras, Solicitudes, Pagos al personal (con préstamos y la liga a caja).
2. Dinero que falta: Papeles, Banco, Socios, Semana, Reportes, Temporadas, ContPAQi y los paneles.
3. Bodega, con una corrida de ajo simulada completa: recepción, limpia, calibre, estibas, terminado, embarque y
   consignación, y su llegada a ventas y a deudas.
4. Agronomía y campo: Hoja de Fito, Variedades, Calendario, Cosechas, Rendimiento, Dron, Ganado, Mapa.
5. Captura anterior y control: Registrar actividad, Registro de varios, Tareas, Indicaciones, Pase de lista,
   Asistencia, Reportar, Seguridad, Subir catálogos, Credenciales.
6. Integrales: seguridad por perfil en todos, respaldo y recuperación reales.
