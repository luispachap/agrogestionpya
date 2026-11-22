# AgroGestión 1.0 — evaluación del sistema completo

Corte: domingo 22 de noviembre de 2026. Para la entrega del lunes 23.
Cada afirmación dice con qué se comprobó. Lo que no tiene comprobación dice **no verificado**.

## Veredicto

**NO LISTO como sistema completo. LISTO PARA PRUEBA DE CAMPO en la operación diaria.**

- Lo que se probó, funciona, y lo que falló al probarlo está corregido.
- **No está probado en ningún teléfono de verdad.** Cero pruebas en campo.
- **No hay todavía un respaldo real** de producción. Hasta que exista y se restaure en un proyecto aislado, capturar
  dinero real depende de que la base no falle.
- De los 67 módulos, 7 están aprobados con el criterio completo, 5 en parte y 55 sin verificar con ese criterio
  (de esos 55, 25 ya tenían recorridos propios en la batería; 30 sólo se sabe que abren).

## Cómo comprobarlo uno mismo

| Qué | Con qué | Resultado hoy |
|---|---|---|
| Reglas y cálculos | `npm test` | 1,253 de 1,253 |
| La base, armada desde cero y atacada por perfil | `npm run test:base` | 152 de 152 |
| Respaldo y restauración, de punta a punta en local | `sh pruebas/respaldo_local/ensayo.sh` | 26 de 26 |
| Todo junto: lo anterior, compilación y 32 recorridos en navegador | `sh pruebas/todo.sh` | Todo pasa |
| Producción cerrada sin sesión | `pruebas/real_sin_sesion.py` | 6 de 6 |
| El sitio publicado, en Android y iPhone imitados | `pruebas/real_sitio.py` | 18 de 18 |
| Producción igual a la base probada | `node pruebas/base/paridad.mjs --consulta` | 7 huellas iguales |

## Por área

| Área | Estado | Con qué se comprobó | Qué no está comprobado |
|---|---|---|---|
| **Entrar, cuentas y perfiles** | Funciona en las pruebas | `entrega` 68, `cuentas`, `entrada`; base por perfil | Correos de invitación reales; cuentas reales de los demás |
| **Permisos** | Funciona; la base es la que niega | 152 ataques a la base; paridad con producción; sin sesión 6/6 | — |
| **Operación del día** (alta, checar, plan, reparto, cambios, incidencias, aplicaciones, cierre de jornada) | Funciona en las pruebas | `entrega` 68 pasos con cuentas, dos aparatos y sin señal; recorridos propios de cada módulo | Teléfonos y señal reales; lector de credencial con cámara. La auditoría módulo por módulo de esta área está pendiente |
| **Pagos al personal, prestaciones, bajas** | Funciona en las pruebas | `pagos` 33, `prestaciones` 49, `bajas` 34, `sensibles` 15 | Auditoría con el criterio nuevo; las cifras legales las confirma una persona |
| **Almacén y compras** | Funciona en las pruebas | `almacen` 55, `dosaparatos` 15, `cruces`, `decisiones` | Auditoría con el criterio nuevo; un cruce con caja chica por revisar |
| **Dinero**: Finanzas, Movimientos, Caja chica, Proveedores, Deudas, Bitácora | **Aprobado** | `auditoria_dinero` 37, `auditoria_proveedores` 27 | Ligar caja con un préstamo o pago real, en pantalla |
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
  dinero, ajuste de ajo terminado sin motivo). **Corregido; falta publicar.**
- Del ensayo del respaldo: una copia restaurada dejaba abiertas las funciones de la base. Corregido antes de estrenar.

El detalle, uno por uno: `docs/AUDITORIA-FUNCIONAL.md` y `docs/ENTREGA-1.0.md`.

## Riesgos abiertos, por orden

1. **Sin respaldo real.** Bloquea operar dinero. Faltan tres secretos y un repositorio privado (`docs/RESPALDO-AUTOMATICO.md`).
2. **Sin prueba de campo.** `docs/PRUEBA-DEL-DOMINGO.md`, 24 pasos, una hora.
3. **55 módulos sin auditar con el criterio completo.** Cada módulo auditado hasta ahora destapó al menos un defecto
   de dinero o de control: es razonable esperar más en los que faltan.
4. **Producción vacía**: una cuenta, sin personal, sin fecha de inicio.
5. El repositorio del código es público (sin llaves ni datos; la documentación nombra a la familia).
6. Pendientes menores abiertos: 4 (lista en la auditoría).

## Qué se puede hacer el lunes y qué no

| Sí, como prueba de campo | Todavía no |
|---|---|
| Dar de alta al personal y las parcelas reales | Capturar dinero real como registro definitivo (hasta tener respaldo) |
| Checar, mandar el plan, repartir, cambiar, cerrar la jornada | Dar por bueno un módulo que diga NO VERIFICADO |
| Registrar incidencias y aplicaciones | Confiar en un teléfono sin haber hecho la prueba de campo en él |
| Ver lo que corresponde pagar | Usar la corrida de ajo en producción antes de publicar su corrección |
