# Motor de especialidades y recomendaciones

**Estado (21 nov 2026, 20 h): construidos el catálogo único de actividades con sus requisitos (sección 13) y la
identificación de quién ordenó, capturó, ejecutó y confirmó (sección 14).** Todo lo demás sigue siendo diseño. Las
recomendaciones están apagadas, ningún requisito restringe nada y no se cambió ninguna facultad de mando.
**Empieza por la sección 15: qué se recopila desde la primera jornada real y para qué servirá.**
Complementa `ORGANIZACION.md` (etapas 2 y 5).
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

## 12. Decisiones tomadas por Luis (21 nov) y las que quedan

**Tomadas**

| Tema | Decisión |
|---|---|
| Habilitaciones | Catálogo configurable de actividades y requisitos, con tres clases: legal, interno y experiencia recomendada. No se asume que toda actividad pide habilitación legal. Lo interno no sustituye una obligación de norma. Antes de activar una restricción legal: documentar qué norma es y validar que aplica |
| Validación de especialidades | Sugerida por el sistema · declarada por una persona · validada por un responsable operativo con facultad específica. De inicio, Miguel (operación general) y Fito (operación agronómica), **por confirmar con Dirección**. Los encargados participan según las facultades que se les den |
| Historial anterior | Se conserva la posibilidad de importar libretas. Lo importado se distingue siempre de lo registrado y verificado en AgroGestión. Un antecedente incompleto no se vuelve experiencia validada |
| Calidad de datos | Antes de activar recomendaciones: saber quién EJECUTÓ cada actividad, confirmar la terminación y normalizar actividades. Siempre separados: quién ordenó · quién capturó · quién ejecutó · quién confirmó |
| Recomendaciones | Apagadas hasta tener datos suficientes y pruebas satisfactorias. Sin historial, se dice claro y los responsables pueden declarar y validar capacidades para empezar |
| Costos | Cálculo propio, sin IA, para las recomendaciones ordinarias |

**Segunda ronda de decisiones (21 nov, 17:30)**

| Tema | Decisión | Cómo quedó |
|---|---|---|
| Normas y habilitaciones | El catálogo registra requisitos legales con fundamento, vigencia y responsable de validación. Fito ayuda a identificar requisitos técnicos; la validación normativa la hace una persona competente en la materia. No se activan bloqueos por requisitos no determinados | **Construido** el registro (sección 13). Nada bloquea |
| Umbrales | 10 días distintos y 40 horas en 12 meses, con al menos una jornada confirmada, sólo para SUGERIR. Configurables por especialidad. No acreditan ni autorizan | **Construido** el umbral por actividad. La sugerencia en sí no existe todavía |
| Ejecutores | Las capturas manuales y las aplicaciones distinguen quién ordenó, registró, ejecutó y confirmó; varios ejecutores cuando corresponda; lo histórico incompleto se conserva sin inventar | **Construido** (sección 14) |
| Confirmación | Por responsable autorizado, varias tareas de un equipo en una operación, cada tarea con sus ejecutores, evidencia y estado. La forma definitiva se valida con Miguel | **Diseñado** (sección 16). No construido |
| Libretas | Importación selectiva, primero quienes siguen en Agroselectos; el vínculo nombre ↔ ficha se confirma antes de atribuir experiencia; lo importado no es experiencia validada | **Diseñado** (sección 17). No construido |
| Visibilidad al trabajador | Cada quien ve su experiencia y especialidades sólo con sesión de identidad individual verificada; en teléfonos compartidos con PIN no se enseña | **Diseñado** (sección 18). No construido |
| Bodega | Sus actividades entran al catálogo único sin cambiar su funcionamiento ni sus permisos, sin duplicar y conservando los nombres originales | **Construido** (sección 13) |
| Organización | Pantalla publicada; estructura provisional sin activar; preparar el otorgamiento del permiso a una cuenta autorizada, sin dárselo a terceros | Listo para otorgarse (sección 19). **No se otorgó a nadie** |

**Quedan por decidir**

1. **Quién va a validar las normas.** Hace falta nombrar a la persona competente (asesor de seguridad e higiene, un
   despacho, protección civil…). El catálogo ya pide su nombre y la fecha.
2. **A qué cuenta se le otorga el permiso de administración organizacional** (sección 19).
3. **La forma de confirmar una tarea terminada**, con Miguel (sección 16).
4. **Qué libretas y de qué personas** se importan primero (sección 17).
5. **Cuándo tendrán cuenta propia los trabajadores**, que es lo que les abre la consulta de su experiencia (sección 18).

---

## 13. Lo construido: el catálogo único de actividades (21 nov, 19 h)

Está en la pantalla **Organización**, pestaña **Actividades**.

