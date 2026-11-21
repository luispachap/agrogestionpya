# Avisos al teléfono — cómo funcionan, qué cuestan, qué falta y cómo probarlos

*21 nov 2026. Construido, instalado y probado con base y servicio de avisos de mentira. **NO está probado en un
teléfono real**: esa prueba sólo la puede hacer una persona con un Android en la mano (lista al final).*

## 1. Cómo llegan con AgroGestión cerrada

Es el mecanismo estándar de los navegadores («web push»):

1. En Mensajes → «Avisos en este teléfono» → **Activar avisos**. El teléfono pide permiso y queda suscrito a TU cuenta.
2. Cuando entra un mensaje, una asignación, una incidencia o algo por autorizar, la base le avisa a una función
   del servidor, que decide a quién le toca y manda el aviso.
3. El aviso viaja por el servicio de avisos del propio navegador y el teléfono lo enseña aunque la app esté cerrada.
4. Al tocarlo se abre AgroGestión en la conversación o pantalla correcta. La app vuelve a comprobar tus permisos.

## 2. Servicio externo, límites y costo

| Qué | Respuesta |
|---|---|
| ¿Se contrató algo? | No. No hay cuenta nueva, ni tarjeta, ni plan |
| ¿Por dónde viaja el aviso? | Por el servicio de avisos del navegador de cada teléfono: en Android con Chrome es el de Google (el mismo que usan todas las páginas que mandan avisos); en iPhone, el de Apple. No se puede evitar: es la única forma de despertar un teléfono con la app cerrada |
| ¿Costo? | Gratis, sin cuota conocida para este volumen |
| ¿Qué ve ese servicio? | Un aviso cifrado para tu teléfono. Y aun así el aviso no lleva el texto del mensaje ni importes |
| Lo nuestro | La función corre en el plan gratuito de Supabase (500 mil llamadas al mes; un rancho usa una fracción) |

**Nadie recibe nada hasta que activa los avisos en su teléfono.** Si prefieres no usar este mecanismo, basta con
no activarlos (y se puede apagar del lado del servidor borrando la dirección de la función).

## 3. Qué avisa hoy

| Aviso | A quién | ¿Se puede apagar? |
|---|---|---|
| Mensaje nuevo (texto, audio, foto, documento) | Los demás participantes de esa conversación | Sí |
| Mención («@Fito …») | La persona mencionada, aunque tenga apagados los mensajes | Sí (aparte) |
| Te agregaron a una conversación | Los agregados | Sí |
| Asignación nueva o cambiada | La persona asignada, si tiene cuenta | **No: siempre llega** |
| Préstamo por autorizar | Quien tiene el permiso de autorizar préstamos | **No** |
| Incidencia reportada | Administración y encargados | Sí |
| Solicitud de compra por revisar | Administración y finanzas | Sí |

- **No fastidia:** los mensajes de una misma conversación se juntan en un solo aviso que dice cuántos van; nunca se
  le avisa a quien lo escribió; el mismo aviso no se manda dos veces.
- **Pantalla bloqueada:** el aviso dice quién y dónde («Miguel mandó un audio · En «Riego»»), nunca el texto, ni
  importes, ni el nombre de a quién se le presta.
- **Permisos:** sólo se le avisa a quien puede ver eso. Un aviso viejo no abre nada si ya perdiste el acceso: el
  contenido lo pide la app con tu sesión. Al cerrar sesión, ese teléfono deja de recibir los avisos de esa cuenta.
- **Leído = sin pendiente:** al abrir la conversación se quita el aviso del teléfono y el contador de no leídos.

## 4. Lo que NO hace todavía

1. **Quien entra con PIN no recibe avisos.** Los avisos son por cuenta (correo y contraseña). Los trabajadores sin
   cuenta siguen enterándose por su encargado o al checar.
