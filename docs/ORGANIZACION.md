# Organización, especialidades, facultades de mando y órdenes delegables

**Estado (21 nov 2026, 18 h): la ETAPA 1 está construida y probada con datos inventados** (autorizada por Luis; sección 7).
**Las etapas 2 a 6 siguen siendo sólo diseño y NO están autorizadas.** No se cambió ningún permiso. La estructura real
no se activa hasta validarla con Miguel, Fito y Dirección. El motor de especialidades está en `ESPECIALIDADES.md`.
Pedido por Luis: que Agroselectos pueda reorganizarse sin tocar el código cada vez que cambia un encargado, un
trabajador o un responsable. Este documento trae el diagnóstico de lo que ya existe, el diseño, el recorrido de prueba
y el plan por etapas. La construcción empieza cuando Luis la autorice; los permisos definitivos los confirma Dirección.

---

## 1. Diagnóstico: qué hay hoy y qué tan compatible es

### Lo que ya existe y se reutiliza tal cual

| Pieza que ya existe | Para qué sirve en este diseño |
|---|---|
| **Eventos** (lo que pasa se guarda una vez, no se edita ni se borra, lleva quién y la cuenta que lo subió, sellada por la base) | Es la base de todo el historial: organización, órdenes, delegaciones y cierres nacen como eventos. Así un cambio de hoy no reescribe lo de ayer |
| **Permisos por cuenta y por operación** (hoja 37: la base autoriza o rechaza cada operación sensible con la cuenta de la sesión; los otorga un superadministrador; queda quién y cuándo) | Es exactamente el mecanismo para las «facultades de mando». No hay que inventar otro: se agregan operaciones nuevas |
| **Permisos que no vienen con el puesto** (ver evidencia y supervisar conversaciones no los tiene ni el superadministrador si no se le otorgan) | El mismo criterio para mando: tener un cargo no da facultades |
| **Reglas del rancho con fecha** (los ajustes configurables ya son eventos: valen desde una fecha y lo anterior se conserva) | El modelo para todo lo configurable de la organización |
| **«Depende de la fecha»** (el cultivo de una parcela sale del ciclo que tenía ese día) | El mismo modelo para «de qué equipo era y quién era su responsable ese día» |
| **El plan del día** (tareas mandadas en El día → Reparto; cambiar deja el renglón anterior guardado) | Las tareas derivadas de una orden SON estas mismas tareas. No hay segundo planeador |
| **Equipos de trabajo** (el reparto real: a quién se mandó, a dónde y desde qué hora) y **Checador** | Siguen siendo la única fuente de horas. Las órdenes no crean horas |
| **Jornada** (junta plan, asistencia, trabajo, avances, incidencias; cierre con foto) | Se le agrega de qué orden viene cada tarea; el cierre alimenta el avance de la orden |
| **Avances e incidencias** | Se ligan a la orden para ver su avance y sus problemas |
| **Mensajes y avisos al teléfono** (sin texto sensible) | Para avisar de órdenes, solicitudes de apoyo y conflictos |
| **Bitácora de sólo inserción** | Rastro de los cambios de permisos |
| **Agroquímicos, aplicaciones y ventanas de reentrada** | La orden de aplicación de Fito se apoya en lo que ya hay |

### Lo que NO existe hoy

| Falta | Detalle |
|---|---|
| Áreas y equipos permanentes | El «equipo» de hoy es un nombre que se teclea al repartir; no se guarda quién pertenece a cuál |
| Responsable y superior de cada quien | No hay ningún dato de quién depende de quién |
| Especialidades, capacitación y habilitación | La ficha del trabajador no trae ninguna de las tres |
| Órdenes por objetivo | Sólo hay tareas persona por persona, para hoy o mañana |
| Delegar y dividir | No existe |
| Solicitud de apoyo y conflictos de disponibilidad | No existe. Hoy se puede mandar a la misma persona a dos lugares y nadie avisa |
| Facultades de mando separadas | Hoy mandan «administrador y encargado», en bloque |

### Choques con lo existente que hay que resolver (encontrados al revisar)

1. **Las facultades de hoy están escritas por perfil dentro del código.** «Reparte un administrador o un encargado»,
   «cierra la jornada un administrador o un encargado». Eso es justo lo que hay que dejar de hacer. Se cambia por
   etapas, sin romper lo que funciona.