- **Una sola lista.** Trae las 25 actividades que alguna pantalla ya ofrecía, con su mismo nombre; no inventé ninguna.
  Son las doce de Equipos de trabajo y Cuadrillas (ocho de campo y cuatro de vehículos) y las trece de las capturas por
  oficio: tractorista, dronero, cuadrilla, externo y la captura del administrador, que es la que registra el trabajo
  de bodega. Hay una prueba que lee todas las listas de las pantallas y falla si alguna actividad no está en el catálogo.
- **Bodega.** La bodega es un lugar, no una actividad: la «Limpieza» en bodega es la misma «Limpieza» (el registro ya
  dice que fue en bodega). Sólo «Empaque» es propia de bodega. No se duplicó nada, no cambió cómo se captura ni quién
  puede hacerlo, y lo ya registrado se reconoce con su nombre original.
- **Equipos de trabajo y Cuadrillas ofrecen lo mismo que antes** (sus doce) más lo que una persona agregue. Las
  actividades de oficio se reconocen, pero no se metieron a esas listas.
- **Umbral para sugerir, por actividad**: de arranque 10 días distintos, 40 horas y 1 jornada confirmada en 12 meses.
  Se cambia actividad por actividad, con motivo. No se acepta un umbral sin jornadas confirmadas.
- **Agregar, renombrar o dar de baja** una actividad deja historial. La dada de baja ya no se ofrece, pero lo
  registrado con ella se sigue entendiendo.
- **«Por ligar»**: lo que está escrito en los registros y el catálogo no reconoce (por ejemplo algo tecleado en
  «Otra cosa…») sale en una lista. **No se adivina**: una persona dice a qué actividad corresponde o la da de alta.
  Lo ya registrado no se reescribe.
- **Requisitos por actividad, en tres clases que no se mezclan**: legal, interno y experiencia recomendada.
  - Un requisito **legal** nace «por validar». Para darlo por validado hay que escribir qué norma lo pide y quién
    validó que aplica. La app no decide qué es de ley, y ninguna actividad trae un requisito legal de fábrica.
    Guarda el fundamento, la vigencia (desde y hasta), quién lo validó y cuándo. Con la vigencia terminada lo dice y
    deja de contar como validado.
  - Un requisito **interno** no puede llevar norma ni convertirse en legal: son renglones distintos.
  - La **experiencia recomendada** nunca impide nada.
- **Nada restringe todavía.** Los requisitos son informativos; ninguna asignación se bloquea ni se avisa por ellos.
- Lo captura sólo quien tiene el permiso otorgado, y lo valida la base (la misma hoja 52 de la organización).

Probado con datos inventados: 9 pruebas de cuentas y el recorrido en pantalla (dentro de los 24 pasos de
`pruebas/organizacion_navegador.py`). **Sin validar con nadie del rancho.**

Lo que este catálogo todavía NO hace: no liga las claves de las libretas (A07…) con las actividades, y los registros
siguen guardando el texto tal cual (se normaliza al leer, no al guardar). Las capturas por oficio conservan sus
tarjetas con icono; lo que cambió es que ya todas están en el catálogo.

---

## 14. Lo construido: quién ordenó, quién capturó, quién ejecutó y quién confirmó (21 nov, 20 h)

Cada actividad tecleada y cada aplicación de agroquímicos guarda ahora, aparte y sin mezclar:

| Quién | De dónde sale | Si no se sabe |
|---|---|---|
| **Lo ordenó** | Se escoge en la captura (opcional) | Queda «no se dijo» |
| **Lo capturó** | La sesión que está tecleando | — |
| **Lo ejecutó** | En una actividad, la persona a nombre de quien se registra; en una aplicación, las personas que se marcan como aplicadores (una o varias) | Queda vacío. **Quien registra una aplicación no cuenta como quien la aplicó** |
| **Lo confirmó** | Todavía nadie: la confirmación está diseñada, no construida | Vacío |

- **Varios ejecutores:** una aplicación puede marcar a varias personas. En las actividades, el registro de varias
  personas a la vez sigue creando un renglón por persona (así se costea desde antes) y cada uno lleva a su ejecutor.
- **Cuadrillas:** se anotan como grupo, con cuántas personas. A ningún integrante se le atribuye el trabajo.
- **Registros de antes:** se leen como estaban. De una actividad vieja se sabe a nombre de quién se registró y, a
  veces, quién la capturó. De una aplicación vieja sólo quién la capturó: **no se le supone aplicador**. La pantalla lo
  dice («registro de antes de que se anotara quién aplica»). Nada se reescribió.
- **No cambia pagos ni costos.** Los módulos de dinero siguen leyendo lo mismo que antes; hay prueba de que el costo
  de mano de obra sale idéntico y de que ningún módulo de dinero lee este dato.

