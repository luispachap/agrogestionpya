# La jornada de trabajo (21 nov 2026)

Un día de trabajo de punta a punta dentro de AgroGestión. **Está construido y probado con datos inventados; no se ha
usado en un día real del rancho.**

## Cómo corre el día

| Momento | Dónde | Qué pasa |
|---|---|---|
| 1. Planear | El día → Reparto | Se dicta o escribe el reparto; la app lo parte en tareas, avisa lo que choca o quedó sin dueño, y se mandan. Lo que quedó de ayer aparece arriba como sugerencia. |
| 2. Asignar | Checador | Al checar su entrada, cada quien ve a qué va. Es información: checar no inicia el trabajo ni lo da por hecho. |
| 3. Ejecutar | Equipos de trabajo | El encargado pone a la gente en la parcela y la actividad reales. De ahí salen las horas. |
| 4. Reportar | Mensajes → AgroGestión | «Terminamos dos reguladores de deshierbe en San Felipe 4»: queda el avance, sin pago ni porcentaje. |
| 5. Incidencias | Mensajes → AgroGestión, o Incidencias | «Se descompuso la bomba»: queda la incidencia. |
| 6. Cerrar | El día → Jornada | Junta todo lo anterior, tarea por tarea, y se cierra con su porqué. |

## La pestaña «Jornada»
- Cada tarea mandada dice **qué se sabe de ella y con qué se sabe**: hecha (alguien la marcó), en curso, se trabajó
  ahí (hay horas en esa parcela, nadie la marcó terminada), trabajó en otro lado, vino sin trabajo registrado, no checó
  entrada, dijo que no puede, o **no hay con qué saberlo** (cuadrillas y encargados no checan).
- Aparte: lo que se trabajó sin estar en el plan, el tiempo por aclarar, los avances y las incidencias del día.
- **Cerrar** pide, para cada tarea sin evidencia, **por qué no se hizo** (lo dice una persona; la app no lo supone) y
  si pasa a mañana. Queda una foto con versión. Lo que llegue después se enseña aparte; la foto no cambia.
- **Pasar a mañana** pone esas tareas en el plan del día siguiente cuando la persona lo pide, una sola vez.
- **Reabrir** pide motivo y conserva la foto anterior.
- La cierra un administrador o un encargado.

## Lo que NO hace
- No crea horas, rayas, pagos ni costos, y ningún módulo de dinero la lee (hay prueba).
- No marca una tarea como hecha por haber horas en la parcela.
- No dice «no vino» de quien no checa.

## Cuando el plan cambia a media jornada (21 nov, tarde)
El caso que pidió Luis: siete trabajadores con plan para una parcela; se descompone una máquina y cuatro se mandan a
otra. Recorrido completo en `pruebas/reasignacion_navegador.py` (20 pasos, en las pantallas de verdad) y en
`src/jornada.test.js` (pruebas `recorrido_*`). Todo con gente y parcelas inventadas.

- **El plan original se conserva.** El renglón de cada uno de los cuatro queda como estaba, marcado «cambiado». Lo
  nuevo es otro renglón que apunta al anterior.
- **El cambio dice quién, a qué hora y por qué.** La pestaña Jornada tiene la tarjeta «Cambios de plan en el día»:
  lo que decía el plan (tachado), a dónde va ahora, quién lo cambió, la hora, el motivo, y cuánto alcanzó a trabajar
  la persona donde decía el plan original. Lo mismo queda en la foto del cierre.
- **La ejecución real sale de lo real**: marcas del checador + reparto en Equipos de trabajo. El rato en la parcela
  original (7:10 a 10:20 en la prueba) ya NO sale como «se trabajó y no estaba en el plan»: a esa hora ése era el plan.
- **Al cambiar el plan ya se puede decir la tarea nueva** («¿Qué va a hacer ahora?»). Antes sólo se cambiaba
  parcela, persona u hora y el texto seguía diciendo la tarea vieja.
- **A mañana pasa sólo lo que corresponde**: lo que no se terminó se puede marcar «pasa a mañana» aunque tenga horas
  (antes sólo se ofrecía a lo que no tenía evidencia). Lo marcado como hecho no pasa aunque se pida, y un renglón ya
  cambiado tampoco. Pedirlo dos veces no duplica.

Lo que la prueba cuenta, para que nada salga dos veces:

