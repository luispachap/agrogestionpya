# Cuánto costó, por qué, y qué tan bien trabajamos

Cómo se calcula el costo del personal en AgroGestión: qué ya está hecho, qué
sigue, y qué reglas son del rancho y hay que decidir. Parte del principio de
`EVENTOS.md`: los hechos se capturan una vez y todo lo demás se calcula.

## Siete cosas que nunca se revuelven

| Capa | Qué es | De dónde sale | Estado |
|---|---|---|---|
| Hecho operativo | Llegó, salió, se le asignó, hizo tantas unidades, se aclaró un rato | Eventos | Hecho |
| Lo que ganó el trabajador | Su pago por día, por hora o por tarea de cada día | Se calcula de los hechos y de su ficha | Hecho (pago por día, por hora y por tarea) |
| Pago realizado | Cuándo y con qué se le pagó | Evento de pago que apunta a lo ganado | **Falta** |
| Costo directo | Lo ganado, cargado a la parcela y actividad donde trabajó | Se calcula | Hecho |
| Costo indirecto | Flete de la cuadrilla, prestaciones, tiempo fuera de parcelas, gastos generales | Eventos + provisiones | **Falta** |
| Distribución | Repartir un indirecto entre parcelas, cultivos o temporadas con un criterio escrito | Regla configurable, guardada como evento | **Falta** |
| Productividad | Horas, unidades, rendimientos, esperas, traslados, tiempo sin asignar y sus causas | Se calcula de los mismos hechos | Empezado: horas por parcela y actividad, y tiempo sin asignar con su causa |

Son vistas de los mismos hechos, no registros aparte. Por eso lo ganado, lo
cargado a parcelas y lo que queda fuera siempre suman lo mismo.

## Lo que ya hace

- **Trabajadores de planta, pago por día.** Con que haya llegado, gana su día,
  trabaje pocas o muchas horas. Ese día se reparte entre lo que hizo según el
  tiempo en cada actividad.
- **Pago por tarea.** Si se sabe cuánto hizo cada quien, a cada uno le toca lo
  suyo. Sólo se reparte parejo cuando nada más se conoce el total del grupo, y
  hay que pedirlo: la app no lo decide. Queda dicho que fue parejo.
- **Tiempo sin asignar.** Sale como "por aclarar", no como pérdida. Después se
  clasifica: sí trabajó (y entonces se va a su parcela), espera, mantenimiento,
  traslado, descanso autorizado, inactividad confirmada u otra causa. La
  aclaración es un evento aparte: no toca las marcas ni lo que ganó, y se puede
  cancelar o corregir con su motivo.
- **Nada se le carga a una parcela para que cuadre.** Lo que no tiene destino se
  queda fuera, con nombre.
- **Cada importe enseña de qué salió**: sus marcas, su asignación, su aclaración.

## Cuadrillas eventuales (hecho)

- Quiénes vinieron, su responsable, parcela y actividad.
- Por día: cada persona con su pago, aunque no cobren igual.
- Destajo: lo que hizo cada persona. Parejo sólo con el total del grupo y con
  el nombre de quien lo autoriza.
- Transporte, tres casos: **flete externo** (se reparte entre las personas
  transportadas; el criterio se cambia y queda escrito en cada importe; si ese
  día no hay trabajo registrado, el flete queda pendiente y no se reparte),
  **vehículo del rancho** (sin importe: su costo sale de los gastos del
  vehículo) y **sin transporte registrado**.
- Todo llega solo al costo de la parcela, con el pago y el flete por separado.

## Decidido por ustedes el 19 de noviembre (ya aplicado)

- Checar salida termina la asignación. Al volver, queda sin asignar; hay un
  botón para continuar la actividad anterior. El tiempo fuera no cuenta.
- El tiempo sin asignar es "por aclarar" y no se distribuye solo.
- Lo trabajado, lo por aclarar y lo improductivo confirmado son cuentas aparte.
- Las horas adicionales se registran y se acumulan sin tocar el pago.

