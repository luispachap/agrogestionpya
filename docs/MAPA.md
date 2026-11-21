# El mapa del rancho: qué hay, qué sigue y cuánto cuesta

Línea abierta por Luis el 21 nov 2026: mapa agrícola → satélites → drones. Regla de fondo: **no es un sistema
aparte**. Pinta las mismas parcelas, ranchos y ciclos; lo único que agrega son los límites y, después, imágenes.

## 1. Lo que ya está (etapa 1)

- Pantalla «Mapa del rancho» (grupo Campo; la ven administrador, encargado, agrónomo y dirección).
- Imagen de satélite de fondo, ranchos y parcelas con su límite real, color por el cultivo del ciclo vigente.
- Trazar un límite tocando las esquinas sobre la imagen, arrastrarlas, meter esquinas en medio de un lado, o poner
  una esquina «donde estoy» con la ubicación del teléfono (sólo si el teléfono da ±15 m o mejor).
- Traer límites de un archivo: KML (Google Earth) o GeoJSON, en latitud/longitud. Nada entra hasta decir de qué
  parcela es cada figura. KMZ y shapefile todavía no se leen (se dice cómo exportarlos).
- La superficie se **mide** del polígono (con la forma real de la Tierra a esa latitud). La que la parcela tiene
  capturada **no cambia sola**: se enseñan las dos y la diferencia; «usar la medida del mapa» lo decide una persona.
- Al tocar una parcela: cultivo, variedad, ciclo vigente, superficie, actividades, riegos, fertilizaciones,
  aplicaciones, cosechas y —quien ve dinero— costo de actividades y gastos directos, del ciclo vigente.
- El módulo de dron que ya existía usa estos límites: una foto cae dentro de una parcela o no; ya no por cercanía.

Cómo está hecho: `src/mapa.js` (puro, con pruebas) y `src/Mapa.jsx` (pantalla). Un límite es un evento
`limite_geo` (`de: parcela|rancho`, contorno, huecos, de dónde salió, superficie). Corregir es otro evento; quitar
pide motivo; lo anterior se conserva. No hay tabla nueva ni nada que instalar en la base.

**Lo que NO hace:** no supone límites (parcela sin límite = «sin límite»), no divide una parcela en lotes, no
reparte costos por la superficie medida si nadie lo decide, y la imagen de fondo **no es de hoy**.

**Sin validar:** todo esto se probó con un rancho inventado. Falta que alguien trace una parcela real en el
teléfono, en el campo, y diga si las esquinas caen donde deben.

## 2. La imagen de fondo: de dónde sale y qué cuesta

| Opción | Costo | Condiciones | Nota |
|---|---|---|---|
| **Esri World Imagery, sin cuenta** (la que ya usaba la app para ubicar un punto) | $0 | No pide llave. Sus términos para apps de terceros no son claros: Esri empuja a usar cuenta | **Es la que está puesta.** Buena resolución en la zona |
| Esri con cuenta (Location Platform) | 2 millones de mosaicos gratis, luego 0.15 USD por mil | Cuenta y llave | La vía «en regla» de la misma imagen |
| Mapbox (satélite) | 750 mil mosaicos al mes gratis, luego 0.25 USD por mil | Cuenta y llave pública | Alternativa equivalente |
| MapTiler | Gratis sólo para uso no comercial (100 mil peticiones/mes); pagado desde 30 USD/mes | Cuenta | No conviene |
| OpenStreetMap («Caminos») | $0 | Atribución | Ya está como segundo fondo |

Uso esperado del rancho: unas pocas personas, decenas de aperturas al día → miles de mosaicos al mes, muy por
debajo de cualquier tope gratuito. **Cambiar de proveedor es cambiar un renglón** (`CAPAS_BASE` en `Mapa.jsx`).
Decisión que queda para Luis, sin prisa: seguir así, o abrir una cuenta gratuita de Esri o Mapbox para estar en
regla (no cuesta, pero es una cuenta más).