Dónde se ve: en la captura de aplicaciones («¿Quién aplicó?», «¿Quién la indicó?») y en su detalle; y en la captura de
actividades del administrador («¿Quién lo ordenó?»).

Probado con datos inventados: 7 pruebas de cuentas y un recorrido de 8 pasos en pantalla
(`pruebas/ejecutores_navegador.py`). **Sin validar con Fito ni con Miguel.**

---

## 15. Qué empieza a recopilar AgroGestión desde la primera jornada real, y para qué servirá

Nada de lo de abajo pide capturar algo «para el motor». Es lo que ya se registra para operar; el motor sólo lo lee.

### Lo que queda registrado en un día normal

| Momento del día | Qué se registra | Quién lo registra | Qué dato deja para después |
|---|---|---|---|
| Víspera o temprano | Las tareas mandadas: quién, a qué, dónde | Quien reparte | Quién **ordenó** y qué se planeó |
| Llegada | Entrada en el checador | Cada trabajador | Que vino y a qué hora |
| Reparto real | A quién se manda, a qué actividad y a qué parcela o vehículo | El encargado | Actividad del catálogo, y quién **mandó** |
| Cambio a media jornada | Otro reparto, con su hora | El encargado | Los minutos reales en cada actividad |
| Durante el día | Avances e incidencias | Quien los reporta | Qué se logró y qué falló |
| Aplicación de agroquímicos | Productos, parcela, **quién aplicó** y quién la indicó | Quien la captura | Experiencia de aplicador, con nombre |
| Actividad tecleada | Actividad, parcela, **quién la hizo**, quién la ordenó | Quien la captura | Experiencia de quien no pasa por el checador |
| Cuadrilla | Quiénes vinieron y a qué | El encargado | Experiencia del grupo (no de cada persona) |
| Salida | Salida en el checador | Cada trabajador | Las horas medidas |
| Cierre de la jornada | Qué se hizo, qué no y por qué | Quien cierra | El estado de cada tarea |

### De cada registro, qué se podrá saber

Por cada persona, actividad y día:

- **en qué actividad trabajó** (ya normalizada contra el catálogo: «regar» y «Riego» cuentan juntas);
- **cuántas horas**, medidas con el checador, no dichas;
- **quién se lo ordenó** y **quién lo registró**;
- **en qué parcela o vehículo**;
- si esa jornada fue **confirmada** por un responsable (cuando exista la confirmación);
- si hubo una **incidencia** ligada.

### Cómo se usará después (todavía apagado)

| Uso | Con qué datos | Cuándo se podrá |
|---|---|---|
| **Ver la experiencia de una persona** | Días, horas y fechas por actividad | En cuanto haya jornadas registradas |
| **Sugerir una especialidad** | Lo anterior contra el umbral de esa actividad, con jornadas confirmadas | Tras unas semanas de operación y con la confirmación funcionando |
| **Validarla** | Un responsable con esa facultad revisa la sugerencia | Cuando Dirección confirme quién valida |
| **Recomendar gente para una actividad** | Especialidad, experiencia reciente, disponibilidad del día, equipo, dónde está, requisitos | Después de órdenes y facultades |
| **Recomendar actividades a gente libre** | Pendientes que ya existen + lo que esa gente sabe hacer | Igual |
| **Avisar de capacidades faltantes** | Cuánta gente habilitada hay contra lo que se necesita | Cuando haya requisitos documentados |

### Lo que conviene cuidar desde el primer día, para que el dato sirva

1. **Que la gente cheque entrada y salida.** Sin salida, el día cuenta pero las horas no.
2. **Que el reparto real se capture cuando pasa**, no al final del día: de ahí salen los minutos por actividad.
3. **Escoger la actividad del catálogo** y no «Otra cosa…». Lo que se escriba libre sale «por ligar» y alguien lo
   tendrá que ligar después.
4. **En las aplicaciones, marcar quién aplicó.** Si no se marca, esa aplicación no le suma experiencia a nadie.
5. **Cerrar la jornada.** Es lo que dice qué se hizo y qué no.

### Lo que NO se recopila ni se usará

- No se guarda un expediente aparte: la experiencia se calcula de estos mismos registros.
- No se califica a las personas ni se usa para pagos, bonos o descuentos.
- Lo importado de libretas viejas va marcado como antecedente, no como experiencia verificada.
- Mientras no haya historial, la app dirá «todavía no hay historial» y los responsables podrán declarar y validar
  capacidades a mano para empezar.

---

## 16. Diseño: confirmar que una tarea se terminó (no construido; se valida con Miguel)

- **Quién confirma:** un responsable con la facultad de «confirmar ejecución» sobre ese equipo. Lo dicho por el
  trabajador («ya terminé») queda como **dice que terminó**, no como confirmado.
