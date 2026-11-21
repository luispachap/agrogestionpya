# El Excel de rayas 2024: qué hacía, qué ya tiene AgroGestión y qué se recuperó

Archivo analizado: «Formato de Lista de Rayas 2024 - Copia 2.xlsx» (21 nov 2026). 18 hojas, unas 407 mil
fórmulas. Este documento no reproduce nombres de personas ni sueldos; el archivo no está en el repositorio.

## 1. Qué es el archivo

| Hoja | Qué trae |
|---|---|
| Base de datos | Catálogos: 13 «productos» (cultivos), 29 ubicaciones (cada una con UN cultivo fijo), 45 actividades (A01–A30, G01–G10, GA1, SUP, FAJ, FNJ, VAC), 27 trabajadores con su tabulador, y el tabulador de sueldos (14 niveles) |
| 12 hojas semanales (5 ago – 27 oct 2024) + «Formato» | Un renglón por trabajador de planta y, por día (lunes a sábado), actividad · ubicación · cultivo. Abajo, «rayas ajenos» (cuadrillas, personas, fletes), una lista de gastos y los resúmenes por cultivo |
| 29J-04A | La semana más antigua, con el formato anterior (sin cultivo, sin costos) |
| Hoja1, Hoja2, Hoja3 | Acumulados pegados a mano (valores, no fórmulas vivas) |

## 2. Reglas demostradas por las fórmulas

1. **El cultivo sale de la ubicación, y es fijo.** `cultivo = BUSCARV(ubicación, catálogo)`. Cada ubicación tiene un solo
   cultivo en el catálogo. No hay fecha ni ciclo.
2. **Clave del día = actividad + cultivo.** `DERECHA(actividad,3) & DERECHA(cultivo,3)` → «A07PAJ».
3. **El contador.** Por trabajador, 13 cultivos × 44 actividades = 572 columnas con `CONTAR.SI` de esa clave en sus seis
   días. («PURA FUERZA BRUTA DE EXCEL», dice el propio archivo.)
4. **Costo de planta = sueldo diario × días.** Sueldo diario = tabulador semanal ÷ 6. Costo por actividad y cultivo =
   `SUMAPRODUCTO(sueldo diario, contador)`. Comprobado: recalculando con esa regla salen las mismas cifras del Excel en
   las semanas sanas (67,573.45 · 68,311.91 · 62,595.84 · 23,019.08 · 18,690.20).
5. **Ajenos (cuadrillas, personas, fletes) = sueldo por día × cantidad de personas-día**, por actividad y cultivo; el
   flete, precio × cantidad. Comprobado en 4 semanas (36,100 · 69,540 · 77,490 · 4,500).
6. **Mano de obra general = planta + ajenos**, por cultivo y por actividad.
7. **El salario total del tabulador = percepciones en nómina + salario en efectivo.** El archivo guarda además lo
   dispersado y las retenciones como datos fijos; no los calcula.

## 3. Lo que el archivo NO hace (aunque parezca)

- **No calcula la nómina ni los pagos.** No hay columna de total por trabajador, ni descuentos, ni netos: la columna
  «TOTAL» está vacía. Calcula el COSTO y lo reparte por cultivo. Los sueldos son un tabulador fijo.
- **No descuenta faltas.** «Falta justificada» (FAJ) es una actividad más: si se le pone ubicación, ese día se paga
  y se carga a ese cultivo; si no, el día desaparece del costo. La falta injustificada (FNJ) nunca se usó.
- **No hay domingo.** Seis días por semana. (La libreta sí trae una hoja «Domingo»: ver dudas.)
- **No hay parcela.** La «ubicación» es el rancho o la bodega; el cultivo es uno por ubicación.

## 4. Errores y límites encontrados (no trasladar)

| Qué pasó | Efecto | Cuánto |
|---|---|---|
| El nombre de la ubicación dejó de coincidir con el catálogo (se escribía «CARRETERA 2» y el catálogo pasó a «CARRETERA 2 CA2») | El cultivo da #N/A y **ese día deja de contar en el costo, sin aviso** | 55 a 102 días-persona por semana en 6 de las 12 semanas; el costo de planta de agosto y principios de septiembre sale en 10–30 mil cuando la regla da del orden de 60 mil |
| Tres semanas con el resumen completo en #N/A | No hay cifra | 5–11 ago, 12–18 ago, 19–25 ago |
| La actividad GA1 (Alimentar, ganado) no está entre las 44 columnas del contador | Se captura y nunca se cuesta | 7 días-persona |
| La lista de gastos es la misma en 10 de las 12 hojas (fechas del 19 al 22 de agosto) | No es de esa semana: quedó copiada | 10 hojas |
| «COPIA ATEMPORAL» y Hoja1: valores pegados, con celdas sobrescritas a mano | No se recalculan; no se sabe de dónde salió una cifra | — |
| Un cultivo por ubicación para siempre | Si la ubicación cambia de cultivo, todo su pasado cambia con ella | Todo el archivo |
| Bodegas sin código (Pre ajos, Frijol, Chiles, Reparaciones) y «GEN» usado a la vez como cultivo y como ubicación | Claves ambiguas | 4 bodegas |
| Sueldo de quien no tiene tabulador = sin costo | Días trabajados que valen cero | 3 renglones |

