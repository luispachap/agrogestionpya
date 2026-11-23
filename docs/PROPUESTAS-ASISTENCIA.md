# Propuestas de asistencia (Luis, 22 nov) — CONSTRUIDAS el 23 nov, con lo provisional marcado

Dos ideas de Luis para la asistencia y el reparto del trabajo. Luis pidió construirlas (23 nov). Están hechas y probadas
en el navegador con datos inventados (`auditoria_cortes`, `auditoria_gps`); lo que dice «provisional» espera a Miguel, y
el GPS y la cámara de verdad esperan la prueba de campo. Lo que NO se construyó está dicho en cada parte.

## 1. Checar desde el teléfono propio, con GPS

**Hoy:** sólo se checa en un aparato que un encargado dejó ligado (la tableta del supervisor o de Miguel): el checado
está supervisado. Desde el teléfono propio de cada quien no se puede checar.

**Lo que pide Luis:**

- Un encargado o superior es el único que checa por otros (ya es así; el pase de lista ya no lo tiene el trabajador).
- Desde su teléfono, cada quien checa SÓLO lo suyo, y el teléfono comprueba con el GPS que está cerca de algún rancho.
- Si checa en un rancho distinto del suyo de siempre, tiene que decir a qué fue, y eso queda como su actividad.

**Cómo se armaría con lo que ya existe:**

- Cada rancho necesita su ubicación (los ranchos ya tienen latitud y longitud opcionales; el mapa ya tiene límites de
  parcela). «Cerca» = dentro de un radio que el rancho define como regla (por ejemplo 300 m del rancho o dentro de un
  límite de parcela).
- Cada trabajador necesita su rancho habitual en la ficha.
- La marca guarda la posición, la precisión que dio el teléfono y la hora; sin señal funciona igual (el GPS no
  necesita internet) y sube después.
- Cerca de su rancho: marca normal. En otro rancho: pide «a qué viniste» (una actividad del catálogo o un texto) y
  queda la marca con su motivo. Lejos de todo rancho: no se registra la entrada y se le dice que avise a su encargado.
  GPS sin precisión suficiente (bajo techo, sin cielo): la marca queda «por revisar», no se tira.
- Lo que se checa desde el teléfono propio sale distinguido en Jornadas («desde su teléfono, a 40 m del rancho»), para
  que el encargado vea qué fue supervisado y qué no.

**Lo que hay que saber antes:** el GPS de un teléfono se puede falsear con aplicaciones; esto desanima el mal uso,
no lo vuelve imposible. Y necesita un teléfono de verdad para probarse (es parte de la prueba de campo).

## 2. Tabla de colores por cortes del día

**La idea:** una tabla con los trabajadores en renglones y los cortes del día en columnas (por ejemplo mañana,
mediodía y tarde). Se escoge un «pincel» (una actividad en una parcela) y se pinta a quienes la hicieron en ese corte.

| Trabajador | 7–10 | 10–13 | 14–17 |
|---|---|---|---|
| Ana | 🟩 Riego · P1 | 🟩 Riego · P1 | 🟦 Deshierbe · P2 |
| Beto | 🟦 Deshierbe · P2 | 🟦 Deshierbe · P2 | 🟦 Deshierbe · P2 |
| Caro | 🟨 Bodega | 🟩 Riego · P1 | (sin pintar) |

**Cómo se usaría en el teléfono:**

- Arriba, los pinceles como botones de color con su nombre (el color nunca va solo: cada celda lleva también la
  inicial de la actividad, para el tema claro y el oscuro y para quien no distingue colores).
- Tocar una celda la pinta; tocar el encabezado de un corte pinta a todos los presentes en ese corte; tocar un nombre
  pinta su día completo. «Repetir el corte anterior» y «copiar ayer» ahorran lo de todos los días.
- Sólo aparecen los que vinieron (checador o pase de lista), y los grupos eventuales como un renglón por cuadrilla.

**Qué guarda y cómo cuenta (con las reglas que ya están):**

- Cada celda pintada es una asignación con su hora de inicio y de fin (la misma que hoy hace «Equipos de trabajo»),
  así que el costo sale por el motor que ya está probado, sin otra cuenta de dinero.
- **Pintar no es pagar:** quien cobra por día cobra su día; los cortes sólo reparten ese día entre parcelas, como hoy
  las horas.
- Pintado pero sin marca del checador: aviso «pintado y no checó». Checó pero sin pintar: queda «por aclarar», como
  hoy; nunca se reparte solo.
- Repintar no borra: el color anterior queda en el historial, con quién lo cambió. Con la semana cerrada no se repinta
  sin reabrirla.
- Destajo: la celda dice dónde estuvo, no cuánto hizo; lo hecho a destajo se sigue anotando en su pantalla.

**Dos modos de la misma tabla:**

- **Plan** (colores claros, por la mañana): a qué va cada quien. Es la indicación del día; no genera costo.
- **Hecho** (colores sólidos, al terminar): qué hizo. Ahí nace el reparto del costo.
- Al cerrar el día, la tabla enseña dónde el hecho no coincidió con el plan.

**Para quién más sirve:** Rodolfo la vería de sólo lectura (quién hizo qué, por parcela); y vista por semana es un
mapa de calor de en qué se fue el trabajo de cada parcela.

**Lo que falta decidir con Miguel:** cuántos cortes y de qué horas (una regla del rancho, para cambiarlos sin tocar la
app); si el encargado pinta durante el día o al final; y si con esto se reemplaza «Registro de varios». Es la pieza
que `docs/JORNADA.md` dejó «evaluada» como «reasignar equipo», esperando saber cómo reasigna Miguel.


## Lo que quedó construido (23 nov)

**Tabla por cortes** (El día → «Por cortes», `src/cortes.js`): pinceles, pintar una celda, un corte entero (los que
vinieron), el día de una persona, «repetir en este corte lo del anterior» y «copiar lo de ayer» (sin pisar lo ya
pintado); repintar con historial; borrar sin borrar; avisos de «pintado y no checó» y «checó y no está pintado». Cortes
provisionales (regla `cortes_dia`: tres, dos o cuatro). **No construido:** el modo «plan» (sigue siendo Indicaciones) y
comparar el plan contra lo hecho al cerrar el día; cuadrillas como un renglón (siguen en su pantalla).

**Checar desde el teléfono propio** (`src/gps.js`): activar a la persona en su ficha (rancho de siempre y «checa desde
su teléfono»); el encargado liga el teléfono como de esa persona al salir de su cuenta; en su rancho / en otro con su
porqué / lejos (no registra) / poca precisión (por revisar); sin señal también; Jornadas lo distingue. Radio 300 m y
precisión 100 m, provisionales. **Pendiente:** probarlo con un GPS de verdad (prueba de campo); decidir si una marca
«por revisar» cuenta para el pago mientras nadie la revisa (hoy cuenta y se ve marcada).
