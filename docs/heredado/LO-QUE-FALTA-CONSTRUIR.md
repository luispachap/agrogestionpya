# Lo que falta construir · AgroGestión

> Catálogo de funciones para el control interno del rancho. Compañero de
> `ARRANQUE-CLAUDE.md`, que dice **cómo** se trabaja aquí; éste dice
> **qué** falta.
>
> **Lo marcado ✅ VERIFICADO se comprobó leyendo el código.** Lo demás
> son propuestas del oficio, no hallazgos: hay que confirmarlas antes
> de darlas por ciertas.
>
> Las tres de aquí abajo no son las únicas que ya están rotas — son las
> que estorban para construir. **La lista completa de lo que ya falla
> hoy, con su línea, está en la sección 4 de `ARRANQUE-CLAUDE.md`**, y
> es por donde conviene empezar.

---

## ⚠ ANTES DE CONSTRUIR: LO QUE YA ESTÁ

Comprobado abriendo el archivo. **Nada de esto se vuelve a construir**
— se enchufa uno a lo que ya hay, que es más barato y menos riesgoso.

| Lo que ya está | Dónde | Qué le falta |
|---|---|---|
| **El horómetro se captura** | `App.jsx:3831`, casilla «Lectura del horómetro (hr)» | **Es su ÚNICA aparición en las 14,759 líneas.** Se teclea y nadie lo lee: ni servicios por horas, ni litros por hora, ni costo por hora |
| **El diésel se captura** | inicial, final y cargado, en la misma pantalla del tractorista | nadie lo cruza contra las horas |
| **Presupuesto contra lo gastado** | `avancePresupuesto` (`1550`, `1753`), avisos al 85 % y al 100 % (`857-861`), barra en Reportes (`4708-4712`) | está por siembra; falta por bolsa y por titular |
| **Costo por hectárea** | `porHa`, en **seis** lugares (`961`, `1064`, `1218`, `1546`, `1746`) | falta el reparto de los gastos generales, y decir que NO los reparte |
| **Comparar temporada contra temporada** | pantalla de Reportes | falta hacerlo *al mismo día del ciclo*, no al cierre |
| **La foto del ticket** | `App.jsx:5761` (`capture="environment"`), egresos `5192`, parcelas `3043` | la cámara, el guardado y la vista ya están. **Falta LEER la foto** |
| **El GPS del celular** | `getCurrentPosition` en `3789`, `4295`, `5402`, con `distKm()` Haversine ya escrito en `615` | se lee para ordenar las parcelas por cercanía **y se tira**. Nunca se guarda con el registro |
| **Antigüedad de lo que nos deben** | `genAlertas()` `909-921`: «el más antiguo lleva N días», rojo pasando de 30 | falta del lado de lo que DEBEMOS |
| **La nómina semanal** | `NominaSemanal` `13989-14189`, neto por persona | falta el destajo, y el que vino sin día capturado |

**Y una advertencia:** hay un `AiPanel` (`App.jsx:4581`) que le habla a
`api.anthropic.com` (`4616`) **sin ninguna llave**. Devuelve error y el
usuario ve «Hubo un error de conexión». No lo reutilices: no hay canal
de IA hoy, hay que construirlo. Y la llave **no puede vivir en el
navegador** — ver la sección 4 de `ARRANQUE-CLAUDE.md`, punto 8.

---

## ⚠ DOS REGLAS QUE ESTAS PROPUESTAS ROMPEN CON FACILIDAD

Se revisaron 47 de las funciones de este catálogo contra las reglas de
la casa. **Casi todas rozan las mismas dos.** Léelas antes de construir
cualquiera:

**1 · «La app informa, la persona manda».** El patrón que la rompe es
siempre el mismo: la propuesta dice *mostrar* y la construcción termina
*decidiendo* o *bloqueando*. Ejemplos reales que salieron:

- «las salidas consumen primero el lote más próximo a vencer» → la app
  decidió de cuál frasco se descuenta.
- «no da la raya por cerrada hasta que el 100 % del dinero tiene
  destino» → viernes a las seis, la gente formada, y la pantalla no
  deja cerrar.
- «vale de salida con destino obligatorio» → almacén a las seis de la
  mañana, la camioneta esperando, y no deja guardar.

**La forma correcta siempre es la misma:** enseñar la resta y callarse.
«Salieron 3 L más de los que pedía la receta» sí; «te pasaste» no. Y
**nunca bloquear la captura de algo que en el mundo real ya ocurrió**.