**Conclusión sobre los importes históricos:** no son confiables como total. Las relaciones (quién, qué día, qué
actividad, dónde) sí se recuperan; los importes del Excel no se importan.

## 5. Matriz contra AgroGestión

| Del Excel | En AgroGestión | Estado |
|---|---|---|
| Captura diaria: trabajador · actividad · ubicación | Checador + asignaciones (`cuadrillas.js`, `manoDeObra`), o actividad tecleada; una sola fuente por día | **Ya existe, mejor** (horas reales, no «un día = un sexto de semana») |
| Sueldo diario = semanal ÷ 6 | `sueldoVigente` con fecha (no congela sueldos viejos); días de asistencia por trabajador | **Ya existe, de otra forma** |
| Costo de planta por actividad y cultivo | `actividadesContables` → reportes por parcela, ciclo, temporada y cierre de mes | **Ya existe** |
| Cuadrillas: personas-día × sueldo | `eventuales.js` (`cuadrilla_dia`: por día, destajo o precio por el trabajo) | **Ya existe, mejor** |
| Fletes de cuadrilla | `traslado_cuadrilla`, con criterio de reparto y «pendiente» si no hay trabajo ese día | **Ya existe, mejor** |
| Falta justificada / injustificada / vacaciones | `ausencia` (se paga o no), `sin_registro` como pregunta; vacaciones no son costo nuevo; lo pagado sin parcela es indirecto de personal con su regla | **Ya existe, mejor** (el Excel se lo cargaba a un cultivo o lo perdía) |
| Trabajo «General» y de bodega | Bodega por cultivo (directo, sin parcela), general de bodega y gastos generales aparte; nunca suben el costo de una parcela | **Ya existe** |
| Tabulador nómina + efectivo, retenciones | `pagos.js`, recibos internos (no sustituyen CFDI), `salarioIntegrado.js` por partes | **De otra forma**; el desglose fiscal/efectivo NO se importó (decisión de negocio) |
| Lista de gastos con «aplicado a cultivo» | Egresos, compras y almacén (`resultado.js`: el insumo es costo al consumirse) | **Ya existe, mejor** |
| Resumen por cultivo | Temporadas (`reporteTemporada`), cierre de mes, Finanzas → Resultados | **Existía con un defecto**, corregido (abajo) |
| Cultivo de la ubicación | `siembras`: ciclos por parcela con fechas | **Ya existía la base**; faltaba usarla por fecha en un reporte y repartir ciclos simultáneos |
| Catálogo de actividades con código | Catálogo de claves que se llena preguntando (`claves.js`) | **Faltaba conectarlos**: hecho, como referencia histórica |
| Catálogo de ubicaciones con código | Ranchos y parcelas de la app | **Falta** ligar cada clave de ubicación a una parcela real (necesita a Luis) |
| 572 columnas y recálculo de todo el libro | Eventos + cálculo por periodo, cierres con foto | **No se traslada** |

## 6. Lo que se implementó (21 nov 2026)

- **`src/excelRayas.js`**: lee de ese Excel sus catálogos y sus hojas semanales. No lee trabajadores, tabulador ni importes.
- **Referencias históricas** (`claves.js`: `referenciasDeClaves`, `sugerenciasDe`, `parecidasDe`): lo que cada clave
  significaba en un archivo, con el archivo, sus fechas y «vigencia por confirmar». Varias por clave. Se sugieren al
  preguntar; una persona confirma (`clave_aprendida` anota `deReferencia`). Nunca cambian lo ya confirmado.
- **Rayas históricas**: cada día de cada trabajador entra al histórico con lo que DECÍA el Excel (actividad, ubicación,
  cultivo), su fecha y el texto original. Sin importes.
- **`src/ciclos.js`**: el cultivo de una parcela por fecha; ciclos simultáneos reparten sin duplicar; lo que cae fuera
  de todo ciclo queda «sin ciclo», a la vista. Finanzas → «Resultado por cultivo» ya sale de ahí (antes agrupaba por
  la etiqueta fija de la parcela, igual que el Excel). El reporte por ciclo ya no carga entero a dos ciclos simultáneos.

