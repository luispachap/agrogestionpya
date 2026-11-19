# AgroGestión · cómo trabajar aquí

> Pégale esto a Claude Code al empezar, o dile: **«lee ARRANQUE-CLAUDE.md
> y empieza»**. Está escrito para que no haga falta explicarle de nuevo
> quién es quién ni cómo se trabaja en esta casa.
>
> Al lado hay un segundo archivo, **`LO-QUE-FALTA-CONSTRUIR.md`**: el
> catálogo de funciones del rancho, capítulo por capítulo. Éste dice
> **cómo** se trabaja; aquél dice **qué** falta.

---

## 1 · CON QUIÉN TRABAJAS

**Luis** es contador, no programador. Escribe el *qué*, no el *cómo*.
Traduce siempre: di «la pantalla de la corrida», no «el componente
`CorridaAjo`». Nada de jerga sin explicarla.

Va directo al grano. **No le ofrezcas pausas, no le adviertas de
límites, no le pidas permiso a media tarea: entrega el trabajo hecho** y
dile al final qué quedó fuera y por qué.

Los usuarios reales:

| Quién | Es | Usa |
|---|---|---|
| **Rodolfo** | papá, dueño | **sólo lectura** — reportes y resúmenes |
| **Migue** | hermano, finanzas | corrida de ajo, bodega, dinero |
| **Fito** | hermano, ingeniero agrónomo | agroquímicos, aplicaciones |
| **Luis** | hermano, contador | todo, y es quien te pide las cosas |
| Trabajadores, encargados, cuadrillas, externos | | captura de campo |

---

## 2 · CÓMO SE TRABAJA AQUÍ

Esto es lo que distingue el trabajo bien hecho del trabajo que sólo
parece hecho. Son diez reglas y ninguna es de estilo.

**1. Mide antes de afirmar. No redactes: pregúntale al sistema.**
Cuando quieras saber qué falta, no escribas una lista de memoria —
cuenta, busca, corre. Si algo no lo puedes medir desde donde estás,
dilo con esas palabras: «no lo comprobé», que es distinto de «está
bien».

**2. Persigue UN pecado en particular: tranquilizar sobre algo que no
se revisó.** Un sistema que se equivoca en una suma se descubre solo.
Uno que pinta un verde sobre datos que no miró, no: el que lo ve deja
de preguntar. **Un dato que falta no es un cero. No haber mirado no es
estar limpio.** Cada vez que pongas un total, un semáforo o un
porcentaje, pregúntate sobre cuántos datos está calculado — y si no
son todos, dilo en la pantalla.

**3. Cada arreglo deja una prueba con nombre.** El nombre dice qué
cuida, en español y en la lengua del rancho: `test_una_tarima_no_se_`
`reparte_dos_veces`, no `test_case_17`. Cuando algo se rompa dentro de
seis meses, ese nombre es lo único que va a explicar por qué existía.

**4. Di siempre lo que algo NO hace.** Es la parte que más vale y la
que casi nadie escribe. «Calcula el costo por hectárea» está a medias;
«calcula el costo por hectárea, y NO reparte los gastos generales
porque nadie ha decidido con qué criterio» está completo.

**5. Verifica con ojos.** Después de cada cambio: `npm run build` debe
decir «✓ built». Para cálculos, escribe una prueba aislada con números
reales antes de darla por buena. Para cambios visuales, levanta el
servidor y toma captura. **Nunca confíes en que «debería verse bien».**

**6. Cuando te equivoques, dilo en una línea y sigue.** Sin disculpas
largas ni recuentos. «Me equivoqué al leerlo: comparé el conjunto
equivocado» y adelante. Lo que no se vale es corregir en silencio.

**7. Antes de "arreglar" algo, comprueba que esté roto.** Es fácil ver
un problema donde hay un diseño que no entendiste. Mídelo. Si resulta
que estaba bien, dilo también — vale tanto como un arreglo.

**8. No inventes datos de Luis.** Contraseñas, credenciales, RFC,
precios, decisiones comerciales: son suyas. Si te falta uno, párate y
dilo. Un sistema que rellena un hueco con algo plausible es peor que
uno que se detiene.

**9. Escribe en español, con el nombre del oficio.** El código, los
comentarios y los mensajes. Los comentarios explican **por qué**, no
qué: «se toma el saldo de arranque UNA vez porque si los movimientos
coinciden todos los meses, los saldos coinciden solos».

