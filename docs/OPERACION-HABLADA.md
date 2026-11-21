# Decirle a AgroGestión lo que pasó — visión, estado real y plan

Escrito el 21 nov 2026 a partir de lo que planteó Luis. **No son proyectos separados**: es una sola operación
(planear → checar → trabajar → avisar → registrar → sugerir lo de mañana), con varias puertas de entrada.

## 1. La idea, en corto

- Gera deja sus funciones y Migue las toma. La meta no es que Migue aprenda a llenar un sistema: es que el
  sistema entienda cómo trabaja Migue.
- Cualquiera le dice a AgroGestión lo que pasó —hablando, escribiendo, mandando una foto o un archivo, desde la
  app o desde WhatsApp— y el sistema prepara el trabajo administrativo que toque.
- La IA **no escribe en la base**. Entiende y propone; los controles de siempre deciden.
- Planear no es ejecutar; checar no es trabajar; avanzar no es pagar; ver no es confirmar.

## 2. Qué existe de verdad (revisado en el código el 21 nov)

| Pieza | Qué hay | Qué le falta para esta visión |
|---|---|---|
| **«Dile a la app»** (hablar o escribir) | Funciona. Parte lo dicho en frases y propone actividad, gasto, necesidad, incidencia, cosecha, nota y —desde hoy— **avance**. Guarda el audio siempre | Sólo entiende por reglas (palabras clave), sin IA: frases fuera de lo previsto caen en «nota» |
| **Chat de adentro** | Funciona. Texto, foto y audio; clasifica, dice a quién le toca y espera una confirmación | Al confirmar guarda por su cuenta (otro código que el de «Dile a la app») y no revisa que quien confirma tenga permiso. **Hay que pasarlo al camino común** |
| **Lectura de papeles e importación** | Tickets, facturas, Excel, PDF; IA sólo a petición y con tope | Hoy vive en su pantalla. Falta que un ticket mandado «en la plática» entre por ahí mismo |
| **Hoja de fertirriego de Fito** | Se lee, se comprueba con la multiplicación y se vuelve indicación | No distingue programado de ejecutado más allá del estado de la indicación |
| **Aplicaciones** (catálogo y registro) | Producto, dosis, tiempos de seguridad, alertas | **No guarda por qué se decidió** (qué se vio, quién recomendó, qué resultó). Es la idea original de Fito y no está |
| **Bitácora** | Una lista de notas sueltas (lo que no se clasificó) | No es la memoria que se pide: no liga observación → decisión → acción → resultado |
| **Planeación del día** | «El día» → Reparto: se dicta quién va a dónde y a cada quien le llega lo suyo (también para mañana). Avisa choques y quién quedó sin nada | Vive aparte de las asignaciones reales (las del checador). **Un plan no se convierte en asignación al llegar** |
| **Reparto real / equipos de trabajo** | Eventos: asignar gente que ya checó a parcela y actividad; de ahí sale la mano de obra | No conoce el plan de la víspera |
| **Checador** | Entrada y salida con QR o PIN, tableta cerrada | **No enseña a qué va cada quien.** Sin validar en la nave |
| **Avance de trabajo** | Había sólo % por etapa del cultivo. **Desde hoy**: avance en la unidad que se dice (reguladores, surcos, cajas…), sin pago y sin porcentaje | Reguladores sin catálogo ni mapa (a propósito: todavía no se conocen) |
| **Centro de operaciones** | «Operación» (qué pasa ahora) y «El día» (clima, reparto, insumos) | No hay una vista para la reunión de la mañana |
| **Sugerencias** | Clima (qué se puede hacer hoy), insumos (qué se acaba). **Desde hoy**: lo que quedó pendiente | No hay productividad por trabajo: faltan datos reales |
| **WhatsApp** | Mensajes armados que se abren en WhatsApp para mandarlos a mano | **Ninguna integración**: no recibe ni manda sola |
| **Mapa y satélite** | Límites, superficie, ficha, Sentinel-2 | No se ligan todavía con observaciones ni avances |
| Bitácora de campo por turnos (junta) | **No existe** | Se resuelve con la misma memoria: recorridos con hora y parcela |
| Expediente legal por rancho/parcela (junta) | **No existe** | Va aparte; es documental |

## 3. El camino común (hecho hoy: `src/operaciones.js`)

Todo lo que entra hablado pasa por los mismos cinco pasos, venga de donde venga:

1. **Entender** — lo dicho se parte en frases y se clasifica.
2. **Preparar** — cada frase se vuelve una propuesta: qué operación es, con qué datos, y **de qué clase**: algo
   que se hizo · que se vio · una sospecha · un aviso · una decisión · algo por hacer · algo que hace falta.
   Sólo lo hecho se propone como hecho.
3. **Validar** — lo que falta **se pregunta**; el mismo mensaje no se registra dos veces; el mismo dinero dicho
   dos veces cuenta una.
4. **Autorizar** — confirma quien tiene permiso para esa operación. Hablar no da permisos.
5. **Ejecutar** — se usa la operación que el módulo ya tiene, y el registro guarda de qué mensaje y de qué frase
   salió, quién lo dijo y quién lo confirmó.

**Conectado hoy:** «Dile a la app». **Por conectar:** el chat de adentro, los papeles mandados en la plática,
WhatsApp.

**Lo que se reconoce pero todavía NO se registra hablando** (se dice a qué pantalla ir, y no se guarda «parecido»):
préstamos, pagos al personal, aplicaciones de productos, movimientos del almacén. Cada uno se conecta usando su
operación de siempre (con su autorización), no una nueva.