| Qué | Cuenta |
|---|---|
| Trabajadores | 7 en lo planeado, cada uno UNA vez; 7 asistencias |
| Tareas | 11 renglones guardados = 7 vigentes (3 originales + 4 nuevas) + 4 cambiadas; ninguno en las dos listas |
| Horas | cada persona: sus tramos suman exactamente su tiempo en el rancho y ninguno se encima con otro |
| Por parcela | la primera: 3 personas todo el día + 4 hasta el cambio; la segunda: 4 desde el cambio; la suma = lo que estuvieron |
| Pendientes | pasan 5 (3 + 2 no terminadas), uno por persona; 0 de lo hecho, 0 de lo cambiado; segunda vez: 0 |
| Dinero | 0 actividades, 0 pagos, 0 gastos creados en todo el recorrido |

### Lo que el recorrido dejó ver y NO cambié (se decide con Miguel)
- **Son dos pasos en dos pantallas**: cambiar el plan (El día → Reparto) y mandar de verdad a la gente (Equipos de
  trabajo). Si se hace sólo el segundo, la jornada dirá «trabajó en otro lado» y pedirá el porqué al cerrar. Si se
  hace sólo el primero, las horas siguen cayendo en la parcela original.
- **El cambio de plan se hace persona por persona** (cuatro veces el mismo motivo). Falta «cambiar a varios a la vez».
- **El motivo del cambio es opcional** (el de quitar sí es obligatorio). Si no se escribe, la jornada dice «sin motivo
  anotado».

## Para validar con Miguel — criterios de Luis (21 nov). NADA de esto está implementado todavía
Luis propuso seis criterios y pidió validarlos con Miguel antes de construirlos. Junto a cada uno, cómo está hoy.

| # | Criterio propuesto | Cómo está hoy | Qué cambiaría |
|---|---|---|---|
| 1 | Checar confirma la asistencia y enseña la tarea, pero **no** crea la asignación real | Así funciona ya | Nada. Sólo confirmarlo |
| 2 | La tarea terminada la confirma **el encargado**, con evidencia | La marca la persona al contestar su indicación; la jornada no pide evidencia | Botón de «terminada» para el encargado (foto, avance o nota) y que la respuesta del trabajador quede como «dice que terminó» |
| 3 | Llevar asistencia de **encargados y cuadrillas** | Encargados pueden checar, no es obligatorio; de las cuadrillas se registra el día en «Cuadrillas» pero la jornada no lo lee | Que la jornada tome la asistencia de la cuadrilla de su registro del día, y definir si el encargado checa |
| 4 | Miguel prepara y cierra; **Dirección revisa después, sin bloquear** | Cierra un administrador o un encargado; no hay revisión | Marca de «revisada por» (quién y cuándo) que no impide nada |
| 5 | **Hora de cierre** configurable | No hay hora esperada | Una regla del rancho con la hora, y aviso si pasó y no se ha cerrado |
| 6 | Conservar los motivos y que **«Otro» obligue a explicar** | Así funciona ya | Nada. Sólo revisar con Miguel si la lista de motivos es la que él usa |

Preguntas para Miguel, además de las seis:
1. Cuando cambia el plan a media mañana, ¿quiere hacerlo en un solo paso (cambiar el plan y mandar a la gente a la vez)?
2. ¿El motivo del cambio debe ser obligatorio?
3. Una tarea a medias que pasa a mañana, ¿pasa con las mismas personas o sólo como pendiente de la parcela?
4. ¿Qué evidencia le sirve para dar una tarea por terminada: foto, avance (reguladores, surcos) o su palabra?

### Recorrido para hacerlo con él (10 minutos, en su teléfono, con un día real)
1. La víspera o temprano: mandar las tareas en El día → Reparto.
2. Que dos o tres personas chequen su entrada y vean su tarea.
3. Repartirlos en Equipos de trabajo.
4. A media mañana, cambiarle el plan a uno (otra parcela, tarea nueva y motivo) y mandarlo de verdad a la otra parcela.
5. Al salir, abrir El día → Jornada: revisar las tareas, la tarjeta de cambios y las horas.
6. Cerrar la jornada, marcar qué pasa a mañana y ponerlo en el plan de mañana.
Lo que hay que oírle: qué le sobra, qué le falta y qué paso no haría en un día de verdad.