2. **Fito no puede mandar tareas hoy.** En la base, el perfil de agrónomo sólo LEE el plan; no puede crear ni cambiar
   tareas. Para que organice sus aplicaciones por su cuenta hace falta un cambio de permisos en la base (etapa 3,
   con autorización).
3. **Dirección es de sólo lectura hoy.** El perfil de dueño no crea nada. «Dirección encarga un objetivo» también pide
   un cambio de permisos, y hay que decidir si lo captura Dirección o alguien a su nombre.
4. **El plan del día no son eventos, es una tabla que se actualiza.** Conserva su historial dentro del renglón, pero la
   base no lo valida operación por operación como hace con lo sensible. Para que «asignar», «delegar» y «cerrar» se
   validen en la base, las ÓRDENES nacen como eventos y a la tabla del plan se le agrega un candado propio. No se
   migra el plan existente.
5. **La gente de campo entra con PIN en el teléfono de su encargado.** Para la base, quien sube es la cuenta del
   encargado. Ya está decidido que un PIN no equivale a una identidad ante el servidor. Consecuencia: **las facultades
   de mando sólo las ejerce quien tiene cuenta propia**. Un trabajador con PIN puede reportar («ya terminé», un avance,
   una incidencia), pero no confirmar, cerrar ni reasignar.
6. **Las cuadrillas eventuales** ya tienen su responsable y su registro del día. Entran a la organización como un
   equipo de clase «eventual», sin cambiar cómo se registran ni cómo cobran.
7. **Lo pendiente de validar con Miguel** (los seis criterios de la jornada y «Reasignar equipo») queda absorbido
   aquí: quién confirma una tarea terminada es una facultad; reasignar a varios es la operación de la etapa 5.

**Conclusión del diagnóstico:** es compatible. No hay que rehacer nada de lo construido; hay que agregar la
organización como eventos, ampliar el mecanismo de permisos que ya existe y enlazar las órdenes con el plan. El riesgo
principal no es técnico: es definir bien quién puede qué, y eso es decisión de Dirección.

---

## 2. Diseño

Regla general: **todo es un evento con fecha «desde»**. La organización de un día cualquiera se CALCULA de los eventos
vigentes ese día. Ningún nombre de persona, equipo o área va escrito en la lógica.

### 2.1 Estructura organizacional

| Hecho que se registra | Qué dice |
|---|---|
| **Unidad** (alta, cambio o cierre) | Un área o un equipo: nombre, clase (área · equipo de planta · cuadrilla eventual), de qué unidad depende, desde cuándo |
| **Cargo** | Tal persona es responsable de tal unidad, desde tal fecha. Cambiar de responsable es otro hecho; el anterior queda con su fecha de término |
| **Adscripción** | Tal persona pertenece habitualmente a tal equipo, desde tal fecha. Una persona tiene UNA adscripción habitual a la vez |
| **Apoyo temporal** | Tal persona colabora con otro equipo del día X al día Y (o unas horas). No cambia su adscripción habitual |

- El superior de alguien no se captura: sale de la cadena (su equipo → el responsable → la unidad de arriba → su
  responsable).
- Cada hecho lleva quién lo registró, cuándo y por qué.
- Una pregunta siempre trae fecha: «¿de qué equipo era el día 12?» contesta con lo vigente el 12.
- Quien no tiene equipo sale como «sin equipo», a la vista. No se le supone uno.

### 2.2 Especialidades y capacidades — cuatro niveles (decididos por Luis; detalle en `ESPECIALIDADES.md`)

| Nivel | Qué es | Autoriza trabajo regulado |
|---|---|---|
| 1. Experiencia observada | Lo que ha hecho, calculado de registros verificables | No |
| 2. Especialidad declarada (sugerida por el sistema · declarada · validada por un responsable) | «Es regador» | No |
| 3. Capacitación acreditada | Curso con fecha, evidencia y vigencia | No por sí sola |
| 4. Habilitación específica | Autorización expresa, con vigencia | **Sí: es lo único que autoriza** |

- La experiencia nunca se convierte sola en especialidad validada ni en habilitación.
- **Una habilitación legalmente obligatoria no tiene excepción interna que la sustituya.** (Sustituye mi propuesta
  anterior de «excepción firmada».) Para las habilitaciones que el rancho pide por decisión propia, Dirección dirá si
  admite excepción y de quién.
