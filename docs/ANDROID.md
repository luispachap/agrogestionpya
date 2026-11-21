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
