# Mensajería institucional — qué es, qué hace hoy y qué falta

*21 nov 2026. Visión de Luis: la comunicación de trabajo del rancho se vuelve una fuente organizada de
información operativa, administrativa y agronómica. Todo lo de aquí se probó con gente inventada; nadie del
rancho lo ha usado.*

## 1. La idea

- **No es otro chat.** Es el chat que ya existía (mismos mensajes, misma lectura, mismas confirmaciones), que deja
  de ser un solo hilo y pasa a tener conversaciones entre dos personas y grupos de trabajo.
- **Es una sola inteligencia.** Lo que se dicen entre personas, lo que se le dice al asistente, lo que se dicta en
  «Dile a la app» y —cuando se conecte— lo que llegue por WhatsApp pasa por el mismo camino (`src/operaciones.js`):
  entender → proponer → preguntar lo que falta → confirmar quien tiene permiso → registrar con la función que el
  módulo ya tiene.
- **Propone, no registra.** Ninguna conversación se vuelve un movimiento por sí sola.

## 2. Lo que funciona hoy

| Cosa | Cómo quedó |
|---|---|
| Conversaciones | La general del rancho, directas (dos personas) y grupos con nombre. Un grupo puede incluir personas o puestos completos («todos los de Administración»). Abrirlas y cambiar su gente queda como evento: no se borra ni se edita |
| Qué se comparte | Texto, audio, fotos (se leen como papel, igual que antes) y documentos (PDF, Excel, CSV, XML, Word), que se guardan junto al mensaje |
| Reglas a la vista | Botón «Reglas» en la pantalla: son mensajes de trabajo, quién los ve, que AgroGestión los lee para proponer, que nada se borra, que escribir no da permisos |
| Plática ≠ operación | «Ok, gracias» o una pregunta no generan propuestas ni pendientes. Sólo se propone de una frase que dice algo del trabajo |
| Seguir la conversación | Si a una propuesta le falta algo, AgroGestión pregunta debajo y se contesta en corto: «20 pesos el kilo» después de «compramos tres kilos de clavos» da $60, no un gasto de $20. También en «Dile a la app» |
| Entre varias personas | La respuesta puede darla otra persona. Si el encargado reporta la compra y el administrador dice «se pagó de caja chica», es UNA propuesta con las dos voces |
| Observación y pendiente | «Vimos plaga en San Felipe 4» + «mañana la voy a inspeccionar» (de otro) = una observación y un pendiente ligado a ella, con la parcela heredada y dicho que es heredada. Sin diagnóstico |
| Programado y ejecutado | «Mañana hay que aplicar…» queda como algo por hacer; «ya se aplicó» después queda como lo ejecutado de aquello. Son dos registros distintos, ligados |
| El asistente | Sólo contesta si el mensaje empieza con «Agro,» (o @agro). Si no, se queda callado y deja sus propuestas debajo del mensaje |
| Rastro | El registro final lleva el mensaje original, cada aclaración (quién, cuándo, qué se entendió) y quién confirmó. Los mensajes de aclaración se conservan en la conversación |
| Préstamo dicho | Nace como SOLICITUD en Préstamos: no es gasto, no es deuda y no descuenta nada |

## 3. Lo que NO hace todavía (dicho sin adornos)

1. **El candado por conversación está en la app, no en la base.** Quién ve cada conversación lo decide la pantalla.
   Una cuenta con lectura de mensajes podría leer la tabla completa llamando directo a la base. Para cerrarlo hace
   falta una hoja nueva (quién participa en qué, comprobado por la base) y un directorio de cuentas. **Es lo
   siguiente antes de usarlo con conversaciones delicadas.**
2. **El personal de campo no tiene mensajería.** No tiene cuenta propia (sube por la del encargado), así que la
   base no puede distinguir quién escribe. Hace falta decidir cómo se identifica (¿cuenta propia?, ¿sólo WhatsApp?).
3. **«Almacén» no existe como puesto.** Hoy un grupo «Almacén» se arma con las personas que lo atienden.
4. **Compra + inventario + caja en un solo paso: a medias.** Se relacionan los mensajes y nace un solo gasto que
   dice que se pagó de caja chica. Todavía NO descuenta la caja chica ni mete la mercancía al almacén: eso sigue en
   «Caja chica» y «Compras». Falta definir contigo cómo deben quedar para no contar dos veces.
