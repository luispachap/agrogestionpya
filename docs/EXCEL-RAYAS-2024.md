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

## 8. Dudas que sólo resuelve el rancho

1. ¿«Bod» de la libreta es siempre «Bodega ajos», o puede ser «Pre ajos»? ¿Sigue valiendo separar ajo (campo) de ajo postcosecha?
2. ¿RA51 es «El 51» (R51) del Excel? ¿Y «mB» es maíz blanco?
3. La libreta trae «Domingo 6/10/24»; el Excel de esa semana va de lunes 7 a sábado 12. ¿Se trabajó ese domingo, o esa hoja era el lunes?
4. A qué parcela de AgroGestión corresponde cada ubicación del Excel (RA1–RA4, SF1–SF4, CA1, CA2, DJ1–DJ3, GU1, GU2, R50, R51, R53, CAN, GON, TUL).
5. ¿Se quiere conservar la separación «percepciones en nómina / efectivo» del tabulador? No se importó.
