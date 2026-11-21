# Motor de especialidades y recomendaciones

**Estado: DISEÑO. Nada de esto está construido.** (21 nov 2026) Complementa `ORGANIZACION.md` (etapas 2 y 5).
Pedido por Luis: que las especialidades no sean sólo etiquetas tecleadas, sino que salgan también del trabajo real; y
que AgroGestión pueda sugerir gente para una actividad y actividades para la gente disponible. No se activa ninguna
recomendación ni se cambia ningún permiso hasta que el diseño se apruebe.

---

## 1. Qué datos reales hay para sustentarlo

Lo revisé en la base de producción (sólo conteos, sin leer datos de nadie) y en el código.

### En la base, hoy

| Dato | Cuántos hay |
|---|---|
| Trabajadores en el catálogo | 0 |
| Actividades registradas | 0 |
| Tareas del plan | 0 |
| Marcas del checador, repartos, avances, cierres de jornada | 0 |
| Aplicaciones | 0 |
| Rayas históricas importadas | 0 |

**Conclusión honesta: hoy no hay historial real dentro de AgroGestión.** La operación todavía no arranca en el sistema.
El motor se puede diseñar y probar con datos inventados, pero **no va a poder sugerir nada de nadie hasta que haya
semanas de operación registrada**. Mientras tanto dirá «todavía no hay historial», no inventará experiencia.

### Lo que el sistema SÍ va a registrar cuando opere (y de dónde saldría la experiencia)

| Fuente que ya existe | Qué dice de una persona | Qué tan firme es |
|---|---|---|
| Checador × Equipos de trabajo | Quién, qué actividad, en qué parcela, cuántos minutos medidos | Alta: horas medidas, no tecleadas |
| Operador de un vehículo (reparto a un vehículo) | Quién manejó qué y cuánto tiempo | Alta |
| Cuadrillas (registro del día) | Quiénes vinieron, a qué actividad; en destajo, cuánto hizo cada quien | Media: lo captura el encargado, sin checador |
| Actividades tecleadas | Actividad, parcela, horas dichas | Baja: muchas veces sólo dice quién la CAPTURÓ |
| Plan del día | Lo que se le mandó, y si contestó «hecha» | No es trabajo: es plan y lo dicho por la persona |
| Cierre de la jornada | De cada tarea: hecha, se trabajó ahí, no se hizo y por qué | Media; sube cuando exista la confirmación del encargado |
| Avances | Cuánto se avanzó en una parcela | No dice quién: sólo cuántas personas |
| Incidencias | Problemas del día | Contexto |

### Lo que existe fuera del sistema

- **Libretas de rayas y el Excel de 2024**: persona · día · actividad (clave) · ubicación. La importación ya existe, pero
  esos nombres **no están ligados a las personas del catálogo** (el cotejo sólo dice «posibles») y las claves de
  actividad todavía no tienen significado confirmado. Podrían dar experiencia ANTIGUA, sólo si una persona liga cada
  nombre con su ficha. Es decisión de Luis si vale la pena.

### Cuatro huecos que hay que cerrar antes de que el motor sirva

1. **No hay un catálogo único de actividades.** Hoy conviven la lista de Equipos de trabajo, los tipos de la actividad
   tecleada, lo que alguien escribe en «Otra cosa…» y las claves de las libretas. Sin decir que «Riego», «regar» y la
   clave correspondiente son lo mismo, la experiencia se parte en pedazos.
2. **Nadie confirma todavía una tarea terminada** (es uno de los criterios pendientes con Miguel). Sin eso sólo hay
   «horas registradas», no «trabajo validado».
3. **La aplicación de agroquímicos guarda quién la capturó, no quién aplicó.** Para experiencia de aplicador hace
   falta ese dato.
4. **La actividad tecleada a veces no dice quién la hizo**, sólo quién la registró.

---

## 2. Los cuatro niveles (decididos por Luis)

| Nivel | Qué es | De dónde sale | Para qué sirve | Para qué NO sirve |
|---|---|---|---|---|
| **1. Experiencia observada** | Lo que la persona ha hecho, según registros verificables | Se CALCULA; nadie la teclea ni se guarda aparte | Informar y sugerir | No es competencia validada ni autorización |
| **2. Especialidad declarada** | «Es regador» | La dice la persona, su responsable, o la SUGIERE el sistema; la valida un responsable | Buscar y recomendar gente | No autoriza trabajo regulado |
| **3. Capacitación acreditada** | Tomó el curso: fecha, quién lo dio, evidencia, vigencia | La registra quien tenga esa facultad | Constancia; requisito de algunas habilitaciones | Por sí sola no autoriza |
| **4. Habilitación específica** | Autorización expresa para una actividad que la exige, con vigencia | La otorga quien tenga la facultad; se puede retirar | **Lo único que autoriza** trabajo regulado o peligroso | — |