- El diseño ya contempla detectar necesidades de personal y capacidades faltantes, y recomendar gente para actividades
  compatibles (`ESPECIALIDADES.md`, secciones 4 a 6). Todo eso nace apagado.

### 2.3 Facultades de mando

Se usan los **permisos por cuenta y por operación que ya existen**, con operaciones nuevas:

| Facultad | Qué deja hacer |
|---|---|
| Crear objetivos y órdenes | Dar de alta una orden |
| Asignar trabajadores | Mandar tareas a personas |
| Delegar órdenes | Pasar una orden, o parte, a otro responsable |
| Reasignar entre equipos | Mover gente de un equipo a otro, y resolver conflictos |
| Modificar prioridades | Cambiar prioridad o fecha de una orden |
| Confirmar ejecución | Dar por ejecutada una tarea (lo dicho por el trabajador es «dice que terminó») |
| Cerrar tareas y órdenes | Cerrarlas con su resultado |
| Supervisar y autorizar | Autorizar excepciones (por ejemplo, asignar sin habilitación) |
| Configurar la organización | Dar de alta unidades, cargos y adscripciones |
| Habilitar personal | Registrar capacitaciones y habilitaciones |

Dos cosas nuevas sobre lo que ya hay:

- **Alcance.** Cada facultad se otorga sobre algo: toda la empresa, un área o un equipo. Un encargado puede «asignar
  trabajadores» sólo en su equipo; otro, en toda un área.
- **Plantillas.** Para no otorgar diez facultades una por una, hay paquetes sugeridos (por ejemplo «responsable de
  equipo»). Aplicar una plantilla es un acto de una persona y deja anotada cada facultad. **Nombrar a alguien
  responsable de un equipo NO le da facultades**: la pantalla avisa «este responsable todavía no tiene facultad de
  asignar» y alguien decide.

Reglas que no se rompen:
- La base valida cada operación con la cuenta de la sesión, no con lo que diga el aparato.
- Las facultades las otorga y las retira un superadministrador; queda quién, a quién, cuál, con qué alcance y cuándo.
- Retirar una facultad no deshace lo que la persona hizo cuando la tenía.
- Sólo cuentas propias. Nunca una cuenta compartida.

**Configuración inicial propuesta (pendiente de que Dirección la confirme; no se instala sin eso):**

| Quién | Facultades | Alcance |
|---|---|---|
| Dirección | Crear objetivos, modificar prioridades, supervisar y autorizar | Toda la empresa |
| Miguel | Todas las operativas | Toda la empresa |
| Fito | Todas las operativas en lo agronómico; habilitar aplicadores | Su área; el resto según decida Dirección |
| Encargados | Asignar, confirmar ejecución, cerrar tareas | Su equipo |

Siguen aparte, sin cambio, los controles de dinero (pagos, cierres, préstamos): una facultad de mando no da ninguno.

### 2.4 Órdenes de trabajo delegables

| Hecho | Qué dice |
|---|---|
| **Orden** | Qué se quiere («Deshierbar R4»), dónde, para cuándo, prioridad, a quién va dirigida y quién la da |
| **Delegación** | Quien la tiene se la pasa a otro, completa o una parte. La original no se toca |
| **División** | El responsable la parte en tareas. Las tareas son las del plan del día de siempre, con la marca de su orden |
| **Cambio** | Prioridad, fecha o alcance, con quién y por qué |
| **Confirmación** | Alguien con facultad confirma lo ejecutado, con evidencia si se pide |
| **Cierre** | Resultado: cumplida, cumplida en parte, cancelada; con nota |

- Una orden puede ir a **una persona, un encargado (el cargo, no el nombre), un equipo o un área**. Si va al cargo y
  mañana cambia el encargado, la orden abierta la ve el nuevo; lo ya hecho sigue a nombre de quien lo hizo.
- Una orden por objetivo **no obliga a nombrar trabajadores**: eso lo hace quien la recibe.
- Una orden dura varios días; la jornada es de un día. El avance de la orden es la suma de sus jornadas.
- Desde la orden original se ve todo: a quién se delegó, en qué tareas se dividió, quién trabajó cada día, avances,
  incidencias, cambios y resultado.
- **Una orden nunca crea horas, pagos ni costos.** Las horas siguen saliendo sólo del checador y del reparto real.
- Una orden vencida sin cerrar no se cierra sola: sale como vencida.