5. **Aplicaciones.** Lo programado y lo ejecutado se distinguen y se ligan, pero la aplicación como tal (producto,
   dosis, tiempos de seguridad, por qué se decidió) se sigue registrando en «Aplicaciones». Depende de lo que
   diga Fito.
6. **Excel y documentos en la plática** se guardan y se abren, pero no se leen solos: para proponerlos hay que
   pasarlos por «Importar documentos».
7. **Entiende por reglas, no por IA.** Frases torcidas o muy largas no las relaciona. Conectar la IA (con tope de
   gasto) es una decisión tuya; el camino ya está: la IA propondría por el mismo mecanismo.
8. No hay avisos de mensaje nuevo ni contador de no leídos. No se puede sacar a alguien de una conversación directa.

## 4. Decisiones que tomé por defecto y son tuyas

| Decisión | Como quedó | Dónde se cambia |
|---|---|---|
| ¿La administración puede abrir cualquier conversación? | Sí, y se le dice a todos en las reglas; si no participa, no puede escribir en ella | `LA_ADMINISTRACION_VE_TODO` |
| ¿Dirección escribe mensajes? | No: lee, como en el resto de la app | `ROLES_QUE_ESCRIBEN` y hoja 45 |
| ¿Quién abre conversaciones? | Administrador, encargado y agrónomo (finanzas participa, no abre) | `ROLES_QUE_ABREN` |
| ¿Cuánto dura abierta una pregunta? | 24 horas y los últimos 12 mensajes | `HORAS`, `HACIA_ATRAS` |
| ¿Qué pide sesión dentro de la app? | Gasto, trabajo de personas y solicitud de préstamo | `requiereSesion` en `OPERACIONES` |

## 5. El teléfono de una cuenta (para WhatsApp) — diseñado, no instalado

Para que tú o Miguel escriban por WhatsApp sin ser «trabajadores ficticios»:

1. Con tu sesión abierta en la app pides un código (vale 10 minutos y una sola vez).
2. Desde tu teléfono mandas ese código al número de AgroGestión.
3. El servidor, que ya comprobó que el mensaje viene de WhatsApp, liga ese teléfono a TU cuenta.

Así se prueban las dos cosas: que tienes la cuenta y que tienes el teléfono, **sin mandar ningún mensaje** (no cuesta).

- Una cuenta, un teléfono; un teléfono, una cuenta. No se le quita a otra. Cinco intentos por hora.
- Si el mismo teléfono está en una cuenta y además en el catálogo de personas, no se escoge: se avisa.
- **El teléfono dice quién escribe, no autoriza.** Un gasto, el trabajo de personas o un préstamo no se confirman
  desde un teléfono aunque sea de un administrador: se confirman dentro de la app, con sesión. Y lo sensible
  (pagos, cierres, reglas) lo sigue validando la base con la sesión, como siempre.
- Está en `supabase/pendientes/telefono-de-la-cuenta.sql`, probado en la base aislada. **No está instalado**: se
  instala junto con WhatsApp, cuando lo autorices. Falta la pantalla «Ligar mi teléfono».

## 6. WhatsApp como otro canal

Sigue preparado y apagado (`OPERACION-HABLADA.md` §5.1). Cuando se conecte, un mensaje de WhatsApp entra como un
mensaje más de esta mensajería, con su canal marcado. Restricciones de la plataforma que hay que respetar: sólo se
puede contestar libre dentro de 24 horas de que la persona escribió; fuera de eso, plantillas aprobadas; los grupos
de WhatsApp tienen requisitos aparte. Nada de eso está activo.

## 7. Orden que propongo

1. Candado por conversación en la base + directorio de cuentas.
2. Probarlo tú y Miguel con conversaciones reales de trabajo (una semana) y corregir lo que no entienda.
3. Definir contigo compra → caja chica → almacén en una sola confirmación.
4. Con Fito: la bitácora agronómica sobre este mismo mecanismo (observación → decisión → aplicación → resultado).
5. Bitácora por turnos: un grupo por turno con su resumen del día (ya hay «Hoy» por conversación).
6. Personal de campo y WhatsApp, cuando se autoricen.
