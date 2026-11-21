# AgroGestión como app Android — evaluación y prototipo (21 nov 2026)

**Estado: PROTOTIPO en la rama `experimento/android`. No está en producción, no sustituye a la web y no se ha
probado en un teléfono.** Nada de esto se mezcla a `produccion/base-vigente` sin que Luis lo autorice.

## Qué se hizo
- Capacitor 8 envuelve la MISMA web (`dist/`) en una app Android. Carpeta `android/` + `src/nativo.js`.
- Compiló a la primera: APK de 6 MB, sin tocar ninguna pantalla. Se llama «AgroGestión prueba»
  (`com.agroselectos.agrogestion.prototipo`), convive con la web y con una futura app definitiva.
- Tres canales de aviso con tono propio (`res/raw/tono_*.wav`): Mensajes, Asignaciones, Alertas.
- Mientras la app está viva pregunta cada 15 s por mensajes nuevos y avisa de forma nativa. Al tocar, abre la conversación.
- En el navegador `window.Capacitor` no existe: la web no cambia.

## Qué NO demuestra todavía
- Avisos con la app CERRADA: hace falta Firebase Cloud Messaging (gratis, pero es un servicio nuevo: lo autoriza Luis).
- Nada está probado en un aparato: aquí no hay emulador.

## Cómo se compila
`npm run build && npx cap sync android && cd android && ./gradlew assembleDebug` (JDK 21, Android SDK 36).

## Lo que habría que adaptar para una versión de verdad
| Tema | Por qué |
|---|---|
| Avisos | FCM en la app + la función `avisar` manda también a teléfonos con app (la web sigue con web push) |
| Descargar/compartir archivos (PDF, Excel) e imprimir | Dentro de una app las descargas e impresión del navegador no funcionan solas |
| Cámara, micrófono, ubicación | Declarar permisos; revisar el lector de QR dentro de la app |
| Mapa (Leaflet desde internet) | Empaquetarlo |
| Datos locales | El cajón de la app es distinto al de Chrome: lo pendiente de subir en Chrome no pasa solo |
| Actualizaciones | Decidir: contenido empaquetado (APK nuevo por cambio) o la app carga la web publicada (se actualiza sola) |
| Firma | Llave propia de Agroselectos, guardada fuera del repositorio; si se pierde no se puede actualizar |
| Aparato perdido | Lista de aparatos por cuenta, cerrar sesión a distancia, candado con huella |

## Segunda vuelta (21 nov): sesión protegida y desbloqueo con huella

**Sigue siendo prototipo, en su rama, sin tocar producción y SIN PROBAR EN UN TELÉFONO.** Compila (APK de ~10 MB) con
tres piezas nativas compatibles con Capacitor 8: biometría, almacén protegido y pantalla privada. `src/nativoSeguro.js`.

| Requisito | Cómo quedó en el prototipo |
|---|---|
| Entrar una vez con correo y contraseña | Igual que la web |
| Siguientes aperturas con huella o rostro | La sesión recuperada arranca bloqueada; se abre con el diálogo biométrico de Android |
| Sin guardar biometría | Android sólo contesta sí o no; AgroGestión no ve ni guarda huellas ni rostros |
| PIN, patrón o contraseña del teléfono como alternativa | Permitido en el mismo diálogo |
| Bloqueo automático | Inmediato, 1 minuto o 5 minutos fuera de la app (Mensajes → Opciones → Avisos de este teléfono) |
| Recientes y capturas | Pantalla privada: el contenido no sale en las aplicaciones recientes ni en capturas |
| Sesión en almacén protegido | La sesión de la base va al almacén cifrado de Android, no al almacenamiento web. Nunca se guarda la contraseña |
| La huella no sustituye al servidor | Al desbloquear se le pregunta a la base si la sesión sigue viva; si fue revocada o venció, se cierra y pide entrar otra vez |
| Teléfonos compartidos | Una sesión con PIN de trabajo NO se abre con huella: al bloquearse se cierra y hay que volver a poner el PIN |
| Teléfono sin bloqueo de pantalla | Se dice en claro y no se conserva la sesión abierta: al salir de la app se cierra |
| Una sola base de código | Todo vive en dos archivos que sólo actúan dentro de la app; en la web no se descargan |

**Lo que falta y hay que decir:**
- Los datos que la app guarda para trabajar sin señal (registros, mensajes) siguen en el almacenamiento web de la app,
  sin cifrar: el candado protege el acceso por la app, no un teléfono abierto por un técnico. Cifrarlos es otro trabajo.
- Revocar sesiones y desvincular un teléfono perdido: no está hecho. Hace falta una lista de aparatos por cuenta en la
  base y un botón «cerrar sesión en ese aparato»; el cliente ya obedece (al desbloquear revisa contra el servidor).
- Avisos con la app bloqueada: los canales están como privados (en la pantalla de bloqueo Android oculta el contenido
  según lo que el usuario tenga configurado) y nuestros avisos no llevan texto ni importes. Con la app CERRADA siguen
  sin llegar hasta activar Firebase.
- Distinguir «sesión recuperada» de «acaba de entrar» se hace viendo si tecleó antes de tener sesión: hay que probarlo.