La cadena completa, que es lo que da la trazabilidad:

    objetivo → orden → (delegación) → tarea del plan → reparto real → avances e incidencias → cierre de la jornada → cierre de la orden

### 2.5 Colaboración entre equipos y conflictos

| Hecho | Qué dice |
|---|---|
| **Solicitud de apoyo** | Un responsable pide gente a otro equipo: cuántos o quiénes, con qué especialidad, cuándo, para qué orden |
| **Respuesta** | El responsable del equipo que presta acepta, rechaza o propone otra cosa, con motivo |
| **Resolución** | Si no se ponen de acuerdo, decide quien tenga facultad de reasignar sobre los dos equipos, con motivo |

**Conflictos: se calculan, no se guardan.** Hay conflicto cuando la misma persona:
- tiene dos tareas vigentes que se enciman el mismo día y hora;
- está pedida de apoyo por un equipo mientras el suyo la tiene asignada;
- tiene una ausencia registrada ese día;
- no tiene la habilitación que pide la actividad.

Qué pasa con un conflicto:
- Se avisa a los responsables afectados (aviso al teléfono, sin texto sensible) y sale en El día.
- **No se resuelve solo.** Lo resuelve quien tenga la facultad, según prioridad; queda quién decidió y por qué.
- La tarea que pierde no se borra: queda «cambiada» con su motivo, como ya funciona hoy.
- Una persona sólo puede estar en un lugar a la vez en el reparto real; eso ya lo garantiza Equipos de trabajo.

**«Reasignar equipo»** (la propuesta que quedó pendiente) es la operación de esta parte: varios trabajadores, destino,
tarea, hora y motivo en una sola captura. Dar la instrucción no mueve horas; las horas empiezan cuando alguien confirma
que llegaron. La variante exacta se decide con lo que diga Miguel.

### 2.6 Integración con lo que ya hay (sin sistema paralelo)

| Pantalla | Qué cambia |
|---|---|
| **El día → Reparto** | Aparecen las órdenes abiertas de quien entra, para dividirlas en tareas. La tarea guarda de qué orden viene. Se puede repartir por equipo, no sólo por persona |
| **Equipos de trabajo** | Ofrece primero a la gente del equipo y la que está de apoyo. El reparto real guarda a qué orden corresponde. Sigue siendo la única fuente de horas |
| **Checador** | Al checar, cada quien ve su tarea y de qué orden es. Sigue sin crear la asignación real |
| **Mensajes** | Avisos de orden recibida, apoyo solicitado y conflicto. Una orden dicha a AgroGestión se PROPONE; no se crea sola |
| **Jornada** | Cada tarea dice su orden. Al cerrar el día, la orden recibe su avance. Los cambios de plan ya se ven |
| **Pantalla nueva: Organización** | Áreas, equipos, responsables, adscripciones, especialidades, habilitaciones y facultades, con su historial |
| **Pantalla nueva: Órdenes** | Las órdenes dadas y recibidas, con todo lo que cuelga de cada una |

### 2.7 Seguridad y auditoría

- **La base decide.** Cada operación de mando se valida con la cuenta de la sesión y con su alcance. Esconder un botón
  no protege nada; la pantalla sólo evita ofrecer lo que la base va a rechazar.
- **Lo rechazado se guarda y no cuenta**, igual que hoy con lo sensible, para que se vea quién intentó qué.
- **Cada hecho guarda en calidad de qué se hizo**: la cuenta, el cargo y la unidad que la persona tenía EN ESE MOMENTO,
  copiados al evento. Si mañana se reorganiza, lo de ayer sigue diciendo quién lo ordenó y con qué cargo.
- **La organización se consulta con fecha.** Un reporte de octubre usa la organización de octubre.
- **Nadie se da facultades a sí mismo** y nunca queda la empresa sin alguien que pueda otorgarlas (la misma regla que
  ya protege al último superadministrador).
- Quien entra con PIN queda anotado como «identificado por PIN, en el aparato de tal cuenta».

---

## 3. Recorrido de prueba (para escribirlo como prueba automática en cada etapa)

Con gente, equipos y parcelas inventados. Cada escena dice qué se comprueba.