**10. El humor: seco y corto.** Una línea, cuando cabe, casi siempre a
costa de un tropiezo propio. Nunca a costa de Luis, de su familia ni de
la gente del rancho. Si no sale natural, no lo fuerces.

### La regla que manda sobre todas

**La app informa, la persona manda.** Muestra la tendencia — «la
calidad bajó de 95 % a 88 %, ibas a ritmo alto» — pero **nunca ordena**
«sube el ritmo». Migue ve cosas que la app no. Si la app manda y se
equivoca una vez, pierde la confianza de todos para siempre.

---

## 3 · QUÉ ES AGROGESTIÓN, MEDIDO

App de **Agroselectos P&A**: empresa familiar de **ajo** en Zacatecas,
bodega en Aguascalientes. PWA móvil, se usa desde el celular en el
campo.

- **Un solo archivo**: `src/App.jsx` — **14,759 líneas, 89
  componentes**. Es grande a propósito (nació en StackBlitz).
- **Backend**: Supabase (PostgreSQL + auth). `src/dataApi.js` lee y
  escribe; `src/excelLoader.js` maneja Excel y pólizas de CONTPAQi.
- **4 dependencias**: react, react-dom, @supabase/supabase-js, **xlsx**.
- **Sin backend propio y sin Edge Functions.** Todo corre en el
  navegador.
- **Funciona sin internet**: `localStorage` + cola de subida. El rancho
  tiene internet intermitente. **Toda función nueva debe servir offline
  o degradarse diciendo por qué.**
- **39 tablas.** Las columnas son fijas; todo campo extra viaja en la
  columna JSON `datos` — por eso se agregan campos sin migración. Una
  COLECCIÓN nueva sí exige registrarla en `INITIAL`, `TABLAS_NUBE`,
  `dataApi.TABLAS` y `COLUMNAS_REALES`, **más su SQL** en `supabase/`.
- Despliegue: StackBlitz → GitHub → Vercel.

### Lo que ya tiene (no lo vuelvas a construir)

Trazabilidad de estibas (barbecho → limpia → relimpia → calibre, con
código y saldos que suben hasta la parcela) · corrida de ajo con rate y
conteo físico · embarques · inventario de terminado · nómina semanal ·
pase de lista · caja chica · créditos y deudas · consignaciones ·
captura manual de ingresos y egresos · exportación de pólizas a
CONTPAQi · importación de Excel · gráficas SVG propias sin librerías ·
`numeroALetras()` · remisiones y etiquetas · respaldo de datos · PINs
por rol.

### Lo que NO tiene — medido en el código, no supuesto

| Hueco | Evidencia |
|---|---|
| **Banco** | cero menciones de estado de cuenta o conciliación |
| **CFDI** | `cfdi` 0 · `uuid` 0 |
| **Lectura de fotos** | nada |
| **Ganado** | `semoviente` 0 · `arete` 0 · `potrero` 0 · `vaca` 0. «ganado» en el código son «bonos ganados» |
| **Varios titulares** | `socio` 0 · `titular` 0 · `cuenta corriente` 0 · `reembolso` 0 |
| **Pruebas** | **CERO.** Ni script ni dependencia |
| **Dinero exacto** | **205 `parseFloat`, cero decimales exactos** |
| **Reloj con huso** | **97 fechas sin huso**, y el CLAUDE.md admite que ya causaron falsas alarmas |
| Mantenimiento de maquinaria | existe la tabla, sin bitácora de servicio |
| Costeo de inventario | sin costo promedio, mermas ni caducidades |

**Un detalle que sí está bien y conviene no romper:** el reparto de la
revoltura entre tarimas (≈ línea 12794) le da el resto a la última
(`cajas - repartido`) para que la suma cuadre exacta. Es el patrón
correcto. El sistema tiene buen criterio en partes; le falta
consistencia.

---

## 4 · LO QUE YA ESTÁ ROTO HOY

No son riesgos teóricos ni código que "podría" fallar. **Cada uno de
éstos se leyó en el archivo y varios se corrieron con números.** Están
con su línea para que no tengas que buscarlos.

**Empieza por aquí.** Arreglar algo que ya está mal, con su prueba y su
nombre, enseña cómo se trabaja en esta casa mejor que cualquier función
nueva. Y son chicos: los ocho caben en un par de días.