## 7. La libreta del domingo 6-oct-2024 contra este Excel

| Clave de la libreta | Excel 2024 | Lectura |
|---|---|---|
| A07 (15 renglones, con Bod y Ajo) | Desgranar | Coherente: esa semana el Excel trae 10–13 personas diarias en «Desgranar · Bodega ajos». **Sugerida, por confirmar** |
| A17 · SF4 | Sembrar | Coherente (el Excel trae 2 personas en «Sembrar · San Felipe 4» toda la semana). Por confirmar |
| A27 · SF4 | Revolver fertilizante | Coherente (martes de esa semana). Por confirmar |
| A16 | Regar | Por confirmar |
| A23 · Gen | Sacar cintilla | Por confirmar |
| Bod | «BODEGA AJOS», con cultivo «ajo postcosecha» (PAJ). Hay además «BODEGA PRE AJOS» (cultivo AJO), Chiles, Frijol y Reparaciones | **Difiere**: hoy «Bod» = Bodega, sin distinguir cuál |
| SF4 | San Felipe 4, cultivo ajo | Coincide |
| Gen | «GENERAL» como ubicación y como cultivo | Hoy: trabajo general. Se enseñan las dos; no se mezcla |
| RA51 | No existe. Se parece a **R51** («El 51», cultivo maíz blanco) y a **RA1** (Rancho 1) | Dudosa: decide una persona |
| mB | No existe. Se parece a **MAB** (maíz blanco), que es justo el cultivo de «El 51» en el Excel | Dudosa: sugerida, por confirmar |
| Ajo | «AJO» = ajo morado; aparte «PAJ» = ajo postcosecha | La libreta escribe «Ajo» también en bodega, donde el Excel ponía PAJ |

## 8. Decisiones cerradas por Luis (21 nov 2026) y cómo quedaron

| Tema | Decisión | Cómo quedó en la app |
|---|---|---|
| RA51 | Es Rancho 51, del grupo «Ranchos 50s» (50, 51, 53). Conservar las denominaciones del Excel | «R51 · El 51» quedó como **otra forma de escribir** RA51: se lee como Rancho 51 y se conserva cómo venía y cómo se llamaba ahí. R50 y R53 del Excel **no** se juntaron con RA50/RA53: nadie lo ha confirmado |
| Bod | Es Bodega; no se sabe si siempre es «Bodega ajos» o «Pre ajos» | «Bod» guarda las dos posibilidades. Al comparar no cuenta como diferencia contra ninguna, y se dice que ese papel no distingue cuál |
| Ajo de campo / ajo postcosecha | Clasificación histórica del Excel; no suponerla en otros papeles | Al comparar, AJO y PAJ se cuentan como el mismo cultivo «clasificado distinto», y se enseña cómo lo escribía cada papel |
| «mB» | Podría ser maíz blanco; sin confirmar | Se queda como sugerencia. No se guarda como cultivo en ningún renglón |
| Domingo 6-oct-2024 | Conservar la fecha; no pasarla al lunes | El renglón lleva la marca de domingo y el documento avisa la discrepancia con el formato lunes–sábado del Excel |
| Ubicación → parcela | Pendiente | En «Claves de las rayas» cada ubicación está «por decir»: parcela · son varias · no es parcela · ya no existe, con nota, quién y cuándo. Se puede corregir y lo anterior se conserva. Mientras esté por decir, lo histórico de ese lugar no se carga a ninguna parcela ni cultivo |
| Nómina / efectivo | Conservar la posibilidad; no importar importes ni suponer esquemas | **No se construyó nada y no se importó nada.** Hoy un pago guarda por qué medio se entregó, no a qué componente corresponde. Queda descrito abajo como pendiente de diseño |
| Rayas históricas y salarios | Sin tabulador histórico confiable no hay costo | Las rayas históricas no tienen importe y ningún cálculo de costos ni de pagos las lee. Hay una prueba que truena si un módulo de dinero empieza a leer el histórico |

**Vigencia de una clave.** Una referencia del Excel se puede confirmar de dos formas: «sí, y sigue igual hoy» o «sí,
pero sólo en esas fechas». La segunda vale para los papeles de ese periodo y no dice nada de lo que la clave
significa hoy (fuera de esas fechas se sigue preguntando).

**Corregir un catálogo no altera lo confirmado.** Cada renglón incorporado guarda tres cosas: el código como venía en
el papel, la clave, y lo que se entendió el día que se incorporó. Una corrección posterior cambia cómo se enseña de
ahí en adelante, pero no reescribe ningún renglón.