- **Varias a la vez:** el responsable ve las tareas del día de su equipo y puede marcar varias y confirmarlas en una
  sola operación. Aun así, **cada tarea guarda su propio registro**: sus ejecutores, su evidencia y su estado.
- **Estados de una tarea:** confirmada · confirmada en parte (con nota de lo que faltó) · no se hizo (con motivo) ·
  sin confirmar.
- **Evidencia:** opcional de arranque (foto, avance en reguladores o surcos, nota). Qué evidencia basta es justo lo
  que hay que preguntarle a Miguel.
- **No toca dinero:** confirmar no paga, no descuenta y no cambia horas. Sólo dice que el trabajo quedó validado.
- **No reescribe:** corregir una confirmación es otro registro con su motivo.
- **Lo valida la base**, como lo demás; esa facultad llega con la etapa 3.

Preguntas para Miguel: ¿confirma tarea por tarea o por equipo y parcela?, ¿al final del día o al terminar cada cosa?,
¿qué pasa con lo que nadie confirma: se queda así o vence?, ¿qué evidencia le sirve?

---

## 17. Diseño: importación selectiva de libretas viejas (no construido)

1. **Se escoge a quién.** La lista arranca con las personas que siguen en Agroselectos (las que están activas en el
   catálogo de personal). No se importa «todo».
2. **Se liga el nombre.** Para cada persona escogida, la app enseña los nombres parecidos que aparecen en las
   libretas. **Una persona confirma** cuáles son ella. Sin esa confirmación no se le atribuye nada. Un nombre de
   libreta puede quedar «sin ligar» para siempre; no pasa nada.
3. **Se liga la actividad.** Las claves de la libreta (A07…) se ligan al catálogo con el mismo mecanismo de «por
   ligar». Clave sin ligar = antecedente sin actividad conocida.
4. **Cómo entra.** Como **antecedente importado**: persona · día · actividad · lugar, con el documento de origen. Sin
   horas (las libretas no las miden) y sin dinero.
5. **Cómo se enseña.** Siempre aparte de lo registrado en AgroGestión: «antecedente de libreta, 2024, sin
   verificar». **No cuenta para el umbral de sugerencia** mientras Luis no decida otra cosa, y nunca se vuelve
   especialidad validada por sí solo: un responsable puede usarlo como apoyo al validar a mano.
6. **Se puede deshacer.** Desligar un nombre quita esos antecedentes de la persona, sin borrar el documento.

Ya existe: leer las libretas y el Excel, guardar el histórico, y comparar dos documentos del mismo día sin contar
doble. Falta: escoger personas, la pantalla para ligar nombres y la vista de antecedentes por persona.

---

## 18. Diseño: que cada trabajador vea su experiencia y sus especialidades (no construido)

- **Sólo con identidad individual verificada**: una cuenta propia, con su sesión ante el servidor.
- **En un teléfono compartido con PIN no se enseña.** Ahí la base ve la cuenta del encargado, no la del trabajador, y
  ya está decidido que un PIN local no equivale a una identidad. Mientras eso no se resuelva, el trabajador no ve su
  expediente en ese aparato, y nadie ve el de otro.
- **Lo que vería, en cinco bloques que no se mezclan:** experiencia observada (días, horas, última vez, por
  actividad) · especialidad sugerida por el sistema · especialidad validada (por quién y cuándo) · capacitaciones
  (con vigencia) · habilitaciones (con vigencia).
- **Lo que no vería:** la experiencia de otras personas, ni comparaciones.
- **La base lo protege:** cada cuenta lee sólo lo suyo; los responsables, lo de su equipo según sus facultades.
- Depende de dos cosas que hoy no existen: cuentas propias para los trabajadores y el aislamiento entre personas en
  aparatos compartidos (pendiente del trabajo de Android).

---

## 19. El permiso de administración organizacional: listo para otorgarse, sin otorgar

- **Dónde:** Arranque → Cuentas. En el renglón de cada cuenta aparece «Capturar la organización (áreas, equipos,
  responsables) y el catálogo de actividades y sus requisitos».
- **Quién lo otorga:** un superadministrador. Queda quién lo dio, a quién y cuándo; se puede retirar.
- **A quién se le puede dar:** a cualquier cuenta con perfil, incluida la del propio superadministrador (ser
  superadministrador no lo trae).
- **Qué da:** capturar el mapa y el catálogo. **Nada más**: ni pagos, ni cierres, ni reglas, ni mando.
- **Estado hoy:** nadie lo tiene. Mientras nadie lo tenga, la pantalla se puede ver pero no capturar, y la estructura
  provisional sigue sin crearse.

No se lo otorgué a ninguna cuenta: lo hace una persona desde la app, cuando Luis decida a quién.