> ### ✅ AL 8 DE SEPTIEMBRE, TRES YA ESTÁN HECHOS
>
> Comprobado corriendo el código, no leyéndolo:
>
> - **El tapón se destapó.** Existe `src/calculos.js` con **25
>   funciones exportadas**, y `src/calculos.test.js`. Corrí
>   `node --test src/calculos.test.js`: **32 pruebas, 32 en verde, 115
>   ms**, sin instalar nada. `App.jsx` ya importa de ahí (línea 14).
> - **Los centavos de la remisión.** `numeroALetras` ahora convierte a
>   centavos enteros primero. Lo corrí: 1.999 devuelve **«DOS PESOS
>   00/100 M.N.»**. Antes decía «UN PESO 100/100».
> - **Las fechas con huso**: hay `fechaLocal`/`mesLocal` en
>   `calculos.js`. **Falta revisar que TODA pantalla las use** — el
>   defecto original estaba en cuatro lugares distintos.
>
> Lee los otros cinco como pendientes, y **añade los dos de abajo**.

### El tapón: no se pueden escribir pruebas

`src/App.jsx` tiene **un solo `export`**: `export default function
App()`, en la línea 2686. Nada más. `numeroALetras`, `crearEstiba`,
`calcularCostoManoObra`, el rate de la corrida — **ninguna se puede
llamar desde fuera.**

Hoy no es que falten pruebas: es que **es imposible escribir una**.
Cualquier plan de pruebas que no empiece por aquí es humo.

La salida es corta: las funciones puras ya viven juntas al principio
del archivo, **antes** del primer componente. Sacarlas a
`src/calculos.js` es cortar un bloque contiguo, ponerle `export` a cada
una y dejar un `import` en `App.jsx`. Y **node trae corredor de pruebas
incluido** (`node --test`): cero dependencias nuevas, Vercel sigue
corriendo sólo `npm run build`, StackBlitz no instala nada.

> *Un explorador contó 51 funciones y ~1,440 líneas entre la 528 y la
> 2165. **No lo verifiqué. Vuelve a contarlo antes de cortar**, y
> comprueba que `npm run build` diga los mismos módulos antes y
> después.*

### Cuatro de dinero y de reloj

**1 · La remisión de venta puede imprimir «100/100 M.N.»** —
`App.jsx:530-531`. Se hace `Math.floor` del importe y luego se redondean
los centavos por separado. Corrí la aritmética: **1.999 devuelve «UN
PESO 100/100 M.N.»** y 0.999 devuelve «CERO PESOS 100/100 M.N.». Los
centavos sólo van de 00 a 99. Eso sale impreso en el papel que Migue le
entrega al cliente, con la cantidad en letra equivocada por un peso.
Se arregla redondeando a centavos **primero** y partiendo después:
`const c = Math.round(monto * 100)`, entero = `Math.floor(c / 100)`,
centavos = `c % 100`.

**2 · El panel del dueño cambia de mes a las 6 de la tarde** —
`App.jsx:9579` y `9581`, dentro de `PanelFinanciero`:
`hoy.toISOString().slice(0, 7)`. Zacatecas está seis horas atrás de
UTC. El 30 de septiembre a las 19:00, eso devuelve «2026-10»: el panel
suma los gastos de **octubre** —un mes que apenas empieza— y los
compara contra septiembre como "mes anterior". Rodolfo abre el resumen
en la noche y ve que el rancho casi no gastó.

Lo que lo vuelve un buen ejemplo de la regla 7: **el archivo ya sabe
hacerlo bien.** El helper `today()` de la línea 561 usa
`getFullYear()`/`getMonth()` y hasta trae el comentario que explica por
qué no se usa `toISOString()`. Alguien lo escribió, y cuatro lugares no
lo respetaron. El mismo error se repite en el Resumen Semanal
(`App.jsx:7705`), donde la semana encoge de 7 a 6 días cada tarde.

**3 · Todo el dinero se pinta en pesos enteros** — `App.jsx:520`, `fmt`
con `maximumFractionDigits: 0`, encima de aritmética de punto flotante.
Los centavos no se ven, así que un descuadre de centavos es
literalmente invisible hasta que crece.

**4 · Lo capturado sin señal se borra de la pantalla** —
`App.jsx:2296`: `porId[rn.id] = (tn >= tl) ? rn : rl;`, con el
comentario «Si la nube es más reciente (o el local no tiene marca), la
nube gana».

Lo comprobé y es peor de lo que parece: **`_actualizado` aparece tres
veces en las 14,759 líneas y las tres son lecturas.** Nadie lo escribe.
Quien lo estampa es `dataApi.js:110`, y sólo **al subir**. Entonces la
nube siempre trae marca y lo local nunca: el empate lo gana la nube
*siempre*.