**2 · «Funciona sin internet».** Cinco propuestas lo rompen de verdad,
y hay que decirlo en voz alta antes de empezar: el **OCR local** (el
motor pesa megas y `public/sw.js` es *red primero* — sólo precachea la
fuente de iconos, 11 KB), la **IA**, **bajar CFDI del SAT**, el **mapa
por CDN**, y **descargar la lista 69-B**.

No es motivo para tirarlas. Es motivo para que cada una **diga que
necesita señal** en vez de fallar callada — que es exactamente lo que
ya pasó una vez con los iconos, y por eso la fuente se autohospedó.

---

## ⚠ TRES COSAS QUE HAY QUE ARREGLAR ANTES DE CONSTRUIR NADA

### 1 · Se puede borrar dinero sin dejar rastro ✅ VERIFICADO

`del()` (≈ línea 2381) hace dos cosas: quita el registro del arreglo y
replica el borrado a la nube. **No escribe una sola línea en
`bitacora`.** Ni quién, ni cuándo, ni qué decía antes.

Y el botón del bote está en **ingresos** (5307), **egresos** (5329),
**préstamos** (6444), **caja chica** (6576) y **créditos** (6903,
10066) — este último con el mensaje *«¿Eliminar este crédito y todo su
historial?»*.

Y del lado de la nube es igual: las 11 hojas de `supabase/` dan `for
delete using (tiene_perfil())` — cualquiera con perfil borra cualquier
renglón de cualquier tabla. Busqué tabla de auditoría: **no hay
ninguna.**

En una familia donde nadie desconfía de nadie, eso parece cómodo hasta
el día en que hay que reconstruir un mes y la mitad de los renglones ya
no existe. Un abono de $30,000 borrado «porque estaba mal capturado» y
el proveedor que cobra otra vez: no hay forma de probar el primer pago.

**Cómo se arregla:** nada de dinero se borra — se **cancela**, con
motivo y con quién. El registro se queda, tachado y visible. Es la
regla de ATALAYA: la auditoría es de **sólo inserción**, sin forma de
modificar ni de borrar.

### 2 · Los créditos no guardan cuándo vencen ✅ VERIFICADO

`creditos` lleva monto y abonos. De vencimiento, plazo o condiciones:
**cero menciones**. Un saldo sin fecha de vencimiento no es una deuda,
es un número. El fertilizante a 90 días de marzo se descubre vencido
cuando el proveedor corta el crédito a media aplicación.

### 3 · El dinero va en punto flotante ✅ VERIFICADO

**205 `parseFloat`, cero decimales exactos.** Muerde donde más se
repite: `precio × numCajas` (≈ 11939), `tarifa × unidades` del destajo
(≈ 8720), `costoAsignado × cantidad + transporte` (≈ 7487) y el reparto
de costos entre cultivos (≈ 1030).

**Un elogio, para que no se rompa:** el reparto de la revoltura entre
tarimas (≈ 12794) ya le da el resto a la última —`cajas - repartido`—
para que la suma cuadre exacta. Es el patrón correcto, el mismo de
ATALAYA. El sistema tiene buen criterio en partes; le falta
consistencia.

---

## CAPÍTULO 1 · EL DINERO (la prioridad)

### 1.1 Leer el estado de cuenta del banco
Hoy AgroGestión **no sabe cuánto hay en el banco**: ni saldos, ni
movimientos, ni cortes. Todo se captura a mano, a criterio de quien se
acuerde, y nadie ha comparado nunca la app contra el banco. Migue
transfiere $180,000 el 12 de marzo, lo captura el 18 con fecha del 18,
redondeado — el banco cobró $180,032.

**Hace:** se sube el archivo del banco —BBVA, Banorte, Bajío,
Santander, la caja popular— y sale en movimientos con fecha, concepto,
referencia, cargo/abono y saldo corrido. **Cada estado se valida a sí
mismo antes de entrar:** saldo inicial + abonos − cargos = saldo final,
*y renglón por renglón*. Si no cuadra al centavo, entra marcado **NO
CONFIABLE** y no alimenta ningún reporte. Guarda la cuenta enmascarada
(****4417), reconoce el mismo estado por banco+cuenta+periodo para no
cargarlo dos veces, y registra la fecha de corte: de ahí, y sólo de
ahí, sale el «saldo al día X».

**Empieza por Excel/CSV, no por PDF.** `excelLoader.leerExcel` ya
existe: entra casi gratis, sin dependencias, sin backend, y sirve
offline. El PDF, después, y sólo para el banco que no dé otra cosa.

