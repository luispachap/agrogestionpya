# Una operación, múltiples consecuencias

Es el principio central de AgroGestión. Este documento dice cómo se cumple y
en qué orden se va a ir pasando cada parte del sistema a ese modelo.

## El modelo, en una hoja

- **Evento**: algo que pasó en el rancho, capturado una sola vez. Tiene un
  identificador único, tipo, estado (vigente, cancelado, corregido), cuándo
  pasó, cuándo se capturó, quién lo capturó, y —si viene de otro evento— de
  cuál y con qué relación (lo corrige, lo devuelve, lo cierra).
- **Efecto**: una consecuencia de un evento (presencia, existencia, costo). Los
  efectos **no se guardan: se calculan** de los eventos vigentes cada vez. Cada
  uno lleva el identificador del evento del que salió.
- **Regla**: cada tipo de evento tiene una sola, que dice qué efectos produce y
  bajo qué condición.

| Regla que pediste | Cómo se cumple |
|---|---|
| 1. No se captura dos veces | El evento es lo único que se captura |
| 2. Cada efecto guarda su origen | Todo efecto lleva el id de su evento, y su propio id sale de ése |
| 3. El efecto sólo existe si se cumple su condición | Una marca produce presencia, no horas en parcela; un retiro produce "en campo", no consumo |
| 4. Corregir y cancelar no borran | El evento no cambia: se cancela con motivo o se corrige con uno nuevo que apunta al anterior. Sólo los vigentes producen efectos |
| 5. Sin señal y con reintentos no se duplica | Subir dos veces el mismo evento es el mismo renglón; y como los efectos no se guardan, no hay costo que se pueda duplicar |
| 6. Todos leen lo mismo | Todos los módulos preguntan a la misma función |
| 7. Toda cifra se rastrea | Del efecto al evento, y del evento a toda su historia de correcciones |

En la base (hoja 35) el evento tiene tres candados que ni un superadministrador
se salta: no se edita lo que dice, lo cancelado no revive aunque un teléfono
suba su copia vieja, y no se borra.

## Qué tan lejos está lo que ya existía

Revisado contra el principio. Nada de esto se destruye; se va pasando por etapas.

| Parte | Cómo está hoy | Qué le falta |
|---|---|---|
| Subida a la nube | Bien: sube por identificador, un reintento no duplica el renglón | Nada |
| Dinero | Bien: se cancela con motivo, no se borra | Que un pago apunte a la obligación que paga (compra ≠ pago) |
| **Existencias del almacén** | **Mal para varios aparatos**: la existencia es un número guardado que cada pantalla sobrescribe. Dos teléfonos sin señal que sacan del mismo artículo: gana el último y se pierde una salida | Que la existencia salga de sumar movimientos (eventos), por ubicación. Es la entrega 3 |
| Actividades de campo | El costo de mano de obra se calcula al capturar y se guarda dentro de la actividad | Que salga de la asignación de la cuadrilla y de las horas, no de teclearlo. Entrega 2 |
| Asistencia | Era una palomita por día, capturada aparte de las actividades | **Hecho**: sale de las marcas del checador |
| Aplicaciones, cosechas, compras | Cada una guarda sus consecuencias por su cuenta (inventario, costo) | Pasarlas a eventos conforme toque cada entrega |
| Guardado en el teléfono | Todo vive en un cajón de unos 5 MB | Con cien personas checando dos veces al día se llena en meses. Hay que mudarlo a un almacén más grande antes de operar a diario. **Riesgo abierto** |

## Entregas

1. **Checador** (hecha): credencial con QR, entrada y salida por QR o PIN,
   llegada directa a campo autorizada, sin señal, sin duplicados, correcciones
   con motivo, jornada del día.
2. **Cuadrillas y horas por parcela**: armar cuadrillas con quien ya checó,
   asignarlas a parcela y actividad, cambios durante el día, jornal / hora /
   destajo, historial de sueldos. De aquí sale el costo de mano de obra.
3. **Almacén por movimientos**: artículos y herramientas con QR, retiro,
   devolución, transferencia, consumo y "quedó en campo", existencias por
   ubicación, conciliación del día por excepciones, combustible con destino.
4. **Costos reales** por parcela, cultivo, actividad y temporada, con rastro.
5. Seguimiento agronómico, finanzas, y tierras y agua, en ese orden.

## Decisiones que son del rancho, no mías

Las dejé con un valor para poder avanzar; se cambian en un renglón.

- **15 minutos**: una segunda lectura de la misma persona antes de ese tiempo se
  toma como repetida, no como salida.
- **Quién corrige una marca**: encargados y administradores. Nadie la suya.
- **Una entrada sin salida no vale horas** hasta que alguien la cierre a mano.