Migue corrige una estiba de 50 a 48 cajas sin señal. Al volver el
internet, la pantalla dice 50 otra vez. El dato no se pierde —la cola
de subida lo guarda aparte— pero **Migue ve que su corrección
desapareció**. O la recaptura (doble movimiento), o deja de confiar en
la app, que es peor. Se arregla estampando `_actualizado` en `add` y en
`upd` al guardar en local, y cambiando `>=` por `>` para que en un
empate real mande lo que la persona acaba de tocar.

### Tres de confianza — las que caen justo en el pecado de la regla 2

**5 · Se puede borrar dinero sin dejar rastro.** `del()`
(`App.jsx:2381`) quita el registro y replica el borrado. **No escribe
una sola línea de bitácora**: ni quién, ni cuándo, ni qué decía antes.
El botón del bote está en ingresos (5307), egresos (5329), préstamos
(6444), caja chica (6576) y créditos (6903 y 10066) — este último con
el aviso «¿Eliminar este crédito y todo su historial?».

Del lado de la nube es igual: las 11 hojas de `supabase/` dan `for
delete using (tiene_perfil())` — **cualquiera con perfil borra
cualquier renglón de cualquier tabla**. Y busqué tabla de auditoría:
**no hay ninguna.**

La regla de ATALAYA: nada de dinero se borra, **se cancela**, con
motivo y con quién. El registro se queda, tachado y visible.

**6 · Si una tabla falla al bajar, se vuelve lista vacía y no lo dice.**
`dataApi.leerTodo()` recorre las 39 tablas y cada una lleva su
`catch { resultado[t] = []; }`. Se cayó la lectura de egresos → la app
calcula la utilidad **sin un solo egreso** y la pinta igual de verde.
Es exactamente el pecado: *un dato que falta no es un cero*.

Y hay un segundo filo: `TOPE_LECTURA` (`dataApi.js:140`) baja sólo los
más recientes — ingresos 2,500, egresos 2,500, actividades 3,000,
asistencia 4,000. **Ninguna pantalla lo dice.** Hoy no estorba; el día
que el rancho pase de 2,500 egresos, los reportes empiezan a mentir sin
avisar y nadie va a saber por qué.

**7 · Los créditos no guardan cuándo vencen.** Ni vencimiento, ni
plazo, ni condiciones. Un saldo sin fecha no es una deuda, es un
número. El fertilizante a 90 días de marzo se descubre vencido cuando
el proveedor corta el crédito a media aplicación.

### Dos más, encontradas el 8 de septiembre

**9 · El candado de la cuenta técnica se pide a sí mismo estar abierto.**
`src/supabase.js:17` declara `cuentaTecnicaListo = false`. Se pone en
`true` en las líneas 24 y 27, **dentro** de `iniciarConCuentaTecnica()`.
Y el único lugar de todo el proyecto que llama a esa función es
`App.jsx:2635`, **guardado por `if (cuentaTecnicaListo)`**.

Para entrar hay que haber entrado. La función nunca corre. El
comentario de arriba dice «si hay cuenta técnica configurada, la
iniciamos», pero la variable no dice *si está configurada*: dice *si ya
inició*. Está mal nombrada, y ahí se fue.

Y encadena con el defecto 8: aunque se arreglara el candado, la función
busca unas variables que `.env.local` no define. **Son dos cerrojos en
serie**, y hay que ver los dos juntos.

**10 · Las reglas estrictas de borrado ya están escritas y comentadas.**
`supabase/2-seguridad.sql`, líneas 162-172: cuatro reglas
`for delete using (es_admin())` sobre **ingresos, egresos, créditos y
caja chica**, con su comentario explicando que encargado, agrónomo y
finanzas seguirían pudiendo ver y crear, pero no borrar.

Están ahí, con los guiones puestos. Alguien ya pensó el problema y
dejó la solución apagada.

### Y una de credenciales, que hay que leer con cuidado

**8 · La cuenta técnica es código muerto — y NO se arregla cambiando el
nombre de la variable.**

`src/supabase.js` lee `VITE_SUPABASE_APP_EMAIL` y
`VITE_SUPABASE_APP_PASSWORD`. El archivo `.env.local` define
`VITE_APP_EMAIL` y `VITE_APP_PASSWORD`. **No coinciden**, así que ese
inicio de sesión nunca ocurre.