**NO hace:** no se conecta al banco, **no pide claves ni token, no
guarda credenciales de banca en línea de nadie** — se sube un archivo
que un humano descargó. No corrige el renglón que no cuadró. No
clasifica el gasto en esa pantalla. Y **no deja editar ni borrar un
movimiento del banco**: el banco es la verdad.

### 1.2 ¿A dónde se fue cada peso?
La pregunta no es «¿tienes la factura?» — ésa es la pregunta chica. En
agosto salieron $840,000; entre egresos, raya y compras se explican
$610,000. Los otros $230,000 son tres retiros de ventanilla y una
transferencia a una persona. **Ninguno es necesariamente robo — pero
hasta que alguien les ponga nombre, el rancho no sabe qué pasó con su
dinero.**

Cada peso queda en uno de tres estados: **explicado**, **explicado sin
comprobante**, o **SIN EXPLICACIÓN** con nombre, fecha y monto.

**NO hace:** no acusa. «Sin explicación» quiere decir que falta
información, no que falte dinero, **y la pantalla lo dice con esas
palabras**. No auto-concilia por parecido: propone con el criterio a la
vista —«mismo monto, 9 días de diferencia, mismo proveedor»— y espera
un sí.

### 1.3 Varios RFC, una sola empresa ← **el eje**
Ver la sección 5 de `ARRANQUE-CLAUDE.md`. Titulares y bolsas · un solo
libro del rancho · **cuenta corriente entre socios** · rancho contra
personal · a nombre de quién quedó cada comprobante.

**Es la función que evita pleitos entre hermanos**, y la que más va a
agradecer la familia dentro de dos años.

### 1.4 El dinero que sólo cambió de bolsa
La venta entra al Bajío, la raya sale de Banorte, el efectivo vive en
la caja del encargado. Hoy cada traspaso se ve como gasto de un lado e
ingreso del otro: **el año se infla por los dos lados**.

Y el puente que más importa: **todo retiro de efectivo del banco tiene
que aparecer como entrada en alguna caja, con el nombre de quién lo
recibió.** La lista de «retiros que ninguna caja recibió» es de lo
primero que debe ver el dueño.

**NO hace:** no une un par por su cuenta ni cuando cuadra perfecto —dos
pagos iguales al mismo proveedor el mismo día también cuadran perfecto.
No supone quién recibió el efectivo aunque sólo haya un encargado.

### 1.5 Cajas con dueño y arqueo
Hoy `cajachica` es una bolsa sin dueño. En un rancho hay tres o cuatro
efectivos vivos: la caja de Migue en Aguascalientes, la del encargado
en Zacatecas, el fondo del mayordomo para diésel.

Cada caja con nombre, **custodio con nombre y apellido** (no un rol) y
fondo fijo. El arqueo se captura **como se cuenta de verdad**: cuántos
billetes de 1000, 500, 200, 100, 50 y 20. La diferencia queda con
fecha, hora, quién contó y quién presenció.

**NO hace:** **no ajusta el saldo al conteo. Nunca.** Un sistema que
«cuadra solo» borra justamente el dato que servía.

### 1.6 Hasta dónde puede gastar cada quien
Dos encargados compraron la misma refacción el mismo día en pueblos
distintos, $11,800 cada uno; se supo tres semanas después. Topes por
persona y por tipo, con escalón. Detecta el **gasto partido**: tres
cargos de $2,900 al mismo proveedor el mismo día.

**NO hace — y va contra el instinto:** **NO IMPIDE REGISTRAR UN GASTO
QUE YA SE HIZO.** Si la app bloquea, el gasto no desaparece: desaparece
el registro. Marca y avisa; nunca rechaza. Y estar por debajo del tope
**no es lo mismo que estar autorizado**: la pantalla no los confunde.

### 1.7 ¿Alcanza para el sábado?
La raya del sábado no se aplaza, ni la luz de los pozos. Una pantalla y
una palabra: **ALCANZA, FALTA, o NO SÉ TU SALDO** — y siempre pegado de
dónde salió cada saldo y de qué fecha: «Bajío al 3 de septiembre, hace
4 días; caja de Zacatecas arqueada hace 11 días».

**NO hace:** no dice «no compres». Y cuando el dato está viejo o falta
un banco por leer, **dice que no sabe** en vez de contestar con la
mitad.

### 1.8 Lo que debemos y lo que nos deben
Antigüedad clásica: por vencer, 1-30, 31-60, 61-90, +90. Del lado de
cobrar se engancha a `embarques` y `Consignaciones`, que ya saben qué
salió. Y muestra **cuántos días tarda en pagar cada comprador según SU
PROPIO historial** — no una regla general: la conducta de ese hombre.
Compara contra la **misma temporada del año anterior**, porque el ajo
es estacional.