## Lo que sigue, en este orden

2. **Faltas, permisos y salidas antes de tiempo, con su causa**, y quién decide
   el tratamiento. La app no descuenta sola.
3. **Horas extraordinarias reconocidas**: de las adicionales registradas, cuáles
   se autorizan para pago, con quién y cuándo. Acumulados por semana, mes y año.
4. **Centros de costo** para el tiempo ya aclarado (espera, traslado,
   mantenimiento): vehículo, instalación, parcela o cultivo.
5. **Pagos y documentos**: calcular, revisar, autorizar y registrar; pendiente
   por persona; recibos internos en PDF con cálculo detallado, versiones y
   firmas. Un recibo interno no es un CFDI de nómina y lo dirá.
6. **Prestaciones**: aguinaldo, vacaciones, prima vacacional. Provisión
   periódica, ajuste al conocer el importe definitivo, y pago que apunta a lo ya
   reconocido para no contarlo otra vez. Bonos y gratificaciones, aparte.
7. **Distribución de indirectos** con criterio configurable: costo original, lo
   distribuido encima y costo completo, sin tocar el original.

## Decisiones que siguen siendo del rancho

| Tema | Hoy | Hay que decidir |
|---|---|---|
| Día incompleto de un trabajador de planta | Gana el día completo | Qué tratamiento lleva cada causa (abandono, permiso, descanso) y quién lo decide |
| Horario habitual | 8 horas para todos (se cambia en Mano de obra) | Si es distinto por categoría o por temporada |
| Horas extraordinarias | Sólo se registran las adicionales | Cuáles se reconocen, a cómo y quién autoriza |
| Prestaciones | No se provisionan | Con qué base y a qué se cargan (cultivo, parcela, periodo) |
| Tiempo aclarado como espera, traslado, mantenimiento | Queda fuera de las parcelas | A qué centro de costo va cada causa y con qué criterio se distribuye |
| Operador del camión | Trabajador de planta; el rato asignado al vehículo se le carga al vehículo, con lo que ya gana | — (decidido el 19 nov) |
| Costo del vehículo propio | Historial por vehículo y reparto a parcelas: traslado de gente por personas transportadas; lo compartido por horas de uso (se cambia a viajes, km o parejo) | Decidido el 19 nov. Entra a los reportes como costo completo, con el directo siempre a la vista (decidido el 19 nov) |
| Material entregado y no cerrado | Aviso a las 24 h y escala a las 72 h; herramientas 7 y 15 días (los días de herramientas los puse yo: se cambian) | Los plazos de herramientas |
| Herramienta rota o perdida | Baja con responsable, causa, valor y evidencia; la decisión con el trabajador se escribe aparte y la app nunca descuenta | — (decidido el 19 nov) |


## Hecho el 19 nov: faltas y permisos, pagos y recibos

Reglas que dio Luis y cómo quedaron: permiso o descanso autorizado se paga; falta sin justificar no se paga y se puede justificar después con historial; salir antes no descuenta nada solo (lo decide un administrador, con motivo); pago semanal con calendario de asistencia por persona; a la cuadrilla se le entrega al responsable sin dar por pagado a cada integrante; temporales independientes con pago directo; horas adicionales registradas, sin tratamiento automático; recibos internos con versiones que no sustituyen un CFDI.

## Personal que no es de una parcela, prestaciones y cierre (entregado el 19 nov)

Decidido por Luis y ya construido:

| Tema | Cómo quedó | Dónde |
|---|---|---|
| Días pagados sin trabajar | Costo indirecto de personal, con su causa. Regla por concepto (`ind_permiso`, `ind_descanso`, `ind_justificada`, `ind_espera`, `ind_traslado`, `ind_mantenimiento`, `ind_inactividad`, `ind_otra`, `ind_encargado`): repartir según el costo de las actividades de ESA persona en el mes · dejar pendiente · no es de producción. Sin datos → pendiente. Lo «por aclarar» nunca se reparte solo. | `src/personal.js` |
| Prestaciones | Se generan día con día desde la fecha de ingreso (no se capturan). Separado: generado (provisión), determinado, pagado, ajuste, y lo que fue al costo. Determinar sólo agrega la diferencia; pagar no es costo. Mínimos de ley (15 días, 12 días + 2 por año…, 25 %), mejorables por rancho (`prest_*`) y por persona (ficha). La base salarial puede ser distinta por prestación. | `src/prestaciones.js` |
| Vacaciones disfrutadas | Ausencia de clase `vacaciones`: se paga en su semana y baja sus días; NO es costo nuevo. | `src/pagos.js`, `src/personal.js` |
| Encargados | Asistencia por calendario en periodos (`calendario: [{desde, hasta}]`), ausencias, y checador opcional. Su día sin actividad registrada es costo de personal (`ind_encargado`), no una parcela inventada. | `src/pagos.js` |
| Cierre semanal | `cierre_semana` (foto, con versión), `reapertura_semana` (motivo), `confirmacion_pagos` (aparte). Cerrar no congela los hechos: lo posterior se enseña como diferencia. | `src/cierres.js` |

Valores que escogí yo y Luis puede cambiar en «Pagos al personal»: todos los conceptos se reparten por actividades salvo inactividad confirmada y «otra causa» (pendientes); prestaciones se reparten por actividades; aguinaldo 15 días, prima 25 %, cero días extra de vacaciones.

## Saldos iniciales, destajo y autorización (19 nov, segunda vuelta)

| Tema | Cómo quedó |
|---|---|
| Saldo inicial | `prestacion_saldo_inicial`: importe (o días de vacaciones), periodo, fundamento, responsable, evidencia, fecha. No va al costo. Fecha de corte = regla `prest_corte`. |
| Cuenta por persona | saldo inicial · generado después · ajustes · pagado · pendiente (por periodo: lo determinado, o saldo inicial + generado, menos lo pagado). |
| Destajo | Base = promedio de los últimos `prest_dias_promedio` (30) días efectivamente trabajados. Con menos días: «por revisar». Sin días: no hay importe (pendiente de revisión). |
| Autorización | La base valida cada operación sensible (hoja 37). Ver `CLAUDE.md`. |

## Siguiente entrega

1. **Bajas**: partes proporcionales al terminar la relación de trabajo.
2. **Dar un préstamo** también como operación con permiso (decisión de Luis).
3. Que el cierre de mes incluya lo que no tiene parcela (gastos generales), si se decide repartirlo.

## Gastos generales y bajas (19 nov, noche)

- **Gastos generales**: egresos sin parcela ni vehículo. En el cierre de mes van aparte, por categoría, y NO se reparten a parcelas. Política de reparto: pendiente, decisión de Luis (por hectárea, por costo directo, o no repartir).
- **Compras para el almacén**: no son gasto del mes; su costo nace cuando el insumo se consume.
- **Total del rancho** = costo completo de parcelas + pendiente de distribuir + lo que no es de producción + gastos generales. Cada peso está en un solo renglón.
- **Bajas**: de aguinaldo, vacaciones y prima sólo va al costo la diferencia contra lo ya generado. Prima de antigüedad e indemnizaciones son costo nuevo del día de la baja, fuente `bajas`, regla `ind_bajas` (por defecto: pendiente de distribuir).
- **Préstamos**: nunca son costo. Entregar es una cuenta por cobrar; abonar la baja.

## Decisiones del 19 nov (20:38)

- Tres bloques que no se mezclan: **directos de producción**, **indirectos atribuibles a producción** (repartidos + pendientes) y **gastos generales de operación y administración**. Un gasto general nunca sube el costo de una parcela.
- **Bajas**: la prima de antigüedad y las indemnizaciones son gasto laboral general (regla `ind_bajas` = `general`). Se puede cambiar la regla, pero no se reparten solas.
- **Salario mínimo**: sale del catálogo oficial por fecha (`salariosMinimos.js`), no de una regla tecleada.