El nivel 2 tiene tres estados que nunca se confunden en pantalla:

- **Sugerida por el sistema** — hay experiencia suficiente; nadie la ha confirmado.
- **Declarada** — alguien la dijo; puede no tener experiencia registrada que la respalde.
- **Validada** — un responsable con facultad la confirmó, con fecha y nombre.

**Reglas que no se rompen**
- Haber hecho algo **nunca** se convierte solo en especialidad validada, y **jamás** en habilitación.
- Una sugerencia que el responsable rechaza se guarda con su motivo y no vuelve a salir hasta que haya evidencia nueva.
- **Habilitación legalmente obligatoria** (la que pide una norma para actividades de riesgo): **no hay excepción
  interna que la sustituya.** Sin ella, o vencida, la persona no se puede asignar a esa actividad, la pida quien la
  pida. Esto corrige mi propuesta anterior de «excepción firmada».
- **Habilitación interna** (la que el rancho decide pedir): si se admite excepción, y de quién, lo define Dirección.
- Cada actividad del catálogo dice qué pide: nada · habilitación interna · habilitación legal. **Qué actividades son
  de obligación legal lo tiene que decir alguien que conozca la norma; la app no lo decide.**

---

## 3. Experiencia observada: cómo se calcula

Es una cuenta, sin IA. Para cada persona y actividad:

| Medida | Cómo |
|---|---|
| Días distintos | Días en que tiene trabajo verificable en esa actividad |
| Horas medidas | Sólo las del checador cruzadas con el reparto real |
| Primera y última vez | Fechas |
| Recencia | Últimos 3 meses · último año · más de un año · más de tres años |
| Calidad de la evidencia | Cuánto es medido, cuánto capturado por un encargado, cuánto sólo tecleado |
| Confirmaciones | Cuántas de esas jornadas tienen la tarea confirmada por un responsable |
| Confianza | Suficiente · poca · contradictoria |

**Lo que cuenta y lo que no**

| Situación | Cuenta como experiencia |
|---|---|
| Horas medidas en una actividad | Sí, las horas medidas |
| Entrada sin salida | El día sí; las horas no («tiempo sin saber») |
| Reasignación a media jornada | Cada tramo con sus minutos reales. La suma del día nunca pasa de lo que estuvo en el rancho |
| Tarea planeada que se cambió o se canceló | No. El plan no es trabajo |
| Registro cancelado | No |
| El mismo día tecleado y además medido | Una sola vez (la regla de «una sola fuente» que ya existe) |
| Tiempo en el rancho sin asignar | No es de ninguna actividad |
| Tarea que la persona dice «hecha» y nadie confirmó | Es experiencia registrada, **sin validar**. No sube de categoría |
| Sólo estar en el plan | No |

**Experiencia antigua:** no se borra ni se cuenta como reciente. Se dice: «hizo esto 40 días, el último hace dos años».

**Historial incompleto o contradictorio:** se marca la confianza y se dice el porqué («12 de sus 30 días no tienen
salida registrada»; «el mismo día aparece en dos actividades a la misma hora»). Con confianza «contradictoria» no se
sugiere especialidad.

**Cuándo sugiere una especialidad:** cuando la experiencia pasa de un mínimo configurable por el rancho. Propuesta de
arranque, a revisar con Miguel: 10 días distintos y 40 horas medidas en el último año, con al menos una jornada
confirmada. La sugerencia enseña exactamente esos números. Acumular horas sin ninguna confirmación **no** genera
sugerencia.

**No se guarda un expediente aparte.** La experiencia se recalcula de los mismos registros de siempre; si un registro
se corrige o se cancela, la experiencia cambia sola. No hay segunda fuente de verdad.

---

## 4. Recomendación de personal

Al crear una orden o una actividad, la app puede proponer gente. **Es una lista con razones, no una decisión.**

**Primero, lo que descarta (y lo dice):**
- No tiene la habilitación legal vigente que pide la actividad.
- Tiene ausencia registrada ese día.