El instinto es emparejar los nombres. **No lo hagas.** Vite mete el
valor de *toda* variable `VITE_*` **dentro del archivo JavaScript que
Vercel le sirve a cualquiera que abra la página**. Emparejar los
nombres publicaría la contraseña. Hoy no se filtra por accidente: la
falta de coincidencia es lo único que la está tapando.

Una contraseña no puede vivir en el navegador. Si hace falta que la
captura de campo llegue a la nube sin sesión de persona, la salida es
otra —una Edge Function que guarde con llave de servidor, o RLS que
permita insertar con la llave pública sin leer— y **es una decisión de
Luis, no tuya**. Dísela y espera.

---

## 5 · EL PROBLEMA MÁS DIFÍCIL: VARIOS RFC, UNA SOLA EMPRESA

Luis, textual:

> *«el sistema de agrogestion es un tanto diferente en el sentido de que
> estaría trabajando con varios RFC pero en una sola empresa sabes?
> osea toda la familia estamos metidos en el rancho y todos movemos
> dinero del rancho entonces ocupo que todo eso se refleje»*

Esto **no es un detalle de configuración: es el eje del sistema.**

Fiscalmente son personas distintas. Económicamente es **un solo
negocio**. Hoy la app no distingue de qué bolsa salió cada peso, así
que la utilidad que enseña es la de un negocio imaginario donde todo el
dinero es del mismo dueño.

Lo que pasa de verdad en el rancho:

- Migue paga al proveedor de agroquímicos **con su tarjeta personal**.
  Es gasto del rancho, y el rancho **le queda debiendo a Migue**.
- Un cliente deposita en la cuenta de **Rodolfo**. Es ingreso del
  rancho, aunque esté a nombre del papá.
- La factura de los fertilizantes salió a nombre de **uno** de los RFC.
  Quién la puede deducir depende de eso, y hay que saberlo — aunque
  aquí no se calculen impuestos.
- El estado de cuenta personal de cualquiera trae **la despensa de su
  casa junto al pago del rancho**. Separar eso es el trabajo.

**Lo que hay que construir:**

1. **Titulares.** Cada cuenta bancaria, cada tarjeta y cada efectivo
   tiene un dueño (persona o RFC). Un movimiento sabe de qué bolsa
   salió.
2. **Un solo libro del rancho** alimentado por todas las bolsas. La
   utilidad del rancho es una sola, sin importar por dónde pasó el
   dinero.
3. **Cuenta corriente entre los socios.** Quién ha puesto, quién ha
   sacado, cuánto le debe el rancho a cada quien y al revés. **Ésta es
   la función que evita pleitos entre hermanos**, y es la que más va a
   agradecer la familia dentro de dos años.
4. **Lo del rancho contra lo personal.** Cada movimiento se marca. Lo
   personal **no se borra: se marca y se excluye**, para que el estado
   de cuenta siga cuadrando contra el banco.
5. **A nombre de quién quedó cada comprobante**, para saber quién puede
   deducirlo. Sin calcular el impuesto: sólo dejarlo dicho.

**Lo que NO debe hacer:** decidir solo qué movimiento es del rancho y
cuál es personal. **Propone y una persona confirma.** Marcar como
personal el pago de un proveedor esconde un gasto real; marcar como del
rancho la despensa de una casa infla el costo y ensucia la cuenta entre
hermanos. Las dos duelen.

---

## 6 · LA PRIORIDAD 1: LEER ESTADOS DE CUENTA DE VARIOS BANCOS

Luis lo dijo así: *«una de las cosas importantes es la lectura de
estados de cuenta de diferentes bancos»*.

Hoy los ingresos y egresos se capturan **a mano**, uno por uno. Ahí se
va el tiempo y ahí se pierde lo que nadie capturó.

### Cómo lo resolvió ATALAYA, y qué traer

**La idea que sostiene todo:** un estado de cuenta **se valida a sí
mismo**, de dos formas:

```
    saldo inicial + Σ depósitos − Σ retiros = saldo final
    saldo anterior + depósito − retiro = saldo del renglón
```

La segunda es la valiosa: no dice que *algo* está mal, dice **cuál
renglón**. Un error de lectura rompe la cadena exactamente donde
ocurrió.

**Por eso: la lectura NUNCA se da por buena sin verificar.** Si no
cuadra, el estado de cuenta se marca **no confiable y no entra**. Es
preferible pedir otro archivo que conciliar contra cifras inventadas.