## 3. Etapa 2 — satélite para análisis (Sentinel-2): hecho el 21 nov 2026

**Qué hay.** En la ficha de una parcela con límite, el botón «Satélite» abre las pasadas de Sentinel-2 del ciclo
vigente (sin ciclo, los últimos 90 días): por cada fecha, día y hora, satélite, nubosidad de toda la pasada, cuántos
cuadros de 10 m de la parcela se usaron, y el índice (vigor NDVI, humedad NDMI) o la foto en color real, pintada
encima del mapa. Línea del tiempo del ciclo, comparación entre dos fechas, y avisos de cómo leerlo.

**Dos imágenes que no se confunden.** El FONDO del mapa es un mosaico sin fecha (ubicar y trazar). La capa de
análisis es una pasada con fecha; cuando está puesta, arriba dice «Encima: Sentinel-2 del …, para análisis. El
fondo es otra imagen, sin fecha», y se puede quitar para ver el fondo.

**Cómo se eligió la fuente (verificado el 21 nov desde esta máquina y desde un navegador real):**

| Vía | Qué se midió | Resultado |
|---|---|---|
| **Planetary Computer (Microsoft): catálogo + recorte hecho en su servidor** | Sin cuenta ni llave; deja que lo llame una página web. Recorte de una parcela de 4.5 ha con 5 bandas: **~10 kB y 0.4–0.9 s**. 28 fechas (casi 4 meses): **297 kB y 9 s** en total; 13 fechas en el navegador: 3.9 s | **Es la que se usa** |
| Lectura directa del almacén público en AWS (Earth Search) | Sin cuenta ni llave. Pero las imágenes vienen en bloques de 1024 × 1024: leer UNA fecha de una parcela baja **~3.3 MB** (5.4 MB con color real). 28 fechas ≈ 90 MB | Funciona, pero es pesada para un teléfono en el campo. Queda como **respaldo** si la primera falla (falta programarlo: pide convertir coordenadas a su proyección) |
| Copernicus Data Space (Sentinel Hub) | Gratis hasta 10 mil unidades de proceso y 10 mil peticiones al mes | Pide cuenta y una llave guardada en el servidor. Segundo respaldo |
| Servicios comerciales | Decenas a cientos de USD al mes | No hacen falta |

**Costo:** $0. No se abrió ninguna cuenta ni se instaló nada en la base.

**Riesgos que hay que saber:**
- Planetary Computer es un servicio gratuito de Microsoft, sin compromiso de disponibilidad, y puede poner límites
  o cambiar. **No pude leer sus condiciones de uso desde aquí** (su página no se deja leer sin navegador): lo
  técnico está comprobado; lo legal queda por revisar. Si deja de servir, la app lo dice y no enseña datos viejos
  como nuevos; el respaldo es la lectura directa de AWS.
- Los datos son del programa Copernicus (libres y abiertos); la pantalla lleva el crédito que piden.
- El recorte llega acomodado a una cuadrícula de latitud/longitud con cuadros de ~10 m (no exactamente los
  cuadros originales del satélite). Para promedios por parcela no cambia nada que importe.

**Cómo cuenta (`src/satelite.js`, con pruebas):**
- Sólo cuentan los cuadros cuyo centro cae dentro del límite y a más de 5 m de la orilla (los de la orilla mezclan
  parcela y camino).
- Lo que el propio satélite marca como nube, sombra, nieve o sin dato **no cuenta y no se rellena**. Un día tapado
  no tiene número: ni cero ni el de la vez pasada.
- Estados de cada lectura: completa · parcial (menos de 60 % de la parcela a la vista) · parcela muy chica (menos
  de 9 cuadros) · sin imagen útil. **A la línea del tiempo sólo entran las completas.**
- Una fecha que se sale de sus dos vecinas (y ellas coinciden) se marca **dudosa**: casi siempre es una nube
  delgada que el satélite no marcó. No se quita ni se corrige. (Pasó en la prueba real: 0.43 → 0.18 → 0.42.)
