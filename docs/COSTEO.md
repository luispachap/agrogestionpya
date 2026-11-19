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

## Lo que sigue, en este orden

1. **Cuadrillas eventuales como eventos.** Hoy la cuadrilla se registra con la
   pantalla de antes (un total por día, a una sola parcela). Falta: quiénes
   vinieron cada día, su responsable, precio por día o por unidad, lo que hizo
   cada integrante, flete y otros costos, y repartirlo entre las parcelas y
   actividades que se beneficiaron.
2. **Faltas, permisos y salidas antes de tiempo, con su causa.** Se registra la
   causa y alguien decide el tratamiento. La app no descuenta sola.
3. **Otros conceptos**: horas extra, bonos, gratificaciones, aguinaldo.
   Separando lo que es obligación de ley de lo que es incentivo del rancho.
4. **Pagos**: qué se pagó, qué queda pendiente por persona. Un pago apunta a lo
   que paga; no es un costo nuevo.
5. **Provisiones**: reconocer el aguinaldo y demás prestaciones conforme se
   generan, y ajustar cuando se conoce el importe definitivo. La provisión, el
   ajuste y el pago apuntan al mismo concepto para no contarlo tres veces.
6. **Indirectos y su distribución**, con criterio configurable y a la vista:
   costo original, lo distribuido encima, y costo completo. Una actividad de
   hace meses conserva su costo directo original y enseña aparte lo que se le
   sumó después.

## Decisiones que son del rancho

Están con un valor provisional o sin resolver. Ninguna es técnica.

| Tema | Hoy | Hay que decidir |
|---|---|---|
| Día incompleto de un trabajador de planta | Gana el día completo | Qué pasa por abandono, permiso o descanso autorizado, y quién lo decide |
| Regreso el mismo día | Si sale y vuelve a entrar, sigue asignado a lo último que tenía | Si así trabajan, o si al volver hay que asignarlo otra vez |
| Tiempo fuera de parcelas ya aclarado (espera, traslado, mantenimiento) | Se queda fuera de las parcelas | Si se distribuye como indirecto, y con qué criterio (horas, hectáreas, lo pagado) |
| Flete de la cuadrilla | No está en el modelo nuevo | Entre qué se reparte: personas, lo pagado, o parcelas por igual |
| Horas extra | No existen | Desde qué hora cuentan, a cómo, y quién las autoriza |
| Aguinaldo y prestaciones | No se provisionan | Qué conceptos, con qué base, y a qué se cargan |
| Bonos y gratificaciones | No existen en el modelo nuevo | Cuándo se reconocen: al autorizarse o al pagarse |
| Quién aclara el tiempo sin asignar | Administradores y encargados | Si el encargado puede aclarar el tiempo de su propia gente |
