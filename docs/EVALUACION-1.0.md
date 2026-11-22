# AgroGestión 1.0 — evaluación del sistema completo

Corte: domingo 22 de noviembre de 2026. Para la entrega del lunes 23.
Cada afirmación dice con qué se comprobó. Lo que no tiene comprobación dice **no verificado**.

## Veredicto

**NO LISTO como sistema completo. LISTO PARA PRUEBA DE CAMPO en la operación diaria.**

- Lo que se probó, funciona, y lo que falló al probarlo está corregido.
- **No está probado en ningún teléfono de verdad.** Cero pruebas en campo.
- **No hay todavía un respaldo real** de producción. Hasta que exista y se restaure en un proyecto aislado, capturar
  dinero real depende de que la base no falle.
- De los 67 módulos, 11 están aprobados con el criterio completo, 14 en parte y 42 sin verificar con ese criterio
  (de esos 42, unos 12 ya tenían recorridos propios en la batería; unos 30 sólo se sabe que abren).

## Cómo comprobarlo uno mismo

| Qué | Con qué | Resultado hoy |
|---|---|---|
| Reglas y cálculos | `npm test` | 1,260 de 1,260 |
| La base, armada desde cero y atacada por perfil | `npm run test:base` | 156 de 156 |
| Respaldo y restauración, de punta a punta en local | `sh pruebas/respaldo_local/ensayo.sh` | 26 de 26 |
| Todo junto: lo anterior, compilación y 36 recorridos en navegador | `sh pruebas/todo.sh` | Todo pasa |
| Producción cerrada sin sesión | `pruebas/real_sin_sesion.py` | 6 de 6 |
| El sitio publicado, en Android y iPhone imitados | `pruebas/real_sitio.py` | 18 de 18 |
| Producción igual a la base probada | `node pruebas/base/paridad.mjs --consulta` | 7 huellas iguales |

## Por área

| Área | Estado | Con qué se comprobó | Qué no está comprobado |
|---|---|---|---|
| **Entrar, cuentas y perfiles** | Funciona en las pruebas | `entrega` 68, `cuentas`, `entrada`; base por perfil | Correos de invitación reales; cuentas reales de los demás |
| **Permisos** | Funciona; la base es la que niega | 156 ataques a la base; paridad con producción; sin sesión 6/6. Banco y Socios: ni el encargado ni Finanzas entran sin permiso otorgado (hojas 54 y 55) | — |
| **Operación del día** (alta, checar, plan, reparto, cambios, incidencias, aplicaciones, cierre de jornada) | Funciona en las pruebas | `entrega` 68 pasos con cuentas, dos aparatos y sin señal; recorridos propios de cada módulo | Teléfonos y señal reales; lector de credencial con cámara. La auditoría módulo por módulo de esta área está pendiente |
| **Pagos al personal, préstamos, bonos, cierre de semana** | Recorrido con cuentas: **pasa, sin defectos** | `auditoria_pagos` 40, `auditoria_semana` 26; además `pagos` 33, `prestaciones` 49, `bajas` 34, `sensibles` 15 | Con cuentas faltan ausencias, prestaciones y bajas; las cifras legales las confirma una persona |
| **Almacén y compras** | Inventario, Conteo y mermas, Solicitudes y Registrar compra **aprobados**; Entregas y Mis compras en parte | `auditoria_almacen` 45, `auditoria_agronomo` 20; además `almacen` 55, `dosaparatos` 15 | Entregar a una persona y cerrar, con cuentas; la compra capturada por el trabajador con su PIN. **Destapó 6 defectos, uno grave: corregidos, falta publicar** |
| **Dinero**: Finanzas, Movimientos, Caja chica, Proveedores, Deudas, Bitácora | **Aprobado** | `auditoria_dinero` 37, `auditoria_proveedores` 27, `auditoria_pagos` 40 (caja ligada a su préstamo y a su pago) | — |
| **Dinero**: Papeles, Banco, Socios, Semana, Reportes, Temporadas, ContPAQi, paneles | **No verificado** | Abren; sus cálculos tienen pruebas; Banco y Socios cerrados al encargado (probado en la base) | El uso completo de cada uno |
| **Bodega y ajo** | Corrida simulada completa: **pasa**. Ajo terminado aprobado; lo demás en parte | `auditoria_bodega` 46: recepción → limpio → corrida → estibas → terminado → embarque → consignación → cobro → venta | Calidad, categorías aparte, revoltura, re-limpia, salida a nuestra bodega, pago parcial o contra deuda; imprimir |
| **Agronomía y campo** (Fito, variedades, calendario, cosechas, rendimiento, dron, ganado) | **No verificado** | Abren; sus cálculos tienen pruebas; Mapa y satélite tienen recorrido propio | El uso completo; validación con el agrónomo |
| **Mensajes y avisos** | Funciona en las pruebas | `mensajes`, `mensajes_movil`, `dicho` | El aviso en un teléfono real |
| **Sin señal y teléfono compartido** | Funciona en las pruebas | `sinsenal` 10 (versión compilada), `campo`, `dosaparatos`, `entrega` | Señal real del rancho |
| **Respaldo manual** (archivo desde la app) | Funciona; conserva autoría | `entrega`; 16 pruebas de restauración en la base | — |
| **Respaldo automático** | **Preparado y ensayado en local; sin estrenar** | Ensayo local 26/26 | El respaldo real y su restauración en un proyecto de Supabase |

