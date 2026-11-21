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

## 3. Etapa 2 — satélite por fecha (Sentinel-2): qué conviene

**Recomendación: leer Sentinel-2 directo desde el navegador, sin servidor y sin cuenta.** Las imágenes están
publicadas como datos abiertos en un almacén público (programa de datos abiertos de AWS, catálogo «Earth Search» de
Element 84). Comprobado el 21 nov 2026 desde esta máquina:

- el catálogo contesta sin llave y permite que lo llame una página web;
- cada banda se puede leer **por pedazos** (sólo el recorte de la parcela, no la imagen completa de 100 km);
- para un punto de la zona de Fresnillo, del 1 ago al 21 nov 2026 hay **28 pasadas** (una cada 2 a 5 días), y
  **15** con menos de 20 % de nubes en la escena.

Con eso la app puede, por parcela: listar fechas disponibles, calcular NDVI (y otros índices) con las bandas roja
e infrarroja, descartar los píxeles que el propio satélite marca como nube o sombra, y guardar **sólo el resumen**
(promedio, mínimo, máximo, % de la parcela sin nube, fecha) como evento. Costo: $0. Sin tope mensual que cuidar.

| Alternativa | Costo | Por qué no primero |
|---|---|---|
| Copernicus Data Space (Sentinel Hub) | Gratis hasta 10 mil unidades de proceso y 10 mil peticiones al mes | Pide cuenta y una llave que debe vivir en el servidor; tiene tope. Sirve de respaldo |
| Sentinel Hub comercial, EOS, Planet, etc. | De decenas a cientos de USD al mes | Gasto recurrente sin necesidad |

**Límites que hay que decir en la pantalla (y no esconder):**

- **Resolución: 10 metros por píxel.** Una parcela de 1 ha son unos 100 píxeles; de 0.25 ha, unos 25. Sirve para
  ver una parcela completa y manchones grandes; **no** ve surcos, plantas ni una fuga de cintilla.
- Los píxeles de la orilla mezclan parcela y camino: se dejan fuera (margen hacia adentro).
- Nubes y sombras: hay semanas sin dato útil (más en temporada de lluvias). Sin dato se dice «sin imagen útil»,
  no se rellena.
- **NDVI es un indicio, no un diagnóstico.** Baja con falta de agua, plaga, enfermedad, madurez, cosecha o maleza
  seca, y sube con maleza verde. La pantalla dirá «bajó respecto a la fecha anterior» o «va por debajo de las
  otras parcelas del mismo cultivo y ciclo»; nunca «tiene tal problema». Decide quien va a ver la parcela.
- Comparar parcelas sólo tiene sentido entre el mismo cultivo y fechas de siembra parecidas.
- Otros índices con valor real aquí: NDMI (humedad de la planta, bandas de 20 m) y NDRE (más sensible con cultivo
  ya cerrado, 20 m). Se agregan después de ver que el NDVI se usa.

Qué falta construir: leer el recorte (una librería de unos 60 kB que se carga sólo al abrir esa capa), la cuenta
del índice (pura, con pruebas), la línea del tiempo por parcela y la capa de color sobre el mapa.

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