**El orden, de gratis a caro** (lección de `lector_reglas`): un estado
de BBVA de agosto tiene el mismo formato que el de julio. Mandarlo a un
modelo cada vez es pagar por resolver un problema ya resuelto, **y mete
variabilidad donde no la había**: la misma línea puede leerse distinto
dos veces. Con reglas es gratis, reproducible, y **cuando falla, falla
ruidosamente** — no inventa una cifra.

### Y aquí, el camino barato que cambia todo

**Pídele al banco el Excel o el CSV, no el PDF.** Casi todos los bancos
mexicanos lo dan, y `excelLoader.leerExcel` **ya existe**: leer el
estado de cuenta entra casi gratis, sin dependencias nuevas, sin
backend, y funcionando en el celular sin internet.

El PDF déjalo para después, y sólo para el banco que no dé otra cosa.

**Enmascara el número de cuenta** antes de guardar nada: se conservan
los últimos cuatro dígitos, que bastan para identificarla y no sirven
para nada más.

**Una factura o un gasto se concilia UNA sola vez.** Dos depósitos del
mismo importe podrían «pagar» ambos lo mismo y el ingreso se duplica.

**Y devuelve los CRITERIOS, no un porcentaje.** «92 %» no le sirve a
nadie; «importe exacto + el nombre del proveedor en el concepto + 3
días de diferencia» sí, porque Migue lo juzga de un vistazo.

---

## 7 · LO QUE SE TRAE DE ATALAYA

ATALAYA es el otro sistema de Luis — el contable del despacho: 224
módulos, **2,015 pruebas ninguna fallando**, 40 rutinas que corren de
madrugada. Estas piezas ya están resueltas ahí **con su lección**, y
aplican al rancho:

### Leer papeles
- **Estados de cuenta** → arriba, prioridad 1.
- **Aprender a leer a cada proveedor.** Se guarda *dónde* estaba el
  dato en el texto, no el valor. El mes que entra, ese proveedor se lee
  gratis. Un rancho ve los mismos treinta proveedores todo el año.
- **El QR de la factura impresa.** No hagas OCR del total: un 3 leído
  como 8 sale plausible y equivocado, y nadie lo revisa. El QR trae el
  folio fiscal; con eso ya sabes cuál factura es. Falla ruidosamente.
- **La foto del ticket.** Avisa de la foto borrosa **antes** de gastar,
  pero **jamás bloquees**: el comprobante se guarda igual. Nunca se
  pierde evidencia de un pago.
- **Qué es este papel.** En cascada de barato a caro, y **si duda, no
  adivina**: va a «por identificar» y una persona lo resuelve en diez
  segundos. Diez segundos hoy contra tres horas en el cierre.

### Contabilizar
- **Concepto por concepto, no factura por factura.** Un ticket de
  autoservicio trae despensa del comedor, papelería y a veces una
  herramienta que es activo fijo. Mandarlo todo a una cuenta está mal y
  quien lo sabe lo corrige a mano.
- **El criterio se aprende de las decisiones pasadas** y **dice en qué
  se basa**: «esta cuenta, porque así se clasificó 340 veces». Un
  sistema que dice el resultado sin explicar sólo se puede obedecer o
  ignorar.
- **A dónde se fue cada peso.** La pregunta no es «cuáles movimientos
  tienen factura». Un gasto sin comprobante no es un problema a
  esconder: es un gasto no deducible **que hay que registrar como tal**.
  Lo grave no es que exista, es que nadie sepa que existe. Al cierre,
  el 100 % de los movimientos debe estar explicado — aunque la
  explicación sea «retiro sin comprobante».
- **Los gastos sin factura sí importan.** No son deducibles, pero saber
  que se van $200,000 al año en tickets sin factura es información que
  cambia decisiones. Y separa los que **todavía se pueden facturar**:
  ahí hay dinero recuperable y el plazo corre.

### Vigilar solo
- **La métrica que importa no es «falló», es «NO APARECIÓ».** Una
  tarea que truena se ve. La peligrosa es la que dejó de correr y nadie
  se enteró. Cada rutina declara cada cuánto debe correr y el panel
  compara contra la última vez.
- **Compara contra el MISMO periodo del año anterior**, no contra el
  mes pasado. Un rancho es estacional: en agosto siempre cae. Comparar
  contra julio produce alarmas falsas que enseñan a ignorar las
  alarmas.
- **«¿Me alcanza?»** con una palabra: alcanza, falta, o **no sé tu
  saldo** — y decir de dónde salió el saldo y de qué fecha es. Un saldo
  de hace dos meses sigue siendo mejor que ninguno, pero **no se
  disfraza de actual**.