## Lo que se corrigió en este cierre (todo con su prueba)

- Del recorrido de un día completo: 5 fallas graves y 6 que impedían operar (señal mala, respaldo, borrado masivo,
  app en blanco sin señal, plan duplicado, altas sin validar, sesión abierta en teléfono compartido…). Publicado.
- De usar el dinero como usuario: 9 defectos (caja chica, abonos que se borraban o se perdían entre dos teléfonos,
  flujo incompleto, acceso del encargado a Banco y Socios). Publicado.
- De la corrida simulada: 3 defectos (la corrida se perdía al salir de la pantalla, ventas sin dinero contadas como
  dinero, ajuste de ajo terminado sin motivo). Publicado.
- De usar el almacén y las compras: 6 defectos. El grave: registrar la compra de una solicitud no subía la existencia
  y cambiaba hacia atrás el costo de lo ya usado. Los otros: la misma compra salía dos veces del flujo si se pagaba de
  caja y se metía al inventario; aplicar un producto del almacén contaba otra vez como dinero que salió; una merma
  cambiaba de importe con cada compra posterior; lo recibido sin precio se veía dos veces; artículos sin nombre o
  repetidos. **Corregido y probado; falta publicar.**
- De usar pagos, préstamos, bonos y cierre de semana: ningún defecto de dinero.
- Del ensayo del respaldo: una copia restaurada dejaba abiertas las funciones de la base. Corregido antes de estrenar.

El detalle, uno por uno: `docs/AUDITORIA-FUNCIONAL.md` y `docs/ENTREGA-1.0.md`.

## Riesgos abiertos, por orden

1. **Sin respaldo real.** Bloquea operar dinero. Faltan tres secretos y un repositorio privado (`docs/RESPALDO-AUTOMATICO.md`).
2. **Sin prueba de campo.** `docs/PRUEBA-DEL-DOMINGO.md`, 24 pasos, una hora.
3. **42 módulos sin auditar con el criterio completo y 14 a medias.** Cada módulo auditado hasta ahora destapó al menos un defecto
   de dinero o de control: es razonable esperar más en los que faltan.
4. **Producción vacía**: una cuenta, sin personal, sin fecha de inicio.
5. El repositorio del código es público (sin llaves ni datos; la documentación nombra a la familia).
6. Pendientes menores abiertos: 3 (lista en la auditoría).
7. **Correcciones del almacén sin publicar**: producción todavía tiene el defecto de la compra desde una solicitud.

## Qué se puede hacer el lunes y qué no

| Sí, como prueba de campo | Todavía no |
|---|---|
| Dar de alta al personal y las parcelas reales | Capturar dinero real como registro definitivo (hasta tener respaldo) |
| Checar, mandar el plan, repartir, cambiar, cerrar la jornada | Dar por bueno un módulo que diga NO VERIFICADO |
| Registrar incidencias y aplicaciones | Confiar en un teléfono sin haber hecho la prueba de campo en él |
| Ver lo que corresponde pagar | Registrar compras desde una solicitud en producción antes de publicar su corrección |

## Qué falta exactamente para decir «sistema terminado», y por qué

| Qué falta | Por qué no está | De quién depende |
|---|---|---|
| Publicar las correcciones del almacén | Nada se publica sin autorización | Luis: un sí |
| Respaldo real y su restauración en un proyecto aislado | Hace falta un repositorio privado y tres secretos que no deben pasar por el chat | Luis: 10 minutos (`docs/RESPALDO-AUTOMATICO.md`) |
| Prueba de campo en teléfonos de verdad | No se puede imitar: señal, cámara, impresora, correo | La familia: una hora (`docs/PRUEBA-DEL-DOMINGO.md`) |
| 14 módulos a medias | Cada recorrido completo toma horas y cada uno ha destapado defectos que hay que corregir y volver a probar | Claudio: sigue |
| 42 módulos sin auditar | Lo mismo. De éstos, unos 30 sólo se sabe que abren (paneles, agronomía, captura anterior, control) | Claudio: sigue |
| Banco y Socios para Finanzas con permiso | La base ya lo exige; falta recorrer esas pantallas con una cuenta autorizada | Claudio |
| Validar con Miguel, Fito y Dirección | Organización, jornada y especialidades esperan su criterio; no es técnico | La familia |

Ritmo real: 11 módulos aprobados y 14 a medias en dos días, con 23 defectos encontrados y corregidos. A ese ritmo,
terminar los 67 con el criterio completo toma del orden de una semana más de trabajo continuo, sin contar la prueba de
campo ni el respaldo real.