### 1.9 Anticipos a proveedores
El diente de siembra se aparta en agosto para sembrar en octubre. Hoy
eso entra como egreso y desaparece. $85,000 de anticipo, el proveedor
entregó el 70 % y el resto «la semana que viene»; en febrero nadie se
acordaba de los $25,500 vivos.

El anticipo es **dinero entregado que todavía no es gasto**. La lista
principal: anticipos viejos sin aplicar, ordenados por días — ahí es
exactamente donde se pierde el dinero de un rancho.

---

## CAPÍTULO 2 · LOS PAPELES

**2.1 El buzón de papeles.** El encargado paga $2,340 en efectivo por
una banda y guarda el ticket en la bolsa de la camisa. **Esa camisa se
lava el sábado.** La foto entra aunque el lector falle; no se pide
clasificar ni teclear el RFC — el que carga costales no tiene por qué.

> **La cámara ya está.** `App.jsx:5761` abre la trasera con
> `capture="environment"` y guarda la imagen; lo mismo en egresos
> (`5192`) y en parcelas (`3043`). Lo que no existe es **leerla**: hoy
> el trabajador teclea a mano proveedor, monto y fecha con la foto ya
> tomada al lado. Ahí está el trabajo, no en la cámara.

**2.2 Leer sin pagar por leerlo.** El rancho le compra a los mismos
veinte proveedores todo el año. Se guarda **dónde** estaba el dato, no
el valor; el mes que entra ese proveedor se lee gratis. **No inventa un
campo que no encontró:** lo deja vacío y dice cuál falta.

**2.3 El QR de la factura impresa.** **NO le hagas OCR al total.** Un 3
leído como 8 sale plausible y equivocado y nadie lo revisa. El QR dice
*cuál* factura es; lo demás sale del XML.

**2.4 La remisión no es la factura.** La agroveterinaria deja treinta
remisiones en la temporada y factura una vez a fin de mes.

**2.5 Lo pedido, lo facturado y lo recibido.** Fito pide 40 sacos. La
factura dice 40. Entraron 38 porque el camión llegó a las siete y nadie
contó. Se pagaron 40.

**2.6 Concepto por concepto**, no factura por factura.

**2.7 Los tickets que todavía se pueden facturar.** Ahí hay dinero
recuperable y el plazo corre.

**2.8 Los papeles que no llegaron** · **2.9 La compra a quien no
factura** · **2.10 Proveedores en la lista 69-B del SAT**.

---

## CAPÍTULO 3 · EL GANADO (no existe nada)

**3.1 El padrón: cada animal con nombre y apellido** — arete, origen,
altas y bajas · **3.2 El cuadre del hato** · **3.3 Aretes, guías y
fierro** · **3.4 La báscula: lo que sube cada día**, ganancia diaria ·
**3.5 La jeringa: qué se le puso y hasta cuándo no se vende** — el
**tiempo de retiro**; vender antes es un problema serio · **3.6 Lo que
no se vacunó** · **3.7 El empadre y la palpación**: las vacas que no
están cargadas · **3.8 El parto, el calostro y el destete** · **3.9 La
mortandad también se anota** · **3.10 Potreros y carga**: cuántos
aguanta este pedazo · **3.11 El forraje: ¿alcanza hasta que llueva?** ·
**3.12 Cuánto cuesta el kilo que estás produciendo** · **3.13 El
embarque**: los kilos que salieron contra los que llegaron · **3.14 El
ganado que no es tuyo** (a medias, en aparcería) · **3.15 La ordeña** ·
**3.16 La carpeta del robo, lista antes de necesitarla**.

---

## CAPÍTULO 4 · LO QUE YA SE CAPTURA Y NADIE MIRA

**4.1 Diésel contra horas de máquina.** ✅ El tractorista **ya captura**
diésel inicial, final y cargado. Se cargan 200 litros y el tractor
reporta 6 horas de rastreo; ese tractor gasta 11 L/h: son 66 litros, no
200. **NO acusa a nadie de robo ni usa la palabra:** dice «el tractor 3
en barbecho viene en 14.2 L/h; su promedio de las últimas 9 labores de
barbecho es 10.8».

**4.2 El horómetro no va para atrás.** La cuenta sólo sirve si las
horas son ciertas. **Y el horómetro ya se captura** (`App.jsx:3831`) —
es su única aparición en todo el archivo: se teclea y ahí muere. **No corrige la lectura por su cuenta ni la borra:**
la deja visible y marcada — el patrón de quién captura mal también es
información.