- Comparar dos fechas dice cuánto cambió; un cambio menor a 0.05 se dice «prácticamente igual». **Nunca dice por
  qué.** Hay una prueba que truena si en ese texto aparece «plaga», «riego», «enfermedad» y parecidas.
- Los datos desde 2022 traen un desfase que hay que quitar; los anteriores no. Se respeta por fecha.

**Qué se guarda:** sólo el resumen de cada pasada por parcela (evento `lectura_satelital`: promedio, rango, cuadros
usados, nubes, satélite, fuente), atado al límite con que se midió. La imagen no se guarda: se vuelve a pedir (10
kB). Si el límite se corrige, las lecturas viejas no se heredan. Guarda el administrador; los demás perfiles ven
y calculan, sin guardar.

**Lo que NO hace todavía:** comparar parcelas entre sí en una misma gráfica; avisar solo cuando algo baja;
índices NDRE/otros; guardar la imagen para verla sin señal; analizar ciclos ya cerrados (hoy: ciclo vigente o 90 días).

**Camino para drones:** la capa de análisis es una imagen con sus cuatro orillas puesta sobre el mapa y recortada
con el límite de la parcela. Un ortomosaico entrará por el mismo lugar: otra fuente de imagen, el mismo recorte,
la misma cuenta por parcela, con su propia resolución y sus propias advertencias.

## 4. Etapa 3 — drones: qué se puede y qué no

Ya existe: subir fotos sueltas del dron, leer su posición y fecha, saber de qué parcela son y compararlas en el
tiempo (`src/dron.js`, pantalla «Dron»). Ahora, con los límites, esa ubicación es exacta.

Dos cosas distintas, y la app las debe distinguir:

| | Fotos sueltas | Levantamiento para mapa |
|---|---|---|
| Qué es | Tomas individuales, a cualquier altura y ángulo | Vuelo en cuadrícula, cámara hacia abajo, con traslape (70–80 %) |
| Sirve para | Ver, comparar en el tiempo, anotar | Armar un ortomosaico: una sola imagen medible, a centímetros por píxel |
| Se puede medir encima | No | Sí (áreas, distancias), con la precisión del vuelo |
| Índices de vigor | No confiables con cámara normal | Sólo con cámara multiespectral y su calibración |

- **Armar el ortomosaico no lo hace la app.** Requiere un programa de fotogrametría: WebODM / OpenDroneMap
  (abierto, gratis, corre en una computadora propia) o servicios de pago. La app **recibe** el resultado.
- Formato que se recibirá: GeoTIFF «optimizado para la nube» (COG), que se puede ver por pedazos sin bajarlo todo.
- **Peso:** un ortomosaico de una parcela pesa de cientos de megas a varios gigas. El plan gratuito actual da 1 GB
  de archivos en total. Antes de recibir el primero hay que decidir dónde vivirán (es un gasto posible: decisión
  de Luis). Mientras, el archivo original se queda con quien voló.
- Con cámara normal (RGB) hay índices «visibles» (VARI, exceso de verde): se enseñarán como **color relativo dentro
  de ese vuelo**, no como NDVI ni comparables entre vuelos.
- Multiespectral: sólo si el archivo trae las bandas y la calibración. Sin eso, no se calcula.

Lo que ya quedó preparado: el mapa trabaja por capas; los límites son la llave para recortar cualquier imagen por
parcela; y cada cosa nueva (una fecha de satélite, un levantamiento) entra como evento con su procedencia.

## 5. Pendientes de decisión (de Luis)

1. Proveedor de la imagen de fondo: seguir como está o abrir cuenta gratuita (sección 2).
2. Si la superficie medida debe volverse la superficie oficial de cada parcela (hoy se decide parcela por parcela).
3. Dónde vivirán los ortomosaicos cuando haya drones (sección 4).
4. Lotes dentro de una parcela (dos cultivos a la vez con su propio contorno): hoy un ciclo no tiene contorno propio.