## 4. Avance de trabajo (hecho hoy: `src/avances.js`)

- Se registra como se dice: «terminamos dos reguladores de deshierbe en San Felipe 4».
- **No es pago**: no le registra el día a nadie ni genera costo. «Trabajaron siete» es un número, no siete nombres.
- **No es porcentaje**: los reguladores no son iguales; mientras no se conozcan, no se calcula.
- Lo pendiente se conserva y al día siguiente «El día» lo recuerda, diciendo en qué se basa.
- Cuánta gente haría falta sólo se estima con tres registros del mismo trabajo y lo pendiente dicho en número; si
  no, dice por qué no puede.

## 5. WhatsApp oficial: qué pide y qué cuesta (investigado el 21 nov 2026)

La vía oficial es la **plataforma de WhatsApp Business de Meta** (la «Cloud API»). No se activó nada.

**Requisitos**
- Una cuenta de negocio en Meta y **un número de teléfono dedicado** para AgroGestión (no puede ser un número que
  alguien use como su WhatsApp normal).
- Un lugar donde recibir los mensajes: se puede con la misma infraestructura gratuita que ya se usa para la IA.
- Para que el sistema escriba primero (por ejemplo, la asignación de la mañana) hacen falta **plantillas**
  aprobadas por Meta. Para contestarle a quien escribió no.
- De arranque, hasta 250 conversaciones iniciadas por el negocio al día; verificar el negocio lo sube.

**Restricciones que cambian el diseño**
- **No entra al grupo del rancho.** Los grupos por esta vía piden una cuenta oficial verificada, y aun así son de
  8 personas como máximo. En la práctica cada quien le escribe **al número de AgroGestión**, uno a uno.
- Sólo se le puede contestar libremente a alguien durante las **24 horas** siguientes a su último mensaje.
- Las **notas de voz** llegan como audio: hay que transcribirlas con otro servicio (otro gasto, chico; falta
  escogerlo). La transcripción gratis del teléfono no aplica aquí.

**Costo** (por mensaje entregado; lo que la gente manda es gratis)

| Tipo | Costo en México |
|---|---|
| Lo que la gente le manda a AgroGestión | $0 |
| Respuestas dentro de las 24 h | Las primeras 1,000 al mes gratis; después ~0.0085 USD (~0.16 MXN) |
| Avisos con plantilla (asignaciones, recordatorios) | ~0.0085 USD (~0.16 MXN) cada uno |
| Mensajes de promoción | ~0.04 USD (no aplican aquí) |

Las tarifas por país salen de la tarjeta de precios de Meta; las cifras de México las tomé de dos guías de
terceros que la citan (vigentes desde el 1 oct 2026). Hay que confirmarlas en la tarjeta oficial al contratar.

**Cuenta gruesa para el rancho:** 25 personas con su asignación cada mañana, 26 días ≈ 650 avisos ≈ 5.5 USD al
mes; respuestas, dentro de lo gratuito o un par de dólares. **Del orden de 5 a 10 USD al mes**, más la
transcripción de audios y la IA que interprete (centavos por mensaje, con tope como ya se hace).

**Antes de eso, sin costo:** todo el camino funciona ya dentro de la app (hablar, escribir, foto), y los avisos
se pueden seguir mandando «a mano» con el mensaje armado. WhatsApp se conecta al final, como una puerta más.

## 6. Plan, en el orden que conviene

| # | Entrega | Reutiliza | Depende de |
|---|---|---|---|
| 1 | **Camino común + avance** | Dictado, voz | **Hecho hoy** (falta validar con Migue) |
| 2 | Pasar el **chat de adentro** al camino común (mismo permiso, mismo rastro) | chat.js | — |
| 3 | **Plan → checador**: el plan de mañana se vuelve «a qué va cada quien», y al checar la tableta se lo dice. Asistencia ≠ ejecución; el plan no genera rayas | plan.js, checador, equipos | Confirmar con Migue cómo es la reunión |
| 4 | **Memoria de decisiones de Fito**: observación → condición → recomendación → quién decidió → qué se aplicó → resultado, ligada a la aplicación y a la parcela | aplicaciones, bitácora, camino común | Platicarlo con Fito |
| 5 | **Vista de la reunión de la mañana** (quién llegó, plan, pendientes, incidencias, maquinaria) | Operación, El día, checador | La entrega 3 |
| 6 | Conectar al camino: **ticket en la plática** (compra → almacén, una sola vez), **préstamo**, **aplicaciones** | compras, préstamos, lector de papeles | Cada uno con su autorización |
| 7 | **Entender con IA** lo que las reglas no entienden (con tope) | la función de IA que ya existe | Autorización de gasto |
| 8 | **WhatsApp** como otra puerta | todo lo anterior | Número, cuenta de Meta y autorización de gasto |
| 9 | Ligar observaciones y avances con el **mapa**; reguladores en el mapa | mapa, satélite | Límites reales |

En paralelo, sin moverse: validar el **checador en la tableta**, el **día real con Migue**, el **piloto**, y el
**expediente legal** de la junta.

## 7. Lo que necesito saber del rancho (no lo supongo)

1. Cómo es hoy la reunión de la mañana: quién la dirige, cuánto dura, qué se decide ahí.
2. Si el plan se arma la víspera o en la mañana, y quién puede cambiarlo.
3. Qué unidades de avance se usan además de reguladores (por actividad).
4. De Fito: qué quiere dejar escrito de cada decisión, en sus palabras.
5. Qué número de teléfono sería el de AgroGestión, cuando toque.