| # | Escena | Qué debe comprobarse |
|---|---|---|
| 1 | **Dirección encarga un objetivo a Miguel**: «Deshierbar R4 antes del viernes», prioridad alta | La orden nace sin trabajadores. Queda quién la dio y en calidad de qué. Sin la facultad, la base la rechaza |
| 2 | **Miguel la delega a un encargado** | La orden original se conserva. Se ve la cadena Dirección → Miguel → encargado. Miguel sigue viéndola |
| 3 | **El encargado reparte a su equipo** | Las tareas salen en el plan del día con la marca de la orden. Sólo puede asignar gente de su alcance. Al checar, cada quien ve la suya |
| 4 | **Fito organiza una aplicación por su cuenta** | No pasa por Miguel. Sólo se asigna a quien tiene habilitación de aplicador vigente; sin ella, pide excepción firmada. Queda ligada a la aplicación y a su reentrada |
| 5 | **Fito pide apoyo de dos personas del otro equipo** | Le llega la solicitud al responsable de ese equipo. Mientras no acepte, nadie se mueve |
| 6 | **Conflicto**: una de las dos ya estaba asignada a R4 a esa hora | El conflicto sale solo, con las dos tareas y sus prioridades. Se avisa a los dos responsables. No se resuelve solo; lo decide quien tiene la facultad, con motivo |
| 7 | **Reasignación a media jornada**: se descompone una máquina y se mueven cuatro | Plan original conservado; quién, hora y motivo; las horas cambian cuando se confirma la llegada; nadie queda en dos lugares |
| 8 | **Cierre de la jornada** | Cada tarea dice su orden. La orden de R4 muestra su avance del día y sigue abierta. Desde la orden se llega a quién la dio, a quién se delegó, quién trabajó, incidencias y cambios |

Cuentas que la prueba debe sacar al final, como en el recorrido de los siete:
- Cada trabajador sale una vez; sus horas suman su tiempo en el rancho.
- Ninguna tarea está en dos órdenes; ninguna orden se duplica al delegar.
- Cero actividades, pagos o gastos creados por las órdenes.
- Después del recorrido se cambia al encargado: las órdenes abiertas pasan al nuevo y **todo lo hecho sigue a nombre
  de quien lo hizo**.
- Cada operación intentada sin facultad queda rechazada por la base (se prueba atacando la base aislada, no la pantalla).

---

## 4. Plan por etapas

Cada etapa se prueba con datos inventados, se enseña, y se instala sólo con autorización. Ninguna migra trabajadores
reales ni cambia permisos de producción sin que Luis lo diga.

| Etapa | Qué se construye | Toca permisos de producción | Qué se necesita antes |
|---|---|---|---|
| **0. Validación** | Nada. Preguntas a Miguel, Fito y Dirección (sección 5) | No | — |
| **1. Organización — CONSTRUIDA** | Áreas, equipos, responsables, adscripciones y apoyos, con historial. Pantalla «Organización». **No cambia quién puede hacer qué**: es sólo el mapa | No | Validar la estructura real con Miguel, Fito y Dirección |
| **2. Especialidades** | Catálogo, declaradas, capacitaciones y habilitaciones. Avisos al asignar. Actividades que piden habilitación | No | Decidir qué actividades la piden y qué pasa sin ella |
| **3. Facultades** | Las operaciones de mando y su alcance en la base. Plantillas. Fito y Dirección pueden mandar. Las listas fijas por perfil se van reemplazando | **Sí** | Confirmación de Dirección de la tabla de la sección 2.3 |
| **4. Órdenes** | Órdenes por objetivo, delegar, dividir, confirmar y cerrar. Enlace con Reparto, Checador y Jornada. Pantalla «Órdenes» | Sí (operaciones nuevas) | Etapa 3 |
| **5. Apoyo y conflictos** | Solicitudes de apoyo, detección de conflictos, «Reasignar equipo», avisos | Sí (menor) | Respuestas de Miguel sobre cómo reasigna |
| **6. Trazabilidad completa** | Vista de punta a punta de una orden, historial de la organización por fecha, y el recorrido de las ocho escenas como prueba permanente | No | — |

Orden recomendado: 0 → 1 → 2 pueden avanzar sin riesgo, porque no cambian lo que nadie puede hacer. La 3 es la
delicada: va primero a la base de pruebas aislada, con ataques, y se instala hasta tener el sí de Dirección.

Lo que este plan NO incluye: nómina, costos ni pagos (no cambian), y WhatsApp (sigue apagado).

---