**Después, cómo ordena** (reglas a la vista, no una calificación oculta):
1. Especialidad validada → sugerida o con experiencia reciente → declarada sin experiencia → sin experiencia.
2. Disponible ese día y hora → ocupada (se enseña en qué y con qué prioridad).
3. Del equipo de quien pide → de apoyo ya acordado → de otro equipo (pide solicitud de apoyo).
4. Ya está ese día en ese rancho o parcela → está en otro lado.

**Cada persona propuesta lleva sus motivos y sus límites**, por ejemplo:

> **Persona A** — Regadora validada por su responsable en marzo. 62 días de riego en el último año, 9 confirmados.
> Es de este equipo y hoy no tiene tarea.
> *Límite:* su última jornada de riego fue hace cuatro meses.

> **Persona B** — Sin especialidad validada. La app lo sugiere por 14 días de riego medidos este año.
> *Límites:* nadie ha validado la especialidad. Hoy está asignado en otra parcela (prioridad media): moverlo es una
> reasignación.

- El encargado escoge, dentro de sus facultades. Puede escoger a alguien que no se propuso.
- Se guarda si siguió la sugerencia o no, sólo para medir si las sugerencias sirven (como ya se hace con la lectura de
  papeles: sin decisiones revisadas no hay tasa).
- La app **nunca asigna sola**, y una recomendación no salta ninguna facultad ni ningún conflicto.
- Se enseña también la carga: «lleva seis días seguidos en esta actividad». Es información, no regla.

---

## 5. Recomendación de actividades (el camino inverso)

Cuando hay gente disponible (checó y no tiene reparto, o terminó lo suyo), la app puede enseñar **trabajo pendiente
que ya existe**:

- órdenes abiertas sin gente suficiente;
- tareas del plan que se quedaron sin persona;
- lo que pasó de jornadas anteriores;
- avances que quedaron «pendiente».

Se filtra por lo que esa gente puede hacer (especialidad, habilitación), por prioridad y fecha, y por los recursos
que el sistema ya conoce: que la máquina no esté reportada descompuesta, que el insumo esté en el almacén, y **que la
parcela no esté en periodo de reentrada** (seguridad de personas: una parcela en reentrada nunca se propone).

Lo que NO hace:
- **No inventa tareas.** Si no hay pendiente registrado, no hay propuesta.
- **No da por autorizado nada.** Cada propuesta dice «falta que la asigne alguien con esa facultad».
- Si no hay nada compatible, lo dice y dice por qué («hay tres pendientes, los tres piden habilitación de aplicador y
  ninguno de los disponibles la tiene»). Eso alimenta la sección siguiente.

---

## 6. Necesidades de personal y capacidades faltantes

Con los mismos datos, sin nada nuevo que capturar:

| Aviso | Cuándo sale |
|---|---|
| Capacidad faltante | Hay órdenes o tareas que piden una especialidad o habilitación y no alcanza la gente que la tiene |
| Una sola persona | Sólo una persona tiene la habilitación para algo que se hace seguido |
| Habilitación por vencer | Faltan menos de N días (configurable) |
| Gente sin tarea compatible | Personas disponibles varios días sin pendientes que puedan hacer |
| Especialidad sin respaldo | Declarada hace tiempo y sin ningún registro de trabajo en ella |
| Sugerencias sin atender | Especialidades sugeridas que nadie ha validado ni rechazado |

Son avisos para quien decide. No contratan, no capacitan ni habilitan a nadie.

---

## 7. Aprendizaje continuo

No hay nada que «entrenar». Cada vez que se confirma o se cierra una tarea, ese registro ya existe y la experiencia se
recalcula. Lo que hay que cuidar:

- **Horas sin validar no premian.** Suman como experiencia registrada, pero no generan sugerencia de especialidad sin
  confirmaciones.
- **Reasignaciones, duplicados y cancelaciones no inflan** (sección 3, y es lo mismo que ya probó el recorrido de los
  siete trabajadores).
- Una tarea confirmada como **mal hecha o con incidencia** queda ligada a esa experiencia y se enseña; no se esconde
  dentro de un promedio.
- La experiencia **no es una calificación de la persona** y no se usa para pagos, bonos ni descuentos. Ningún módulo
  de dinero la lee.

---

## 8. Arquitectura y costos

- **Todo el motor es cálculo propio**: contar días y horas, comparar fechas, aplicar reglas. Costo de IA: cero.
- **Dónde podría servir la IA, y sólo a petición de una persona:** proponer en lote equivalencias de actividades
  escritas a mano («echar agua a la 4» → Riego) para que alguien las confirme. Una vez confirmada, la equivalencia es
  una regla y no se vuelve a preguntar. Pasaría por el tope mensual que ya existe y quedaría registrada como cualquier
  otra llamada.