**Un día por dos papeles.** Si un día ya está en el histórico por otro documento, se avisa antes de incorporar. Si se
incorpora, los dos se conservan como evidencia, el día cuenta una sola vez, y en Histórico aparece la comparación.
La app no escoge un ganador ni junta personas: «podría ser la misma» sale como pista, por confirmar.

**Nómina y efectivo (sólo descripción, sin construir).** Para distinguir componentes haría falta que cada persona
tenga dicho qué parte de lo que gana va por nómina y qué parte en efectivo, desde qué fecha, y que cada pago diga a
cuál componente corresponde. Es una decisión con efectos laborales y fiscales: la define Luis con su asesor antes de
programar nada. Los importes del tabulador de 2024 no se usan para esto.

## 9. Prueba controlada: una semana del Excel contra la libreta (21 nov 2026)

Hecha en la máquina de trabajo, con el Excel verdadero y la lectura verdadera de la libreta (la que ya se había
pagado: no se gastó crédito). **No se incorporó nada a producción.** Sin nombres de personas en este informe.

**Lo primero que salió:** la libreta es del domingo 6 de octubre y el Excel no tiene domingos. No hay ningún día que
esté en los dos papeles, así que **no se puede comparar el mismo día**; se comparó contra el sábado 5, el lunes 7 y
el martes 8.

| | Libreta dom 6 | Excel sáb 5 | Excel lun 7 | Excel mar 8 |
|---|---|---|---|---|
| Renglones (personas) | 24 | 22 | 20 | 21 |
| Desgranar (A07) | 15 | 8 | 13 | 10 |
| Sembrar (A17) | 2 | 0 | 2 | 2 |
| Revolver fertilizante (A27) | 2 | 0 | 1 | 2 |
| Regar (A16) | 1 | 2 | 1 | 2 |
| Sacar cintilla (A23) | 1 | 0 | 0 | 0 |
| En bodega | 15 («Bod») | 8 (Bodega ajos) | 13 (Bodega ajos) | 10 (Bodega ajos) |
| En San Felipe 4 | 4 | 2 | 4 | 4 |
| Trabajo general | 1 | 1 | 1 | 1 |
| En Rancho 51 / El 51 | 1 | 0 | 0 | 0 |
| Cultivo ajo | 19 | 11 | 17 (AJO y PAJ) | 14 |

- **Coincide:** la libreta se parece mucho más al lunes y al martes que al sábado: mismas actividades principales,
  San Felipe 4 con 4 personas, uno en general. Los significados del Excel (A07 Desgranar, A17 Sembrar, A27 Revolver
  fertilizante) son coherentes con dónde aparece cada clave en la libreta.
- **Difiere:** la libreta trae más gente en bodega (15 contra 13 y 10) y un riego en Rancho 51 que el Excel de esos
  días pone en otros lugares. El Excel trae actividades que la libreta no (A09, A24) y lugares que la libreta no
  (claves RA4, GU2, GON).
- **Personas:** de 24 renglones de la libreta, 16 a 18 tienen un posible nombre correspondiente en el Excel (por una
  palabra del nombre o porque empieza igual); 2 son ambiguos y 4 a 6 no tienen pareja clara. De las parejas del
  lunes, 11 tienen la misma actividad y 13 el mismo lugar o uno compatible. Son pistas: ninguna se dio por buena.
- **Qué aporta la libreta que el Excel no:** las faltas (3), los importes anotados al lado (2, tentativos), el
  domingo, y el cultivo escrito a mano en cada renglón.
- **Qué aporta el Excel que la libreta no:** el nombre completo de las personas, la actividad en palabras (no sólo
  el código), la bodega exacta, y la separación ajo de campo / postcosecha.
- **Guardias:** 424 renglones del Excel y 24 de la libreta entraron sólo al histórico; cero pagos, cero gastos,
  cero actividades, cero importes; 2 importes tentativos que no suman en nada.

**Para una comparación del mismo día hace falta** una foto de libreta de un día de lunes a sábado entre el 5 de
agosto y el 27 de octubre de 2024.

## 10. Dudas que sólo resuelve el rancho

1. ¿Se trabajó el domingo 6 de octubre de 2024, o esa hoja de libreta se pasó al Excel como lunes 7? (La comparación
   sugiere que se parece al lunes, pero no lo demuestra.)
2. ¿R50 y R53 del Excel son Rancho 50 y Rancho 53 (RA50, RA53)?
3. ¿«mB» es maíz blanco?
4. A qué parcela de AgroGestión corresponde cada ubicación (se contesta en la app, una por una, cuando se sepa).
5. Nómina y efectivo: cómo se quiere llevar (ver sección 8).