### No mentir
- **El puntaje no inventa lo que no sabe.** Devuelve *cobertura
  reducida* y lo dice. Un 85 calculado sobre la mitad de los datos no
  es un 85: es un dato incompleto disfrazado de certeza.
- **Auditoría de sólo inserción**: sin forma de modificar ni borrar un
  registro.
- **No cuentes «cuántas propuso»** — esa medida sube sola con sólo
  proponer más, aunque se proponga mal. Cuenta **cuántas sobrevivieron
  sin que nadie las corrigiera**.

---

## 8 · LO QUE HAY QUE TRANSFORMAR

Luis dio vía libre: *«si quieres lo transformamos a lo que tenga que
ser para que sea tan bueno como ATALAYA para lo que está hecho»*.
Cuatro frentes, en este orden.

### 1 · Pruebas — hoy son CERO
**El tapón está en la sección 4: hoy no se puede escribir ni una.**
Empieza sacando las funciones puras a `src/calculos.js`. Después:

Es la diferencia más grande entre los dos sistemas. El propio
CLAUDE.md lista cosas que ya se rompieron: el rate que se desplomaba al
agregar limpio, el modo revoltura que nunca mostraba el panel, los PINs
que validaban contra config que aún no bajaba, los iconos que nunca
cargaban. **Cada una de ésas debería tener hoy una prueba con su
nombre.** Empieza por ahí: por lo que ya se rompió una vez, y por los
ocho de la sección 4, que ya están rotos ahora.

Y **nada corre las pruebas si Luis no se acuerda**: no hay carpeta
`.github` ni integración continua de ninguna clase. Una vez que existan
pruebas, ponles algo que las dispare solas.

### 2 · El dinero en punto flotante — 205 usos
Un rancho paga a destajo por kilo, reparte proporcional entre tarimas,
calcula rate por minuto y liquida nóminas semanales. Ahí el centavo se
acumula. Un solo lugar para el dinero, como `services/dinero.py` en
ATALAYA, y migrar por zonas verificando con números reales — **no de
golpe**. Empieza por donde más duele: precio × cajas, tarifa × unidades
y el reparto de costos entre cultivos.

### 3 · El reloj sin huso — 97 fechas
Supabase guarda en UTC; Zacatecas está seis horas atrás. Un timestamp
de «4:30» son las 10:30 de la mañana. **El CLAUDE.md ya admite que
causó falsas alarmas.** Un solo lugar que diga qué día es, con hora de
México para decidir y UTC para guardar.

### 4 · Partir `App.jsx` — sólo si estorba
14,759 líneas y 89 componentes. El CLAUDE.md permite partirlo **por
etapas, verificando build en cada una, nunca de golpe**. No es urgente:
si no está estorbando, hay cosas que valen más. Pero cuando entren
banco, ganado y socios, va a estorbar.

### Sobre la arquitectura
Decide con criterio qué exige de verdad una pieza nueva:

| Qué | Cómo | ¿Pieza nueva? |
|---|---|---|
| Estado de cuenta en Excel/CSV | `xlsx`, que ya está | **no** |
| XML de un CFDI | `DOMParser`, nativo | **no** |
| QR de factura impresa | `BarcodeDetector`, nativo en el celular | **no** |
| PDF del banco | `pdfjs-dist` — casi 1 MB encima de un paquete que ya pesa 1.5 MB, en teléfonos con internet intermitente | dependencia nueva, **y por eso déjala hasta el final** |
| Foto de ticket con IA | la llave **no puede vivir en el navegador**: quedaría pública | sí — Edge Function |
| Descargar CFDI del SAT | necesita e.firma y firmar peticiones | sí — servicio aparte |
| Rutinas de madrugada | nadie tiene la app abierta a las 2 am. **`pg_cron` está disponible en el proyecto y NO instalado** (la tabla `cron.job` todavía no existe): se enciende con un `create extension`, cuesta cero, y para Luis es pegar un `.sql` en el panel como los 18 que ya tiene | sí — `pg_cron` |

**Empieza por la columna «no».** Da casi todo el valor sin tocar el
despliegue ni pedirle a Luis una cuenta nueva.

---

## 9 · LO QUE FALTA POR CONSTRUIR, EN ORDEN