## 5. Decisiones que no son mías

**De Dirección**
1. La tabla de facultades iniciales (2.3): ¿es correcta para Dirección, Miguel, Fito y los encargados?
2. ¿Dirección captura sus objetivos, o los captura alguien a su nombre? (Hoy su perfil es de sólo lectura.)
3. ¿Quién puede otorgar facultades además de los superadministradores? Mi recomendación: nadie más.
4. Sin habilitación: ¿se impide asignar, o sólo se avisa? ¿En cuáles actividades?
5. En un conflicto entre dos equipos, ¿manda la prioridad de la orden o el superior común?

**De Miguel**
6. ¿Cuáles son hoy las áreas y los equipos, aunque no tengan nombre formal?
7. ¿Las órdenes las da por objetivo («deshierbar R4») o ya con gente?
8. Las preguntas pendientes de la jornada (`JORNADA.md`): cómo reasigna, quién confirma la llegada, quién da una
   tarea por terminada.

**De Fito**
9. ¿Qué actividades suyas piden habilitación, y quién la da hoy de palabra?
10. ¿Tiene gente fija o la pide cada vez?

---

## 6. Qué está demostrado y qué no

- **Demostrado:** nada de este documento. Es diseño.
- **Ya demostrado con datos inventados y que este diseño aprovecha:** que el plan conserva sus cambios, que la jornada
  no duplica gente ni horas, y que la base rechaza operaciones sensibles sin permiso.
- **Requiere un día real:** todo lo que dependa de cómo mandan de verdad Miguel, Fito y los encargados.

---

## 7. Etapa 1: lo construido (21 nov, 18 h)

**Qué hay**
- Pantalla **Organización** (sólo para el administrador; menú «Control»), con tres pestañas: el mapa, la gente y el
  historial.
- Áreas y equipos en árbol; responsable de cada unidad; equipo habitual de cada persona; apoyo temporal a otro equipo.
- Cada cambio es un hecho con su fecha «desde», quién lo registró y por qué. Nada se sobrescribe.
- «Ver cómo estaba el día…»: la organización de cualquier fecha.
- El superior de alguien no se captura: sale de la cadena. Si no hay con qué decirlo, se dice.
- Un hecho capturado por error se tacha con motivo; no se borra.
- Botón para crear la **estructura provisional**: Dirección → Operaciones agrícolas generales y Operaciones agronómicas
  → Riegos (equipo de Operaciones agronómicas). Nace sin personas, sin responsables y marcada «por validar».
  **No la creé en producción**: la crea un administrador cuando se decida.

**Cómo se cumplieron las condiciones de Luis**

| Condición | Cómo |
|---|---|
| Sin nombres de personas en la lógica | Hay prueba que revisa el código buscándolos |
| Estructura provisional | Cuatro unidades, todas «por validar»; Riegos bajo Operaciones agronómicas |
| No asignar trabajadores ni superiores solos | La estructura nace vacía; un responsable nace «por confirmar»; quien no tiene equipo sale «sin equipo» |
| Tres cosas separadas | El mapa no lee ni escribe permisos; nombrar responsable avisa «esto no le da permisos»; ningún módulo de permisos, dinero, asistencia o jornada lee el mapa (hay prueba) |
| Probarse con datos ficticios | 10 pruebas de cuentas y un recorrido de 18 pasos en la pantalla |
| Sin modificar la operación | El recorrido comprueba cero tareas, actividades, gastos o repartos creados |

**Lo que NO hace todavía, dicho claro**
- **La base no valida quién captura la organización.** Hoy es una regla de la pantalla (sólo el administrador la ve).
  Cualquier cuenta que ya puede guardar hechos en la base podría, sabiendo cómo, guardar uno de organización. Cerrarlo
  es un cambio de permisos (etapa 3), que no está autorizado. Mientras tanto no hay riesgo operativo, porque **el mapa
  no le da poder a nadie**: nada decide con él.
- **Sólo aparece la gente que la app conoce** (catálogo de personal, encargados y agrónomos, y quien está viendo la
  pantalla). Para poner de responsable a alguien de Dirección que no esté en esos catálogos hay que resolver primero
  cómo se da de alta; es parte de la validación.
- No se usa todavía en Reparto, Equipos de trabajo, Checador ni Jornada: se conectan en las etapas siguientes.
- Sin probar con nadie del rancho.