**4.3 El tanque del rancho.** La pipa que descarga y la manguera que
sale sin vale a las cinco de la mañana. **No prorratea el faltante
entre las máquinas para que cuadre: cuadrar repartiendo es exactamente
la forma en que se esconde un faltante.**

**4.4 Servicio por horas, no por calendario.** Aceite a las 250,
filtros a las 500. Si la última lectura es vieja, **no estima**: dice
«del tractor 3 no sé sus horas».

**4.5 El expediente del tractor.** **No dice «véndelo» ni
«repáralo»:** pone el costo por hora de cada máquina lado a lado y
Rodolfo saca su conclusión.

**4.6 Costo promedio de bodega.** Urea a $580 el bulto en marzo y a
$940 en agosto; salen 40 bultos a la parcela 7 — ¿cargó $23,200 o
$37,600?

**4.7 Vale de salida firmado.** **No bloquea la salida por falta de
saldo:** el producto ya salió; negarlo en la app sólo logra que nadie
capture y que el sistema se vuelva mentira.

**4.8 Mermas con nombre.** Un «ajuste −30 bultos» sin causa es dinero
que se fue sin que nadie explicara nada, y en dos meses es costumbre.

**4.9 Conteo físico a ciegas.** El conteo en que el capturista ve el
saldo del sistema **no es un conteo, es una copia**.

**4.10 Caducidades de agroquímico** · **4.11 Resguardo de
herramienta** · **4.12 Pólizas, verificaciones y permisos** — y **no
afirma que algo está vigente sólo porque no hay aviso**.

---

## CAPÍTULO 5 · EL CAMPO

**5.1 El costo por hectárea** — **`porHa` ya existe en seis lugares.**
Lo que falta no es la división: es decir **sobre qué está calculado**
(los gastos generales NO se reparten, y la pantalla no lo dice) y qué
pasa con la parcela sin hectáreas capturadas · **5.2 Los pesos que no
tienen parcela** · **5.3 Las hectáreas que de veras mide la parcela** ·
**5.4 El día del ciclo, no el del calendario** · **5.5 La etiqueta del
envase** · **5.6 Hasta cuándo no se entra y hasta cuándo no se corta**
— reentrada y carencia; **es seguridad de personas, no un dato más** ·
**5.7 Los kilos de nitrógeno, no los bultos** · **5.8 El caldo que se
preparó contra lo que salió del almacén** · **5.9 El agua: horas de
bomba, láminas y volumen del pozo** · **5.10 La mínima de anoche** ·
**5.11 Los kilos que salieron del surco y los que llegaron a la
báscula** · **5.12 Cómo va la cosecha contra la del año pasado, al
mismo día**.

---

## CAPÍTULO 6 · LA GENTE

**6.1 Vale de destajo y su cuadre con lo que entró a la estiba** ·
**6.2 La raya en efectivo: sobres, cambio y acuse** · **6.3 Marcaje con
foto y geocerca: evidencia, NO candado** · **6.4 Cada jornada con su
parcela** · **6.5 El mismo señor cobrando en dos cuadrillas** · **6.6
Quién cobró sin estar cubierto por el IMSS** · **6.7 Saldo vivo de
préstamos y el tope del descuento** · **6.8 Rendimiento del destajista
contra su propia parcela** · **6.9 Reentrada a parcela aplicada: quién
pisó y a qué hora**.

---

## CAPÍTULO 7 · SIEMPRE

- **Nada de dinero se borra** (ver arriba: es lo primero).
- Rastro inmutable de quién hizo qué.
- Quien compra no paga.
- **Respaldo que se verifica restaurándolo** — uno que nunca se
  restauró no es un respaldo, es una suposición.
- Rutinas que corran solas, y **la métrica que importa no es «falló»,
  es «NO APARECIÓ»**.
- Comparar siempre contra el **mismo periodo del año anterior**: un
  rancho es estacional y comparar contra el mes pasado produce alarmas
  falsas que enseñan a ignorar las alarmas.

---

## POR DÓNDE EMPEZAR

1. **Nada de dinero se borra** — es chico y tapa el hueco más grave.
2. **Vencimiento en los créditos** — es de una tarde.
3. **Leer el estado de cuenta en Excel/CSV** — el mayor cambio por el
   menor costo; no toca la arquitectura.
4. **Titulares y bolsas** + **cuenta corriente entre socios** — el eje.
5. **¿A dónde se fue cada peso?**
6. De ahí, el ganado: es lo más grande y no hay nada.

Y a lo largo de todo: **una prueba con nombre por cada cosa que se
arregle.**