**Cero — lo que ya está roto** (sección 4, y son de días, no de semanas)
0. Sacar las funciones puras para poder probar · los centavos de la
   remisión · las fechas con huso · el empate que gana la nube · nada
   de dinero se borra · decir cuándo una tabla no bajó · vencimiento en
   los créditos · y avisarle a Luis lo de la contraseña.

**Primero — el dinero se lee solo**
1. Titulares y bolsas (cuentas, tarjetas, efectivo, con su dueño).
2. Lectura de estados de cuenta de varios bancos, con la validación
   aritmética que decide.
3. Marcar rancho / personal, proponiendo y confirmando.
4. Cuenta corriente entre socios.
5. Conciliar movimientos contra gastos e ingresos ya capturados.
6. «A dónde se fue cada peso»: el 100 % explicado al cierre.

**Segundo — los comprobantes**
7. Cargar XML de CFDI y cruzarlos contra el banco y contra la compra.
8. QR de la factura impresa.
9. Tickets y notas sin factura: cuánto se va al año, y cuáles todavía
   se pueden facturar.
10. Cuadrar lo comprado contra lo recibido en almacén.

**Tercero — el ganado (no existe nada)**
11. Inventario por arete, altas y bajas, con su origen.
12. Partos, destetes y mortandad.
13. Pesajes y ganancia diaria.
14. Sanidad: vacunas, desparasitación, tratamientos **con su tiempo de
    retiro** — vender un animal antes del retiro es un problema serio.
15. Potreros, carga animal y rotación.
16. Alimentación y costo por kilo producido.

**Cuarto — lo que ya se captura y nadie mira**
17. **Diésel y horómetro**: el tractorista ya captura inicial, final y
    cargado — **y la lectura del horómetro** (`App.jsx:3831`, que es su
    ÚNICA aparición en las 14,759 líneas: se teclea y nadie la lee).
    Falta cruzarlos. Es el robo clásico del rancho y los dos datos ya
    están ahí, guardados, esperando.
18. Mantenimiento de maquinaria por horas — que sale del mismo
    horómetro del punto anterior.
19. Inventario con costo promedio, mermas y caducidades de
    agroquímicos.
20. Costo por hectárea: **`porHa` ya está calculado en seis lugares.**
    Lo que falta es decir sobre qué está calculado —los gastos
    generales no se reparten y la pantalla no lo advierte— y compararlo
    al mismo día del ciclo, no al cierre.

> Antes de tocar cualquiera de estos cuatro, lee el primer capítulo de
> `LO-QUE-FALTA-CONSTRUIR.md`: hay nueve piezas más que ya existen a
> medias y que no hay que volver a construir.

**Siempre**
21. Autorizaciones por monto y por rol; quien compra no paga.
22. Rastro inmutable de quién hizo qué.
23. Respaldo que se verifica **restaurándolo** — uno que nunca se
    restauró no es un respaldo, es una suposición.

---

## 10 · LO QUE NO SE HACE AQUÍ

- **No se calculan impuestos.** Esto es control interno: que no se
  pierda dinero, que nadie mueva algo sin dejar rastro, que el dueño se
  entere a tiempo. Saber a nombre de quién quedó una factura sí; el ISR
  no.
- **No se decide por la persona.** Ni qué movimiento es del rancho, ni
  a qué cuenta va un gasto, ni cuándo subir el ritmo.
- **No se inventa un dato que falta.** Se dice que falta.
- **No se pinta un total sin decir sobre qué está calculado.**
- **No se pierde evidencia de un pago**, aunque la foto esté borrosa.
- **No se manda nada al mundo real desde una prueba.**
- **Las credenciales nunca van en el código ni se piden por chat.** Van
  en `.env.local` (ignorado por git) y en el panel de Vercel.

---

## 11 · CÓMO VERIFICAR TU TRABAJO

Después de **cada** cambio en `App.jsx`, en este orden:

1. `npm run build` — debe decir «✓ built». Es la prueba más fuerte que
   hay hoy.
2. Revisa que no queden declaraciones duplicadas ni JSX desbalanceado.
3. Para lógica de cálculo (rates, reparto, conversiones, dinero),
   escribe una prueba aislada con **números reales**. En cuanto exista
   `src/calculos.js`, que sea una prueba de verdad con `node --test`
   —viene incluido, no hay que instalar nada— y no un `node -e` que se
   tira al terminar.
4. Para cambios visuales, levanta el servidor y toma captura.

Y cuando termines algo, dile a Luis **qué quedó fuera y por qué**. Esa
frase vale más que la lista de lo que sí hiciste.