- La explicación de cada recomendación sale de plantillas con los números reales, no de un modelo.

---

## 9. Integración con lo existente

| Pantalla | Qué agrega |
|---|---|
| **Organización** (etapa 1, ya construida) | Dice el equipo y el responsable de cada quien; de ahí salen «de este equipo» y quién valida |
| **Ficha de la persona** | Pestaña con los cuatro niveles, cada uno con su origen. La experiencia, con su detalle y su confianza |
| **El día → Reparto** y **Equipos de trabajo** | Al escoger actividad: «a quién sugerimos y por qué». Al haber gente libre: «qué hay pendiente que puedan hacer» |
| **Órdenes** (etapa 4) | La orden por objetivo usa la recomendación para que el responsable la reparta |
| **Jornada** | Su cierre y sus confirmaciones son la evidencia; no se captura nada más |
| **Checador** | Sin cambio |

No hay expediente nuevo: especialidades, capacitaciones y habilitaciones son hechos con fecha (como la organización);
la experiencia se calcula.

---

## 10. Pruebas (con datos inventados)

| # | Escenario | Qué debe comprobarse |
|---|---|---|
| 1 | Trabajador con varias especialidades | Cada una con su nivel y su origen; se le propone para cada actividad con razones distintas |
| 2 | Especialidad sugerida, no validada | Sale como «sugerida», con sus números; se puede validar o rechazar; rechazada no vuelve sin evidencia nueva |
| 3 | Experiencia antigua | Se dice la fecha de la última vez; queda por debajo de quien tiene experiencia reciente; no se borra |
| 4 | Trabajador ocupado en otra parcela | Aparece con su límite («está en tal parcela, prioridad tal»); escogerlo abre reasignación, no lo mueve |
| 5 | Actividad que pide autorización específica | Sin habilitación legal vigente: descartado y dicho. Ni con mucha experiencia ni con excepción se propone |
| 6 | Personal disponible sin tareas compatibles | Dice que no hay y por qué; no inventa tarea; sale el aviso de capacidad faltante |
| 7 | Historial incompleto o contradictorio | Confianza «poca» o «contradictoria» con su motivo; no sugiere especialidad |
| 8 | Reasignaciones | Un día partido en dos actividades da los minutos de cada una; la suma no pasa de su tiempo en el rancho |
| 9 | Tarea cancelada o cambiada | No da experiencia |
| 10 | Mismo día tecleado y medido | Cuenta una vez |
| 11 | Horas sin ninguna confirmación | Experiencia registrada, sin sugerencia de especialidad |
| 12 | Habilitación vencida ayer | Hoy ya no se propone; se dice «venció el día tal» |
| 13 | Rancho sin historial | Dice «todavía no hay historial»; no propone por experiencia |
| 14 | Dinero | Ningún módulo de pagos o costos lee la experiencia ni las recomendaciones |

---

## 11. Cómo entra al plan por etapas

| Etapa | Qué | Depende de |
|---|---|---|
| **2a** | Catálogo único de actividades y qué pide cada una. Especialidad declarada, capacitación y habilitación, con historial | Aprobar este diseño; quién dice cuáles son de obligación legal |
| **2b** | Experiencia observada: sólo se VE en la ficha. Sin sugerencias ni recomendaciones | Que haya operación registrada |
| **2c** | Sugerencia de especialidad y su validación | Que alguien confirme tareas (criterio pendiente con Miguel) |
| **5b** | Recomendación de personal y de actividades; avisos de capacidades faltantes | Órdenes (etapa 4) y facultades (etapa 3) |

Las recomendaciones nacen apagadas y se encienden cuando Luis lo apruebe.

---

## 12. Decisiones que no son mías

1. ¿Qué actividades piden habilitación **legal** y cuáles sólo interna? (Lo debe decir quien conozca la norma.)
2. ¿Quién valida una especialidad: el responsable del equipo, o sólo Miguel y Fito?
3. Los mínimos para sugerir (10 días, 40 horas, una confirmación): ¿se parecen a lo que Miguel consideraría «ya sabe»?
4. ¿Se ligan las libretas viejas a las personas para tener experiencia antigua, o se empieza desde cero?
5. ¿Los trabajadores pueden ver su propia experiencia y sus especialidades?
6. Para experiencia de aplicador: ¿se empieza a capturar quién aplicó, además de quién registró?