2. Faltan estos avisos operativos: resumen de «lo de mañana» la víspera, actividades vencidas o sin seguimiento,
   observaciones agronómicas que piden atención, compras por aprobar del flujo de Compras y cambios de planeación
   para quien no tiene cuenta. Los dos primeros necesitan una tarea programada (se puede, sin costo).
3. El contador de no leídos se recuerda por aparato, no por cuenta.
4. No hay «silenciar esta conversación» ni horario de no molestar.
5. Al tocar el aviso se abre la conversación, no se resalta el mensaje exacto.

## 5. Limitaciones que no dependen de nosotros

- **Ahorro de batería** de algunas marcas (Xiaomi, Oppo, Huawei, Samsung en modo ahorro) puede retrasar o matar
  los avisos. Se arregla en el teléfono: quitarle a Chrome (o a la app instalada) la restricción de batería.
- **Teléfonos sin servicios de Google** (Huawei recientes) no reciben avisos de Chrome.
- **iPhone:** sólo con AgroGestión instalada en la pantalla de inicio y iOS 16.4 o más nuevo.
- **Sin internet** el aviso espera hasta 24 horas y llega al volver la señal; pasado ese tiempo ya no llega (el
  mensaje sí está en la app). Un mensaje escrito sin señal sale —y avisa— cuando el teléfono de quien lo escribió
  recupera la conexión.
- Instalar la app no garantiza los avisos: hace falta el permiso de notificaciones de ese teléfono.

## 6. Prueba en un Android real (pendiente; 10 minutos, dos cuentas)

| # | Paso | Qué debe pasar |
|---|---|---|
| 1 | En el Android, con Chrome: abrir app.agroselectos.com, entrar con correo y contraseña, menú ⋮ → «Instalar app» | Queda el icono de AgroGestión |
| 2 | Mensajes → «Avisos en este teléfono» → Ajustar → Activar avisos → Permitir | Dice «este teléfono ya recibe avisos» |
| 3 | «Mandarme un aviso de prueba», cerrar la app y bloquear el teléfono | Llega el aviso en segundos |
| 4 | Desde OTRA cuenta (otra computadora o teléfono), mandar un mensaje en una conversación compartida | Llega «Fulano mandó un mensaje · En «…»», sin el texto |
| 5 | Tocar el aviso | Abre AgroGestión en esa conversación |
| 6 | Leer y volver a la lista | Ya no dice «sin leer» y el aviso desapareció |
| 7 | Mandar tres mensajes seguidos | Un solo aviso que dice «3 avisos» |
| 8 | Poner el teléfono en modo avión, mandar un mensaje desde la otra cuenta, quitar el modo avión | El aviso llega al volver la señal |
| 9 | Desde la otra cuenta, pedir un préstamo (o asignar una tarea a esa cuenta) | Llega «Hay un préstamo por autorizar» (o «Tienes una asignación nueva») |
| 10 | Cerrar sesión en el Android y mandar otro mensaje | Ya NO llega nada a ese teléfono |

Si algún paso falla, con decirme cuál y qué apareció en pantalla es suficiente para corregirlo.

## 7. Prueba en el Android de Luis (21 nov) — estado

| Qué | Resultado |
|---|---|
| Aviso de prueba con la app cerrada | Llegó |
| Mensaje real, prioridad normal | Sólo llegó al abrir Chrome → ahora todo sale con prioridad alta |
| Mensaje real, prioridad alta, Chrome cerrado y teléfono bloqueado | Llegó solo |
| Sonido y vibración | Primero mudo; con `vibrate` + `silent:false` sonó y vibró |
| Tocar el aviso con la app abierta en el fondo | Abrió la conversación correcta |
| Tocar el aviso con la app cerrada o dormida | **FALLÓ dos veces** (no llevó a la conversación). Tercer arreglo: el aviso deja apuntado su destino y la app lo lee al abrir o volver al frente. **Sin comprobar en el teléfono.** |
| Se quita el «sin leer» | Sin comprobar |

La entrega (llegar, sonar) está comprobada en un teléfono. Abrir la conversación al tocar NO.
