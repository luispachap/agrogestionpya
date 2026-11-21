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

## 2 bis. Acceso, memoria y origen (decidido por Luis el 21 nov, 8:54 y 8:57)

*Agroselectos es la empresa; AgroGestión es el sistema que la administra.* La mensajería interna se prueba como
el medio principal de comunicación de trabajo; WhatsApp queda como integración futura y opcional.

**No es vigilancia: es memoria con origen verificable.** Tres niveles, y los tres los hace cumplir la base (hoja 46):

| Nivel | Qué es | Quién | Rastro |
|---|---|---|---|
| 1 | Lo interpretado y lo registrado (pestaña «Memoria» y los módulos de siempre) | Quien ya puede leer esos registros | — |
| 2 | Los mensajes concretos que sustentan un registro, sin participar en la conversación | Cuenta con el permiso «ver evidencia». Sólo mensajes marcados como evidencia; si tocan dinero, además debe poder leer gastos | Cada consulta queda en la bitácora |
| 3 | Una conversación completa en la que no se participa | Cuenta con el permiso «supervisar conversaciones», con motivo, 24 horas, sólo lectura | Bitácora, y la lista de consultas la ven todos |

- **Nadie lee una conversación por su puesto.** Ni el administrador ni el superadministrador. Los dos permisos se
  otorgan cuenta por cuenta en Arranque → Cuentas (también a un superadministrador), y queda quién los otorgó.
- **«¿De dónde salió?»** En «Memoria» cada hallazgo se abre en cuatro capas que no se mezclan: lo que se dijo
  (quién, cuándo, en qué conversación, con sus aclaraciones y adjuntos), lo que AgroGestión interpretó (y por qué),
  lo que una persona confirmó, y lo que quedó registrado. Se busca por palabra, parcela y tema.
- **Evidencia:** al confirmarse algo, su mensaje y sus aclaraciones quedan marcados como evidencia (y como
  sensibles si es dinero).
- **No leídos:** cada conversación dice cuántos mensajes hay sin leer (se recuerda por persona y por aparato).

**Probado:** 6 pruebas atacando la base aislada (participantes, superadministrador sin acceso, nadie se mete solo,
consulta excepcional con permiso/motivo/vencimiento/bitácora, evidencia, directorio); 15 pruebas de reglas;
navegador 23/23. **Instalado en la base real** (no había ninguna conversación, así que no hubo nada que migrar).
**Sin validar:** con cuentas reales de Agroselectos.

## 3. Lo que NO hace todavía (dicho sin adornos)

1. **Archivos: cerrado (hoja 48).** Las fotos y documentos de una conversación se guardan en su propia carpeta
   del almacén y la base sólo se los deja ver, bajar, listar o subir a sus participantes (probado atacando la base
   aislada). Tope: 3 MB por archivo; fotos, PDF, Excel, Word, CSV y XML.
1b. **Avisos con la app cerrada: construidos e instalados (hoja 47, `AVISOS.md`). Falta la prueba en un Android real.**
1c. **Un aparato compartido** (el que un encargado liga para su gente) baja lo que puede leer la cuenta del
   encargado. La pantalla filtra por persona, pero ese aparato no es un lugar privado.
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
| ¿Cuánto dura una consulta excepcional? | 24 horas, sólo lectura | hoja 46 |
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

## 8. Qué está construido, qué sólo se probó con datos inventados y qué falta validar (21 nov, 9 h)

| Pieza | Construido | Probado sólo con datos inventados | Falta validar con Agroselectos |
|---|---|---|---|
| Conversaciones directas y de grupo, texto y audio | Sí | Sí | Uso real entre Miguel, Fito y encargados |
| Candado por conversación en la base | Sí, instalado | Sí (base aislada) | Con cuentas reales |
| Memoria y «¿de dónde salió?» | Sí | Sí | Que lo interpretado sirva y no estorbe |
| Tres niveles de acceso, con bitácora | Sí, instalado | Sí | Otorgar los permisos y hacer una consulta real |
| Seguir la conversación (lo que falta se contesta) | Sí | Sí | Frases reales de la gente |
| No leídos | Sí (por aparato) | Sí | — |
| Avisos con la app cerrada | **No** | — | — |
| Fotos y documentos en conversaciones cerradas | **No** (sólo en la general) | — | — |
| Compra → caja → almacén en una confirmación | A medias | Sí | Definir contigo |
| Indicación de Miguel → asignación de mañana desde la plática | **No** (se hace en «El día») | — | Miguel |
| Incidencia de maquinaria → pendiente de mantenimiento | Se registra la incidencia; el pendiente de mantenimiento no existe | Sí | — |
| Bitácora agronómica (decisiones de Fito) | **No** | — | Fito |
| Plan del día y checador que dice a qué va cada quien | Sí | Sí | En la nave, con Miguel |
| Bitácora por turnos, expediente legal | **No** | — | — |
| Entender con IA | **No** (reglas) | — | Autorización de gasto |
| WhatsApp | Preparado, apagado, opcional | Sí | — |

**Para el piloto con Miguel, Fito y algunos encargados faltan, en este orden:** avisos con la app cerrada,
archivos con candado, y dar de alta sus cuentas. Lo demás se puede probar ya.

## Interfaz de mensajería (21 nov 2026)

La conversación se usa como cualquier app de mensajes: encabezado con nombre e integrantes, burbujas (lo mío a la
derecha), lo reciente abajo, barra de escribir fija con adjuntar, cámara y audio. Lo institucional (por confirmar, lo de
hoy, integrantes, avisos, reglas) está en «Opciones» y no ocupa la pantalla. Las propuestas van plegadas dentro del
mensaje; la pregunta que falta sí se ve, y se contesta escribiendo normal.

**Comprobado en navegador con pantalla de teléfono** (`pruebas/mensajes_movil.py`, 32 comprobaciones): abrir en lo
reciente, barra visible con la pantalla encogida, historial, mensajes nuevos, audio, foto, documento, botón atrás.

**Sin comprobar en un teléfono real:** el teclado de Android de verdad, la cámara, el micrófono y la reproducción de
audios. Los audios siguen viajando DENTRO del mensaje (no van al almacén de archivos): pesan en la base y conviene
moverlos antes de que el uso crezca.
