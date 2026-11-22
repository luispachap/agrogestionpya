# AgroGestión — Agroselectos P&A

App de gestión agrícola para una empresa familiar de ajo en Zacatecas (bodega en
Aguascalientes). PWA móvil en React. La dirección definitiva es
https://app.agroselectos.com (desde el 20 nov 2026 sirve la versión vigente);
https://agrogestion-operacion.vercel.app queda como respaldo.

## Con quién trabajas

**Luis** es contador, no programador. Escribe el qué, no el cómo. Traduce siempre:
di "la pantalla de la corrida", no "el componente `CorridaAjo`". Nada de jerga sin
explicarla. Va directo al grano: no le ofrezcas pausas ni le adviertas de límites,
entrega el trabajo hecho.

**Cómo se habla en las pantallas.** Lenguaje moderno, claro y natural, como se
habla en el rancho. **Nunca** «jornal», «jornalero», «labor» ni «faena». Se dice
«trabajador», «personal», «actividad», «pago por día», «destajo», «equipo de
trabajo», «trabajadores de planta», y «cuadrilla» sólo para los grupos
eventuales que llegan juntos con su responsable. En pantallas de
operación, nada de tecnicismos contables («devengado», «provisión»); en reportes
financieros sí, cuando den precisión. Los valores guardados por dentro no se
cambian (`"jornalero"`, `"jornal"`, `"destajo"`): se traducen al enseñarlos
(`nombreDeCategoria`, `nombreDeModalidad`). `pruebas/recorrido_navegador.py`
revisa todas las pantallas de todos los perfiles.

Usuarios reales de la app:
- **Rodolfo** (papá, dueño) — solo lectura, ve reportes y resúmenes.
- **Migue** (hermano, finanzas) — usuario principal del módulo de corrida de ajo.
  Todo el diseño de ese módulo sale de cómo trabaja él en la bodega.
- **Fito** (hermano, ingeniero agrónomo) — catálogo de agroquímicos y bitácora de
  aplicaciones.
- Trabajadores, encargados, cuadrillas y externos — captura de campo.

## Arquitectura

- **Casi un solo archivo**: `src/App.jsx` (~14,600 líneas). Es grande a propósito:
  nació en StackBlitz y así se ha mantenido. Si vas a partirlo, propónlo antes y
  hazlo por etapas verificando build en cada una — nunca de golpe.
- **`src/calculos.js`**: lo que se puede probar sin abrir la app — dinero, fechas,
  cancelación, costo de mano de obra, saldos de crédito. Salió de `App.jsx` porque
  ahí dentro no se podía llamar nada desde fuera y por lo tanto **no se podía
  escribir ni una prueba**. Toda lógica de cálculo nueva va aquí, con su prueba.
- **`src/icons.jsx`**: los iconos, el tema claro/oscuro y los helpers de saludo y
  fecha larga.
- **`src/lectura.js`** + **`src/maquinaria.js`** + **`src/banco.js`**: leer papeles,
  cruzar horómetro con diésel, y validar estados de cuenta. Puros y probados,
  como `calculos.js`.
- **`src/socios.js`**: varios RFC, una sola empresa. El eje del sistema.
- **`src/ganado.js`**: el padrón, la báscula, la jeringa y los potreros.
- **`src/vigilancia.js`**: que el dueño se entere a tiempo.
- **`src/almacen.js`**: vales de salida, mermas con causa y conteo a ciegas.
- **`src/eventos.js`**: EL PRINCIPIO CENTRAL — una operación, múltiples
  consecuencias. Lo que pasa en el rancho se captura UNA vez, como un evento
  (colección `eventos`, hoja 35), y sus consecuencias se CALCULAN con
  `efectosDe(eventos)`: no se guardan aparte, así que no se pueden duplicar ni
  contradecir. Un evento no se edita ni se borra (la base lo impide hasta a un
  superadministrador): se cancela con motivo o se corrige con un evento nuevo
  que apunta al anterior. **Todo módulo nuevo nace como un tipo de evento con
  su regla (`reglasDe`)**; nada de guardar el mismo hecho en dos colecciones.
  El modelo y el orden de las entregas están en `docs/EVENTOS.md`.
- **`src/checador.js`**: credenciales con QR, marcas de entrada y salida, y la
  jornada que sale de ellas. Entrar al rancho NO es trabajar en una parcela; una
  entrada sin salida no vale 8 horas, vale "no se sabe".
- **`src/cuadrillas.js`** (en pantalla: «Equipos de trabajo»; el archivo conserva
  el nombre): a qué se asignó a cada quien (`asignacion`, `fin_asignacion`,
  `destajo` = pago por tarea, `aclaracion` del tiempo sin asignar) y la mano de obra que sale de cruzar eso con las
  marcas: `manoDeObra()`. Cambiar de parcela o de labor es OTRA asignación, no
  una edición. Tiempo en el rancho sin asignar NO se le carga a ninguna parcela:
  queda aparte, a la vista. Lo repartido suma exacto lo devengado. Las reglas
  que el rancho puede cambiar (`AJUSTES`) también son eventos. `normalizeData`
  mete esa mano de obra a `actividadesContables`, así que los reportes de
  siempre la ven **sin que nadie teclee una actividad** — teclearla además la
  duplica (`capturasDobles` lo avisa). En pago por tarea a cada quien le toca lo
  que hizo; parejo sólo si se pide. El tiempo sin asignar es «por aclarar», no
  pérdida. El plan del motor de costeo y las políticas pendientes: `docs/COSTEO.md`.
- **`src/eventuales.js`** (en pantalla: «Cuadrillas»): los grupos eventuales.
  `cuadrilla_dia` = quiénes vinieron, parcela, actividad y cómo cobran (por día,
  cada quien lo suyo; o destajo con lo que hizo CADA persona — parejo sólo con
  el total del grupo y con el nombre de quien lo autoriza). `traslado_cuadrilla`
  = cómo llegaron: flete externo (se reparte con `criterio_flete`, configurable,
  y si ese día no hay trabajo registrado queda PENDIENTE, no se reparte),
  vehículo propio (**sin importe**: su costo vive en los gastos del vehículo;
  ponerlo aquí lo duplica o lo inventa) o sin transporte. La pantalla vieja
  donde la cuadrilla entra con PIN sigue existiendo; no usar las dos para el
  mismo día.
- **UNA SOLA FUENTE por día** (`unaSolaFuente`, `unaSolaManoDeObra`, en
  `normalizeData`): si un día de una cuadrilla tiene `cuadrilla_dia`, o un
  trabajador tiene mano de obra del checador, lo tecleado antes para ese mismo
  día NO cuenta su mano de obra (sigue guardado; sale en `data.noContado`). No
  es aviso: es la cuenta, y sale igual con dos aparatos sin señal. Las
  cuadrillas ya sólo se registran en «Cuadrillas» (`CUADRILLAS_SOLO_EN_SU_PANTALLA`);
  la entrada de la cuadrilla con PIN sigue, pero no guarda un día ya registrado.
  `cuadrilla_dia` tiene tres modalidades: `dia`, `destajo` y `precio` (precio
  por el trabajo: UN pago al grupo, no se le inventa a cada persona).
- **El operador**: `asignar` acepta `vehiculoId` en vez de `parcelaId` (nunca
  los dos). Ese rato se le carga al vehículo con lo que ya gana; no es otro
  pago ni toda su jornada. **`src/vehiculos.js`** junta operador + consumos del
  almacén con destino vehículo + gastos con `vehiculoId`. Todavía NO se reparte
  a parcelas (falta el criterio; es decisión de Luis).
- **`src/movimientos.js`** (en pantalla: «Entregas del almacén» y «Conteo y
  mermas»): **la existencia se CALCULA, nadie la escribe.** `estadoDelAlmacen(eventos,
  inventario)` recorre los movimientos en el orden en que pasaron (`cuando`);
  el `existencia` del catálogo es sólo el punto de partida y `upd`/`add` no lo
  dejan cambiar (`paraGuardarArticulo`). `setInv(id, delta, mov, contexto)` ya
  NO muta nada: agrega un `alm_entrada` o un `alm_consumo`; y si una pantalla
  vieja "le suma" al número por `upd`, esa diferencia se vuelve movimiento.
  **Nunca escribas `existencia` a mano ni uses `setData` con el inventario ya
  calculado.** Tipos: `alm_entrada`, `alm_retiro` (queda a cargo de alguien),
  sus cierres con `origen` (`alm_consumo` —ahí nace el costo—, `alm_devolucion`,
  `alm_traspaso`, `alm_baja` con causa/valor/evidencia, `alm_revision` «sigue
  en uso» con `proxima`), `alm_consumo` directo, `alm_transferencia` entre
  bodegas, `alm_ajuste` (merma con causa), `alm_conteo` y `alm_resolucion`.
  - **El conteo es absoluto**: «a esta hora había TANTO», no «súmale la
    diferencia». Dos conteos iguales no ajustan dos veces, y un movimiento
    anterior que llega tarde recalcula la diferencia sola.
  - **Una sola fuente por cantidad consumida**: el insumo anotado en una
    actividad (`via: "actividad"`, sin costo: su costo va en la actividad) se
    toma de lo que esa persona TRAE; si el cierre de esa entrega no lo vio
    (`yaReportado`), lo empalmado cuenta una vez y sale en `empalmes`.
  - **Falta de existencia**: no bloquea; deja `discrepancias` pendientes hasta
    que un administrador las explique (`resolver`). Explicar no corrige el número.
  - **Plazos** (`porCerrar`, reglas `alm_*` en `AJUSTES`): 24 h aviso / 72 h
    escala para consumo; 7 y 15 días para herramientas y uso prolongado.
    `avisosPara` decide a quién le sale. Son avisos al abrir la app, no mensajes.
  - **Una baja no es un descuento**: lo que se decida con el trabajador es otro
    evento (`alm_resolucion`), de una persona.
- **`src/vehiculos.js`**: `costoDeVehiculos` (historial) y `repartirVehiculos`
  (a qué parcelas benefició). Son dos vistas del MISMO dinero: lo repartido +
  lo pendiente + lo que no fue a producción suma exacto el costo, y NO entra a
  `actividadesContables` ni a los gastos otra vez. Una máquina que ya carga
  `costo_hora` en actividades no se reparte encima. Sin dato no hay reparto:
  queda pendiente con su porqué.
- **El costo promedio también se calcula** (`estado.promedios`): cada compra
  (`alm_entrada` con `costoUnit`) conserva cantidad, precio y fecha; el catálogo
  no guarda el promedio (`costo_unit` es sólo el punto de partida, y corregirlo
  a mano es un `alm_costo`: vale de ahí en adelante). **El consumo se queda con
  el costo con que se capturó**; si una compra anterior llega tarde, la
  diferencia sale en `ajustesDeValuacion` (aparte, con causa) y nunca se mezcla
  con el original.
- **Tres fechas, y el reloj del teléfono no manda** (`momentoDe`, `src/reloj.js`,
  hoja 36): `cuando` (operación), `capturado` (tecleo) y `_recibido` (la pone
  la base; también `actualizado`, que es la marca de "lo nuevo"). Cada evento
  nace con `reloj.desfase` (hora del servidor − hora del teléfono, medida con
  `hora_del_servidor()`). El orden usa la hora corregida, y nada puede pasar
  después de que el servidor lo recibió. Toda corrección sale en `relojes`.
- **`src/indirectos.js`: costo DIRECTO y costo COMPLETO.** `actividadesContables`
  y `total` de los reportes son y siguen siendo el DIRECTO. Lo indirecto llega
  de FUENTES (`juntarFuentes([...])` en `normalizeData`; hoy sólo
  `fuenteVehiculos`, que reparte mes por mes) con `partes` (fecha, base,
  `explica`), `pendientes` (con su causa) y `noProduccion`. Los reportes lo
  enseñan con `<DosCifras>` (`r.completo`). **Una fuente nueva de indirectos se
  agrega a esa lista; nunca se mete a `actividadesContables` ni a los gastos.**
- **`src/pagos.js`** (en pantalla: «Pagos al personal», la página `nomina`): lo
  que CORRESPONDE se calcula de lo ya registrado (`semanaDe`: checador,
  actividad tecleada o ausencia que se paga); lo ENTREGADO son eventos
  `pago_personal`; lo PENDIENTE es la resta. **Un pago no genera costo.**
  `ausencia` (permiso/descanso autorizado = se paga; falta = no se paga;
  justificar después = `corregirEvento`, con historial). Quien no vino y nadie
  explicó es `sin_registro`: una pregunta, no una falta. `diasAsistencia` es el
  calendario de cada trabajador (hay quien no viene los sábados), distinto del
  periodo de pago semanal. **Salir antes NO descuenta nada solo**: sale en
  `salidasPorRevisar` y una persona decide (`decision_jornada`, que `manoDeObra`
  aplica al día Y al costo de la parcela). Cuadrillas: una cuenta por
  responsable (`cuentasDeCuadrillas`); entregarle no marca pagado a cada
  integrante. Temporales independientes: `cuadrilla_dia` con `independiente`.
  Recibos (`recibo_personal`): lo emitido es una foto y no se cambia; otro
  recibo de la misma semana es una versión nueva con su motivo. Llevan la
  leyenda de que NO sustituyen un CFDI de nómina. Horas adicionales:
  registradas ≠ reconocidas (`horas_reconocidas`) ≠ pagadas.
- **`src/personal.js`**: lo que se paga y NO es una actividad en una parcela
  (permiso, descanso, espera, el día de un encargado). Nace como costo
  INDIRECTO de personal (fuente `personal` de `juntarFuentes`), con su causa y
  la regla de su concepto (`ind_*` en `AJUSTES`: repartir por las actividades
  de esa persona en el mes · pendiente · no es de producción). Sin datos no se
  reparte; lo «por aclarar» nunca se reparte solo. `repartirPorActividades` es
  el repartidor común (también de las prestaciones).
- **`src/prestaciones.js`**: aguinaldo, vacaciones y prima. Lo que se va
  generando SE CALCULA desde `fechaIngreso` (`provisionDe`); lo determinado y
  lo pagado son eventos (`prestacion_determinada`, `pago_prestacion`).
  **Al costo entra lo generado + el ajuste al determinar; pagar nunca es
  costo.** La ley es el piso (`LEY`, `vacacionesDeLey`); el rancho lo sube con
  `prest_*` y cada persona con `prestaciones` en su ficha (días, prima, base
  por prestación). Sin fecha de ingreso o sin salario por día: «no se puede
  calcular», nunca un cero. Lo generado antes del primer día con registros es
  `previo`: se enseña y no va al costo. Las vacaciones disfrutadas son una
  `ausencia` de clase `vacaciones`: se pagan en su semana y NO son costo nuevo.
- **`src/cierres.js`**: cerrar la semana (`cierre_semana`, foto con versión) y,
  APARTE, confirmar los pagos (`confirmacion_pagos`). Reabrir pide motivo
  (`reapertura_semana`); la versión anterior se queda. Cerrar no congela los
  hechos: lo que llegue después sale en `diferenciasDelCierre`. Cierra quien
  tiene el permiso `cerrar_semana` (lo comprueba la base).
- **Encargados**: `calendario: [{desde, hasta, activo}]` = periodos en que su
  día se paga por calendario (`activarCalendario`/`cerrarCalendario`: lo
  activa un administrador, persona por persona, con fecha; cerrar no cambia lo
  anterior). Pueden checar (`quienesChecan`), pero no es obligatorio. Tienen
  ausencias como cualquiera.
- **Abonos a préstamos = eventos** (`abono_prestamo`, `abonar`): el saldo se
  CALCULA (`saldosDePrestamos` en `normalizeData`); `abonado` guardado es sólo
  el punto de partida y `upd("prestamos")` no escribe lo calculado
  (`paraGuardarPrestamo`). Dos aparatos sin señal = dos abonos, ninguno se
  pisa. **Nunca hagas `upd` de un préstamo para sumarle un abono.**
  **`src/pdfSimple.js`** arma el PDF de texto del recibo (`datos.pdf`).
- **LO SENSIBLE LO AUTORIZA LA BASE (hoja 37).** Los tipos de `OPERACION_DE`
  (`eventos.js`; la misma lista que `operaciones_sensibles` en la base, hay
  prueba) — pagos, abonos, recibos, cierres, prestaciones, saldos iniciales,
  decisiones de un día y cambios de regla — los valida la base AL RECIBIRLOS
  con la cuenta de la sesión (`auth.uid()`), nunca con lo que diga el evento:
  sello `_validacion` = `autorizado` | `rechazado` en columnas que nadie puede
  escribir. **`vigentes()` no devuelve un evento sensible sin sello
  `autorizado`** cuando hay base (`exigirValidacion(supabaseListo)`): lo
  capturado sin señal está «por validar» y no cuenta; lo rechazado se guarda y
  no cuenta (`sinValidar`, `<PorValidar>`). Los permisos son por CUENTA y por
  operación (`permisos_operacion`, `otorgar_permiso`/`revocar_permiso`, sólo
  superadministrador; se asignan en Arranque → Cuentas). Ser encargado no da
  ninguno, y un teléfono ligado a su cuenta sube y se valida con ESA cuenta.
  En la app, `puedeOp(op)`/`seOfrece(session, op)` sólo evitan ofrecer lo que
  la base va a rechazar; a las funciones se les pasa `permitido`. **Un tipo de
  evento nuevo que mueva dinero o reglas se agrega a `OPERACION_DE` Y a la
  hoja SQL.** Cancelar/corregir algo sensible sin permiso: la base deja el
  renglón como estaba y anota `cambio_rechazado` (`juntarEventos` lo deshace).
- **`src/cierreMes.js`**: `costoDelMes` (por parcela: directo, indirecto,
  completo; lo pendiente aparte) y su foto (`cierre_mes`, con versión;
  `reapertura_mes` con motivo). Lo que cambie después sale en
  `ajustesPosteriores`; la foto no se toca. Está en Reportes → «Cierre de mes».
  Permiso propio: `cerrar_mes`.
- **Saldos iniciales de prestaciones** (`prestacion_saldo_inicial`): lo que ya
  se debía al corte (`prest_corte`, regla con fecha), con importe, periodo,
  fundamento, responsable y evidencia. NUNCA va al costo ni a una parcela. Al
  determinar: ajuste = determinado − saldo inicial − generado después.
- **Destajo ≠ sin prestaciones.** La base de quien no tiene sueldo fijo es el
  promedio de sus últimos días trabajados (`promedioDiario`,
  `prest_dias_promedio`). Sin datos: `porRevisar`, nunca un renglón en cero.
  `relacionLaboral` (planta/temporada/eventual) va aparte de `modalidadPago`.
- **`src/prestamos.js`**: un préstamo son CUATRO hechos, cada uno un evento:
  `prestamo_solicitud` (la pide cualquiera con captura; NO es deuda),
  `prestamo_autorizacion` / `prestamo_rechazo` (permiso `autorizar_prestamos`),
  `prestamo_entrega` (permiso `autorizar_pagos`; nunca más de lo autorizado) y
  los abonos de siempre. **La deuda nace con la entrega, no con la
  autorización**: `prestamosDe(eventos)` arma el préstamo (`monto` = lo
  entregado) y `saldosDePrestamos` le resta los abonos. La tabla `prestamos`
  ya no acepta altas de encargados ni de finanzas (hoja 39); lo que haya ahí
  de antes se sigue leyendo. Un préstamo `_deEventos` no se edita con `upd`.
- **`src/bajas.js`**: terminar la relación de trabajo. `CAUSAS_DE_BAJA` dice
  si la causa da finiquito o liquidación; `proponerBaja` propone concepto por
  concepto con su cuenta y su fundamento y marca `aplica: si | revisar | no`
  y `sugerido` (si entra de entrada) — **la app propone, una persona
  confirma** (`registrarBaja`, con quién autoriza, permiso
  `determinar_prestaciones`; guarda `bases`: con qué salarios se calculó).
  **Cada cosa con su salario**: prima de antigüedad = salario por día, ni
  menos que el mínimo ni más que el doble, con el mínimo DEL DÍA DE LA BAJA;
  indemnizaciones = salario integrado (`salarioIntegrado`: cuota diaria +
  parte de aguinaldo y prima vacacional; avisa que falta sumar otras
  percepciones fijas, por eso siempre «por revisar»). **Los veinte días por
  año NO entran de entrada en un despido** (sólo cuando el trabajador
  rescinde, art. 52); en relación por temporada u obra no se propone cifra.
  Lo ya generado de aguinaldo, vacaciones y prima NO se vuelve a cargar: al
  costo sólo va la diferencia (`cuentaDe(...).liquidacion`). Prima de
  antigüedad e indemnizaciones son **gasto laboral general** (fuente `bajas`,
  regla `ind_bajas`, por defecto `general`): no van a parcelas ni quedan
  pendientes; salen en los gastos generales del cierre de mes con su persona,
  causa y evento. `pago_baja` paga y no es costo. La persona queda inactiva
  por CÁLCULO (`_porBaja`). Lo de sus semanas se paga en Pagos al personal.
- **`src/salariosMinimos.js`**: el catálogo oficial, año por año, general y
  Zona Libre de la Frontera Norte (`CATALOGO_OFICIAL`, cada renglón con su
  publicación en el DOF). `salarioMinimoEn(fecha, zona, eventos)` da el
  vigente EN ESA FECHA; **si el año no está en el catálogo devuelve
  `monto: null` — nunca el del año pasado**. Se agrega o corrige con el
  evento `salario_minimo` (sensible, permiso `cambiar_reglas`, hoja 40), que
  pide la publicación en el DOF Y su evidencia (liga de un sitio oficial o
  foto/PDF); lo anterior queda en `anteriores`. `alertaDeSalarioMinimo`
  avisa al abrir la app (`<AvisoSalarioMinimo>`) si falta el del año en curso
  o, en diciembre, el del siguiente; nunca propone un importe. La zona del
  rancho es la regla `zona_salario_minimo` (general). **Cada diciembre hay
  que capturar el del año siguiente** (pantalla Pagos al personal →
  Prestaciones → «Salarios mínimos oficiales»). No metas cifras a
  `CATALOGO_OFICIAL` sin haberlas leído en la publicación oficial.
- **`src/salarioIntegrado.js`**: el salario integrado POR PARTES (`integrar`):
  cuota diaria, parte de aguinaldo y prima vacacional, las percepciones FIJAS
  de la ficha (`persona.percepciones.lista`, cada una con su periodo: semana
  ÷7, mes ÷30, y `desde`/`hasta` — una que se deja de dar NO se borra, se le
  pone `hasta`) y lo VARIABLE (lo que la app registró que ganó por encima de
  su sueldo en sus últimos 30 días trabajados, y los totales variables de su
  ficha). Lo que no sabe va en `falta` y deja `completo: false` (es un piso):
  ficha sin `revisado`, percepción sin valor, total variable viejo, pocos
  días, o bonificaciones de la pantalla vieja (no traen fecha).
- **`src/conciliacion.js`** (`conciliarMes`, en Reportes → Cierre de mes):
  por persona y concepto, qué se GENERÓ (costo del mes), qué AJUSTE hubo al
  determinar, qué costo nuevo trajo una baja, qué se PAGÓ (nunca costo) y qué
  se debe; con el porqué de cada importe y su relación con el pago. **Su
  comprobación (`cuadra`) compara ese costo contra lo que de verdad entró a
  los indirectos por las fuentes `prestaciones` y `bajas`**: si alguien mete
  un costo por otro lado, aquí truena. El resumen se guarda en la foto del
  cierre (`datos.personal`).
- **`src/resultado.js`: RESULTADO, INVENTARIO y FLUJO son tres cifras.**
  Decidido por Luis (20 nov): los **insumos son costo cuando se CONSUMEN**,
  no cuando se compran; comprar aumenta el inventario y, al pagarse, mueve el
  flujo. `resultadoDelRancho` (lo causado) trae `produccion` y `generales`,
  y aparte `inventario` (valor a costo promedio, lo comprado, lo por valuar y
  lo que no tiene precio — que NO vale cero). `flujoDeEfectivo` cuenta el
  dinero el día que se mueve. El inicio y Finanzas leen de `resultadoDe(data)`
  / `flujoDe(data)`: **no sumes ingresos y egresos por tu lado.** Un gasto de
  categoría «insumos» sin parcela ni vehículo es compra de almacén
  (`esCompraDeAlmacen`): inventario, no gasto. Los gastos de un vehículo NO
  se suman como gasto: ya vienen en la fuente de vehículos.
- **Maquinaria: cuota APLICADA contra costo REAL, nunca sumados**
  (`vehiculos.js`). La cuota por hora que cargan las actividades es el costo
  aplicado (provisional). El real es operador + combustible + mantenimiento +
  depreciación. De una máquina con cuota, a los indirectos sólo entra la
  DIFERENCIA (real − aplicado, puede ser negativa), con el tratamiento de la
  regla `maq_diferencia`: `pendiente` (defecto) · `aplicado` (a las mismas
  parcelas, en la proporción de la cuota) · `general`. Sin ningún costo real
  capturado ese mes no hay diferencia (`sinReal`): no se supone cero.
  `conciliarMaquinaria(repartos, mes)` es lo que enseña el cierre de mes.
- **`src/compras.js` + recepción en `movimientos.js`: una compra, un camino.**
  El trabajador registra y entrega el ticket (sin precios). Aprobar es sólo
  validar el gasto: **ya NO mete nada al almacén**. Lo que es mercancía entra
  con `recibirCompra` (id fijo `alm_entrada-compra-<compra>-<i>`: recibirla
  dos veces es el mismo evento) y, si no se sabe el precio, queda
  `porValuar` — **pendiente de valoración, no en cero**. `valuar`
  (`alm_valuacion`) le pone precio DESDE QUE ENTRÓ; lo ya consumido sale en
  `ajustesDeValuacion`, aparte. `estadoDeCompra` parte el dinero: mercancía =
  inventario; lo demás (un flete) = gasto; mientras falte recibir o valuar =
  `porValuar`, ni lo uno ni lo otro. `posibleDuplicado` avisa (no bloquea) si
  el mismo importe ya está capturado en esos días por otro lado.
- **`src/bonos.js`: los bonos viven en Pagos al personal.** `bono_personal`
  (se otorga: importe, motivo, beneficiario, periodo, quién autoriza,
  tratamiento de costo, si integra) es el COSTO, el último día del periodo;
  `pago_bono` paga y no es costo. Los dos son sensibles (`autorizar_pagos`,
  hoja 41). Un motivo de aguinaldo/vacaciones/finiquito se rechaza: eso es de
  Prestaciones. El costo va por la fuente `bonos` con el tratamiento de cada
  bono. Los que `integra` cuentan en el salario integrado. **La pantalla vieja
  de bonificaciones ya no captura** (la base tampoco lo permite): sus
  registros se conservan y se enseñan aparte, sin sumarse a nada.
- **`src/escenario.test.js`**: un mes completo de punta a punta (compra,
  recepción, consumo, valuación, máquina, bono, pagos). Si cambias cómo se
  cuenta algo, esta prueba dice en qué apartado se movió.
- **Lo que no tiene parcela también entra al cierre de mes**: trabajo de
  bodega de un cultivo (`bodega`, directo de producción, no de una parcela),
  trabajo general de bodega y compras del personal sin parcela (gastos
  generales), y actividades sin parcela ni bodega (`sinParcela`, a la vista).
  El reporte por cultivo ya NO reparte los gastos generales de bodega.
- **Pase de lista ≠ pago**: quien fue marcado presente a mano y no checó ni
  tiene actividad sale en Pagos como «vino, falta decir en qué trabajó»
  (`presentesSinDetalle`), nunca como «no vino», y sigue sin pago ni costo.
- **Gastos generales en el cierre de mes** (`costoDelMes().generales`): los
  egresos sin parcela ni vehículo, por categoría. Van APARTE, no se reparten
  a parcelas (falta una política, y es decisión de Luis). Las compras de
  insumos para el almacén tampoco son gasto del mes (`paraAlmacen`): su costo
  nace al consumirse. `rancho` = completo + pendiente + no producción +
  generales, sin contar nada dos veces. El cierre enseña tres bloques que no
  se mezclan: 1) directos de producción, 2) indirectos atribuibles a
  producción (repartidos + pendientes), 3) gastos generales de operación y
  administración (aquí entra lo que una fuente marca `general`, como las
  bajas). **Un gasto general nunca sube el costo de una parcela.**
- Reglas ya decididas por Luis (19 nov): checar salida TERMINA la asignación
  (al volver queda sin asignar; se ofrece «continuar»); el tiempo sin asignar es
  «por aclarar» y nunca se distribuye solo; las horas adicionales se registran y
  acumulan sin cambiar el pago (reconocerlas es otra decisión).
- **`src/importacion.js` + `src/importador.js`** (en pantalla: «Importar
  documentos», página `importar`): muchos papeles de un jalón. `importador`
  abre el archivo EN EL APARATO (XML de CFDI, Excel, CSV, PDF con texto, Word
  .docx; gratis, sin IA); `importacion` decide qué es y PROPONE (`proponer`),
  nunca registra solo. Reglas: no inventa (renglón ilegible → `descartadas`);
  no duplica (huella del archivo, folio fiscal, y renglón por fecha+importe+
  contraparte); **lo anterior al inicio de operaciones va al HISTÓRICO**
  (`historico_lote`) y no crea gastos, pagos, deudas ni existencias — y sin
  fecha de inicio declarada, TODO es histórico; **nunca crea pagos al personal
  ni actividades**; de lo posterior sólo propone gastos y altas de catálogo.
  La bandeja son eventos (`doc_recibido`, `doc_leido`, `doc_incorporado`,
  `doc_descartado`, `hoja_aprendida`); las propuestas sin confirmar viven sólo
  en el aparato (`LLAVES.importacion`). Imágenes y escaneos: `necesita_lectura`
  (falta la llave de IA). Una hoja que no se reconoce se le ENSEÑA
  (`eventoDeAprendizaje`) y queda aprendida por la firma de sus encabezados.
- **La IA en la importación** (`src/interpretacion.js`, función del servidor
  `supabase/functions/interpretar-documento`, hoja 44; pestaña «Lectura con
  IA»): SÓLO para lo que los lectores gratuitos no pudieron (`necesitaIA`:
  fotos, escaneos, hojas sin reconocer, texto sin entender) y SÓLO cuando una
  persona lo pide, viendo antes el costo máximo. Dos niveles: `economico`
  (Haiku) y `superior` (Sonnet, a petición). **El tope es TOTAL, no mensual**
  (`limites.ia_importacion_tope_microusd`, 4 USD): el servidor APARTA lo
  máximo antes de llamar (`reservar_ia`, atómico) y anota lo real después
  (`cerrar_ia`), en millonésimas de dólar; sólo un superadministrador sube el
  tope. De una hoja sólo viajan sus primeros 30 renglones y la IA sólo dice
  qué columna es cada cosa (`pedidoDeHoja` → `aprendidoDeLectura`); la hoja
  completa la lee la app. Lo leído se convierte a hojas (`hojasDeLectura`) y
  entra por `proponer`: mismo camino de duplicados, histórico y confirmación.
  La aritmética la hace la app (`revisarLectura`); lo dudoso llega SIN marcar.
  Las columnas que reconoció la IA se aprenden sólo al confirmar. Medidas:
  `metricasDeIA` (costo por documento; aceptado tal cual / con cambios /
  descartado; sin decididos no hay tasa). No se mandan CURP, NSS ni cuentas
  (`sinDatosSensibles`). `pruebas/funcion_ia.test.mjs` prueba la función con
  base y API de mentira: **ninguna prueba gasta crédito**. La función va en dos
  archivos: `index.ts` (quién llama) y `nucleo.ts` (todo lo que cuesta). Una
  llave que no está ligada a un espacio de trabajo de la Consola necesita
  además el secreto `ANTHROPIC_WORKSPACE_ID` (pasó en la primera llamada real,
  20 nov: la API la rechazó sin cobrar → `falta_espacio_de_trabajo`). Los precios están
  en `MODELOS` (servidor) y `PRECIOS` (app): si cambian, se cambian en los dos.
- **`src/claves.js`: las claves de las rayas** (pestaña «Claves de las rayas» en
  Importar documentos). En las libretas cada renglón trae códigos: `A07`
  (actividad: A + número) y `Bod`, `SF1…SF4` (ubicación). **La app no inventa
  el significado de ninguna**: lo pregunta una vez (`clavesPorPreguntar`) y lo
  guarda como evento `clave_aprendida`; corregir es otro evento y lo anterior
  queda en `anteriores`. Una actividad no se guarda como ubicación ni al revés
  (`formaDe`). De arranque sólo se sabe lo que dijo Luis (`CLAVES_DICHAS`:
  Bodega y San Felipe 1–4). Una raya (clase `raya`: de una hoja con columna de
  claves o de la IA, que copia los códigos TAL CUAL) entra SIEMPRE al
  histórico como quién · día · actividad · ubicación; **nunca crea pagos ni
  actividades**. El histórico guarda el código original (`claves`) y la clave
  normalizada, NO el significado: lo que se aprenda o corrija después vale
  también para lo ya importado. Lo que no se reconoce en un renglón queda como
  duda (`relacionDeRenglon().dudas`), no se le asigna papel por su columna.
  **Cinco cosas independientes por renglón: trabajador · fecha · actividad ·
  ubicación · cultivo.** «Ajo» es un CULTIVO (campo propio: `cultivoEscrito` y
  `cultivo`), nunca la clave A07; a mano se lee «9jo»/«2jo». Una palabra no se
  vuelve clave de actividad (hace falta un dígito de verdad). «Gen» = General:
  trabajo sin rancho específico (clase `general`, NO es un lugar ni, por sí
  solo, un gasto general). `RA50/RA51/RA53` = Ranchos 50, 51 y 53, grupo
  «Ranchos 50s»; SF1–SF4, grupo «San Felipe» (`grupo`: cada ubicación sigue
  siendo independiente). Lo que se ajusta al leer (RASI→RA51, 5f4→SF4) se
  avisa en el renglón. El número al lado del renglón es `importeTentativo`:
  no es `monto`, no suma y no es un pago (falta confirmar qué es). La lectura
  con IA recibe los códigos ya registrados (`pedido.claves`) sólo para decidir
  trazos dudosos.
- **El Excel de 2024 NO es el modelo (Luis, 21 nov).** Es un documento histórico más,
  entre muchos formatos posibles; su análisis está CERRADO. No se copian sus fórmulas,
  catálogos ni estructuras, y no se diseña AgroGestión a partir de él. La importación
  histórica es una capacidad adicional —flexible, sencilla, que aprende de las
  correcciones— y no el centro: lo primero es administrar bien el rancho de hoy. **Un
  documento que Luis comparte no es un proyecto de desarrollo**: entra por el camino
  general de importar; sólo se toca el código si ese camino falla.
- **`src/excelRayas.js` + referencias históricas** (`docs/EXCEL-RAYAS-2024.md`): del
  Excel antiguo de rayas se leen SÓLO sus catálogos de claves y sus hojas
  semanales. Los catálogos entran al histórico como `referencia_clave`: lo que
  una clave significaba EN ESE ARCHIVO, con sus fechas y «vigencia por
  confirmar»; puede haber varias por clave (`referenciasDeClaves`). **Una
  referencia nunca define ni cambia nada**: se sugiere al preguntar la clave
  (`sugerenciasDe`; `parecidasDe` para claves que se escriben casi igual) y una
  persona confirma (`clave_aprendida` con `deReferencia`). Las hojas semanales
  entran como rayas históricas con lo que DECÍA el Excel (`escrito`). **No se
  leen trabajadores, tabulador de sueldos ni importes** (muchos venían en #N/A
  y dejaban de contar el costo sin avisar). Una celda con error llega vacía.
- **Trazabilidad del histórico de rayas (decidido por Luis, 21 nov)** — `claves.js`,
  `importacion.js`, **`src/cotejo.js`**: una clave puede tener **vigencia** (`desde`/`hasta`
  en `clave_aprendida` = «en esas fechas significaba esto»; `entradaEn(entrada, fecha)`;
  fuera del periodo no dice nada) y **otra forma de escribirse** (`mismaQue`: R51 «El 51»
  = RA51; `canonica`). «Bod» `puedeSer` Bodega ajos o Pre ajos: **no se escoge**
  (`compatibles` → `puede_ser`). Cada raya incorporada guarda `leido` (lo que se entendió
  ESE día): **corregir el catálogo nunca reescribe un renglón confirmado**. Un domingo
  se queda domingo (`domingo: true`, con aviso). Un día que ya está por otro documento
  se avisa (`otraFuente`) y **cuenta una sola vez** (`unaFuentePorDia`); `cotejar(a, b)`
  compara dos papeles sin corregir a ninguno ni juntar personas (sólo «posibles»).
  AJO/PAJ = mismo cultivo «clasificado distinto» (`FAMILIA_DE_CULTIVO`). Ubicación →
  parcela es un evento aparte (`clave_parcela`, `ligarParcela`): pendiente hasta que
  alguien lo dice. **Ningún módulo de dinero lee el histórico** (hay prueba en
  `cotejo.test.js`): antes hace falta un tabulador histórico confiable. Nómina/efectivo
  como componentes: NO construido, es decisión de Luis (`docs/EXCEL-RAYAS-2024.md` §8).
- **UNA SOLA OPERACIÓN, VARIAS PUERTAS (Luis, 21 nov; visión y plan en
  `docs/OPERACION-HABLADA.md`).** Planear, checar, trabajar, avisar, registrar y sugerir
  son partes del mismo AgroGestión; WhatsApp, cuando exista, es otra puerta, no otra base.
  **`src/operaciones.js` es el camino común de todo lo que entra hablado**: `preparar`
  (propuestas con su `naturaleza`: hecho · observación · hipótesis · reporte · decisión ·
  plan · necesidad; lo que falta se PREGUNTA; mismo mensaje o mismo dinero no se repite)
  y `ejecutar` (revisa el permiso de quien confirma y devuelve QUÉ escribir, con `origen`:
  mensaje, frase, quién lo dijo, quién lo confirmó). **La IA o las reglas entienden y
  proponen; nunca escriben.** Sólo lo HECHO se propone como hecho. Lo que aún no tiene su
  operación conectada (`POR_CONECTAR`: préstamo, pago, aplicación, almacén) se dice y se
  manda a su pantalla: no se guarda «parecido». Conectado: la conversación con AgroGestión en Mensajes (antes «Dile a la app»). **El chat de adentro ya confirma por aquí** (`confirmarDelChat`: permiso de quien firma, rastro `origen`; si no se puede, no se firma). Una operación nueva que se
  pueda decir se agrega a `OPERACIONES` y usa la función que su módulo ya tiene.
- **Lo dicho se guarda con la forma que lee su pantalla**: incidencia = `desc`, `tipo`, `prioridad`, `trabajadorId`;
  solicitud de compra = `notas`, `items: []`, `creadaPor`. (Se guardaba `descripcion` y el inicio tronaba.)
- **`src/mensajeria.js`: MENSAJERÍA INSTITUCIONAL (Luis, 21 nov; `docs/MENSAJERIA.md`).** No es otro chat: es la
  colección `chat` de siempre con `conversacion` (sin ese campo = la general). Conversaciones = eventos
  (`conversacion`, `conversacion_cambio`; la directa tiene id fijo por par de personas). Miembros por persona o por
  puesto. `puedeVer`/`puedeEscribir` (dirección lee; la administración ve todo y se dice en `REGLAS`).
  **Lo que se dicen entre personas se lee con el mismo camino y sólo PROPONE**: `relacionar` decide si un mensaje va
  con algo que ya se venía hablando — `aclaracion` (misma operación), `seguimiento` (pendiente sobre una
  observación, sin diagnóstico), `ejecucion` (lo ejecutado de algo programado: dos momentos) — y
  `propuestasDeLaPlatica` deja fuera la plática (`platica: true`). El asistente sólo contesta a «Agro,»
  (`paraElAsistente`).
  **NO ES VIGILANCIA, ES MEMORIA CON ORIGEN (Luis, 21 nov).** Nadie lee una conversación por su puesto, ni el
  superadministrador. El candado está en la BASE (hoja 46: `conversacion_miembros` se llena sola de los eventos;
  `ve_conversacion`, `participa_en`). Tres niveles: 1) lo interpretado/registrado, con los permisos de siempre
  (pestaña «Memoria»: `hallazgosDe`, `antecedentes`, `deDondeSalio` = dicho · interpretado · confirmado ·
  registrado, que NUNCA se mezclan); 2) evidencia: `ver_evidencia()` con permiso `ver_evidencia`, sólo mensajes
  `esEvidencia` (`comoEvidencia` al confirmar; `sensible` si es dinero), con bitácora; 3) conversación completa
  ajena: `consultar_conversacion()` con permiso `supervisar_conversaciones`, motivo, 24 h, sólo lectura, bitácora.
  Esos dos permisos **no vienen con ser superadministrador** (`SOLO_OTORGADOS`, `tiene_otorgado`). **Los archivos de una
  conversación van a `c/<conversación>/` del almacén** (`carpetaDe`, `sacarArchivos(…, {carpeta})`, hoja 48: sólo
  sus participantes los ven, bajan, listan o suben; no dejan ficha en `archivos`).
  **AVISOS AL TELÉFONO (hoja 47, `docs/AVISOS.md`)**: web push por cuenta. La base avisa a la función `avisar`
  (`supabase/functions/avisar`, `verify_jwt` apagado: se autentica con el secreto de `avisos_llaves`, tabla que
  ninguna cuenta lee y donde la función genera sus llaves). El aviso NO lleva texto ni importes; agrupa por
  conversación (`tag`), no duplica (`avisos_enviados`), lo obligatorio (asignación, autorización) no se silencia.
  `src/avisos.js` (puro) y `src/avisosRed.js`; `public/sw.js` enseña y abre (`destinoDe`). Si cambias `nucleo.ts`
  hay que volver a desplegar la función. **Sin probar en un teléfono real.** **Agroselectos = la empresa; AgroGestión = el sistema.** WhatsApp es opcional y futuro. Página `chat` («Mensajes») para admin, encargado, agrónomo, finanzas y dirección (hoja 45).
- **La conversación abierta es una pantalla de mensajería** (portal `.msj-pantalla` sobre toda la app, 21 nov): encabezado,
  burbujas del más viejo al más nuevo, barra de escribir fija abajo (adjuntar, cámara, audio; mandar aparece al escribir),
  abre en lo reciente, se ajusta al teclado con `visualViewport`, raya de «mensajes nuevos», botón para volver al final.
  Las propuestas van PLEGADAS dentro del mensaje (`.msj-prop-chip`); pendientes, lo de hoy, integrantes, avisos y reglas se
  abren desde «Opciones». Estado de envío: sólo lo comprobable en el aparato (`por subir`, `no subió`); no hay «leído por el
  otro». El botón atrás del teléfono lo atiende `atrasInterno`. `Propuesta` se llama como función (como componente perdía el
  foco al teclear). Lleva la clase `app` para heredar el tema claro. **No tocó permisos ni interpretación.** Prueba:
  `pruebas/mensajes_movil.py` (Pixel 7; el teclado se imita encogiendo la pantalla).
- **«Dile a la app» YA NO EXISTE como pantalla: es la conversación con AgroGestión dentro de Mensajes (Luis, 21 nov).**
  Un solo acceso (el botón flotante y el menú llevan a Mensajes; `RENOMBRADAS` en `menu.js` pasa a Mensajes lo que alguien
  tenía anclado; la página vieja `dictado` redirige). La conversación es de clase `asistente` (`mensajeria.js`:
  `idConAsistente`, `abrirConAsistente`, `esConAsistente`, `ROLES_CON_ASISTENTE` = admin, encargado, agrónomo): una por
  persona, fijada arriba, `virtual` hasta el primer mensaje (ahí nace su evento). **El asistente no es un integrante**: no
  está en `miembros` ni entra a grupos. Mismo motor que el chat (todo mensaje ahí es `alAsistente`), y las propuestas
  dichas se enseñan con `PropuestaDicha` (la tarjeta que tenía «Dile a la app», sobre `preparar`) y se guardan con
  `firmar` → `confirmarDelChat`: mismo permiso, mismo rastro. Lo que no se clasifica se puede «dejar tal cual en la
  bitácora». **Es privada también en la base (hoja 49)**: su único participante es la cuenta que la abre, no admite
  cambios de gente y NO se abre por consulta excepcional. No contesta preguntas sobre los datos: sólo prepara registros.
  `traeOtroAsunto` (en `relacionar`): una frase con su propio asunto no se pega como respuesta a la pregunta de otra cosa.
  Prueba: `pruebas/dicho_navegador.py` (30) recorre todo lo que hacía «Dile a la app» en su lugar nuevo.
- **IA: HÍBRIDO Y CON TOPE (Luis, 21 nov; `docs/IA-COSTOS.md`).** Ningún mensaje llama a un modelo: entender, proponer,
  contestar y la memoria son reglas propias. **Una foto en un mensaje NO se lee sola** (`leerPapel({ sinIA: true })` al
  mandar; la lectura pagada es el botón `leerFotoDe`). `leer-papel` usa Haiku (`MODELOS`; `superior` sólo si lo pide un
  administrador) y pasa por el tope del MES (hoja 50: `reservar_ia_mes` aparta, `cerrar_ia` cierra, aviso al 70 %,
  bloqueo al llegar; `limites.ia_mes_tope_microusd`). Cada llamada queda en `uso_ia` con cuenta, modelo, tokens, costo,
  `operacion` y `origen`. `estado_de_ia()` + `<AvisoGastoIA>`. **Toda función nueva que llame a un modelo pasa por
  `reservar_ia_mes` y dice su operación; nunca se llama a un modelo al guardar o al mandar algo.**
- **La conversación continúa** (`aclarar`, `pendienteDe`, `esRespuesta` en `operaciones.js`): lo que falta se
  contesta en corto y se entiende DENTRO de la propuesta pendiente («20 pesos el kilo» × lo que se dijo que se
  compró; sin cantidad se pregunta; «tres kilos» no son tres pesos). La frase original no cambia; cada aclaración
  queda en `aclaraciones` (quién, cuándo, qué se entendió, también la que no se entendió) y viaja en `origen`.
  `pagadoCon` se anota y NO mueve ninguna caja. Un préstamo dicho es `prestamo_solicitud` (no deuda).
  **`requiereSesion`**: lo que mueve dinero o toca a una persona no lo confirma quien sólo se identificó por
  teléfono (`via: "telefono"`), ni siendo administrador.
- **Teléfono de una cuenta** (`supabase/pendientes/telefono-de-la-cuenta.sql`, probado en `pruebas/base/telefono.test.mjs`,
  NO instalado): código pedido con sesión + enviado desde el teléfono; una cuenta ↔ un teléfono. `directorio(data, cuentas)`.
- **`src/asignaciones.js`: a qué va cada quien** (el plan visto al checar). El plan son las `indicaciones` de tipo
  `tarea` con su `fecha` (hoy o mañana). `loQueLeToca` es lo que dice el checador al marcar ENTRADA; `planDelDia`
  es la tarjeta «Plan mandado» de «El día» → Reparto. Cambiar (`cambiarAsignacion`) deja el renglón anterior como
  `cambiada` y crea otro que apunta a él; quitar (`quitarAsignacion`) pide motivo. **Planear ≠ asistir ≠ trabajar**:
  el módulo no importa nada y ningún módulo de dinero o asistencia lee `indicaciones` (hay prueba). Checar NO
  inicia la asignación real (`cuadrillas.js`): es decisión pendiente de Miguel.
- **`src/jornada.js`: LA JORNADA** (El día → pestaña «Jornada»; `docs/JORNADA.md`). No guarda lo que pasó: JUNTA lo
  planeado (`indicaciones`), quién vino (checador), dónde se trabajó (`tramosDeTrabajo`), avances e incidencias, y dice de
  cada tarea qué se sabe y con qué (`jornadaDe`, `ESTADOS`). **«Hecha» sólo es lo que una persona marcó; horas en la
  parcela = «se trabajó ahí». De quien no checa no se dice «no vino»: «no hay con qué saberlo».** El cierre
  (`cierre_jornada`, foto con versión; `reapertura_jornada` con motivo) pide el porqué de cada tarea sin evidencia
  (`MOTIVOS`, lo dice una persona) y qué pasa a mañana (`tareasParaManana`: se proponen con `vieneDe`, una sola vez, y
  se mandan cuando alguien lo pide). `diferenciasDelCierre` enseña lo que llegó después. **Ningún módulo de dinero lee
  la jornada ni su cierre** (hay prueba). Un cambio de plan NO se pierde: `jornadaDe().cambios` enseña el renglón
  original (`cambiada`/quitada) con quién, cuándo, por qué, por cuál se reemplazó y lo trabajado ahí; ese rato no es
  «fuera del plan». Lo hecho y lo cambiado no pasan a mañana. Recorrido: `pruebas/reasignacion_navegador.py` (20).
  **Los seis criterios de Luis para la jornada están SIN implementar hasta validarlos con Miguel** (`docs/JORNADA.md`). «Reasignar equipo» (mover a varios en una captura) está sólo EVALUADA ahí: no se construye hasta saber cómo reasigna Miguel; dar la instrucción no mueve horas, y plan sin asignación (o al revés) se advierte. El tope de IA del mes cubre también la importación (hoja 51).
- **`src/organizacion.js`: LA ORGANIZACIÓN, etapa 1 construida** (página `organizacion`, sólo admin; `docs/ORGANIZACION.md`).
  Es sólo el MAPA: áreas y equipos (`org_unidad`, `_cambio`, `_cierre`), responsables (`org_cargo`, `_fin`), equipo
  habitual (`org_adscripcion`, `_fin`) y apoyo temporal (`org_apoyo`). Todo con fecha «desde»; `organizacionEn(eventos,
  fecha)` la CALCULA; `superiorDe` sale de la cadena; `historialDe`; `enCalidadDe` (para copiar el cargo a lo que se
  haga). Un responsable nace `provisional`. `estructuraProvisional` (ids fijos) crea sólo unidades, sin personas.
  **No da ni lee permisos y nadie decide con él** (hay prueba: ningún módulo de permisos, dinero, asistencia o jornada
  lo importa). Ningún nombre de persona en la lógica (hay prueba). **Quién captura lo valida la BASE (hoja 52)**: los
  hechos `org_*` y `act_*` están en `OPERACION_DE` con la operación `configurar_organizacion`, que es SÓLO OTORGADA
  (ni el superadministrador la tiene por serlo; `puede_operar_evento`, columna `solo_otorgado`); el mapa cuenta con
  `vigentes()`, así que lo no autorizado no aparece. La hoja no le dio el permiso a nadie.
  **`src/actividades.js`: EL CATÁLOGO ÚNICO DE ACTIVIDADES** (pestaña «Actividades» de Organización): `DE_FABRICA` =
  sólo lo que las pantallas ya ofrecían; Reparto, Cuadrillas y la actividad tecleada leen de `catalogoEn`. **No pongas
  otra lista de actividades en una pantalla.** `normalizar` no adivina; lo no reconocido sale en `porLigar` y lo liga una
  persona (`act_equivalencia`). Requisitos (`act_requisito`): legal · interno · experiencia; lo legal nace `por_validar` y
  no se valida sin norma y sin quién validó; lo interno no lleva norma ni cambia de clase. `RESTRICCIONES_ACTIVAS = false`:
  nada restringe todavía. El catálogo trae TODO lo que alguna captura ya ofrecía (25; una prueba lee las listas de
  `App.jsx` y falla si falta una); la bodega es un lugar, no una actividad; `nombres()` sólo ofrece en Reparto/Cuadrillas
  las doce de siempre + lo agregado. Umbral para SUGERIR por actividad (`UMBRAL_PROVISIONAL` 10 días · 40 h · 1 confirmada ·
  12 meses): no acredita ni autoriza. Requisito legal: norma, vigencia, quién validó y cuándo.
  **`src/ejecucion.js`: QUIÉN ORDENÓ · CAPTURÓ · EJECUTÓ · CONFIRMÓ**: `add` le pone `quienes` a toda actividad y
  aplicación (`conQuienes`); se lee con `quienesDe` (los registros de antes: `origen: "registro_anterior"`, sin rellenar).
  **Quien registra una aplicación NO es por eso quien la aplicó**; guardar una aplicación sin aplicadores AVISA antes (`avisoSinAplicador`; no bloquea) y queda «Sin aplicadores identificados»; una cuadrilla es un grupo; `confirmo` nace vacío. Los
  módulos de dinero NO leen `quienes` (hay prueba): siguen con `registradoPor`/`trabajadorId`.
  **Etapas 2 a 6 y el motor de especialidades (`docs/ESPECIALIDADES.md`): SÓLO DISEÑO, sin autorizar.** No
  cambies permisos ni actives recomendaciones; la estructura real espera a Miguel, Fito y Dirección. Lo acordado: cuatro
  niveles (experiencia observada · especialidad declarada · capacitación · habilitación); la experiencia se calcula y
  nunca se vuelve autorización; una habilitación legal no tiene excepción interna; las facultades serán operaciones de
  la hoja 37 con alcance; un cargo no da facultades; las tareas de una orden son las `indicaciones` de siempre.
- **`src/whatsapp.js` + `supabase/functions/whatsapp-entrada/` + `supabase/pendientes/whatsapp-entrada.sql`: WhatsApp PREPARADO
  Y APAGADO.** El lector convierte el aviso de Meta en el `mensaje` del camino común (teléfono → persona del
  catálogo; desconocido o repetido no se atribuye; mismo id no entra dos veces). La función sólo comprueba la firma
  y guarda tal cual; no entiende, no registra y **no tiene con qué enviar**. **No la despliegues ni instales su
  hoja sin que Luis autorice cuenta, número y costos.** `pruebas/funcion_whatsapp.test.mjs` la prueba sin red.
- **`src/avances.js`: avance de trabajo** (`avance_trabajo`): se registra en la unidad
  que se dice (regulador, surco, caja…). **Avance ≠ pago** (no crea actividades ni costo;
  «siete personas» es un número) y **avance ≠ porcentaje** (los reguladores no son
  iguales: `porcentaje: null`). `sugerenciasDeContinuidad` recuerda lo pendiente diciendo
  en qué se basa, y sólo estima gente con 3 registros iguales. Planear ≠ ejecutar: un plan
  nunca genera rayas, pagos ni costos.
- **`src/mapa.js` + `src/Mapa.jsx`: el mapa del rancho** (página `mapa`; plan y costos en
  `docs/MAPA.md`). NO es un sistema aparte: pinta las mismas parcelas, ranchos y ciclos.
  Lo único que agrega son los límites, como evento `limite_geo` (`guardarLimite`,
  `quitarLimite` con motivo, `limitesDe`): dibujado, caminado con el teléfono o importado
  (KML/GeoJSON, `leerArchivoGeografico`; nada entra sin decir de qué parcela es).
  **Un límite nunca se supone**: parcela sin límite = «sin límite». La superficie se MIDE
  (`superficieDe`) y `parcela.hectareas` NO cambia sola (`compararSuperficie`; «usar la
  medida» es un `upd` que decide una persona). `fichaDeParcela` enseña lo que ya se sabe
  del ciclo vigente; no calcula nada nuevo. `conPoligonos` le da los límites al dron sin
  guardarlos en la parcela. Leaflet viene de `window.L` (ya se cargaba); el fondo sale de
  `CAPAS_BASE`. Una imagen de satélite o de dron entra como CAPA y como evento con su
  procedencia; **un índice (NDVI) es un indicio, nunca un diagnóstico**.
  `pruebas/mapa_navegador.py` pide `LEAFLET=/ruta/a/leaflet/dist` (no usa red).
- **Satélite para ANÁLISIS** (`src/satelite.js` puro, `src/lectorSatelite.js` red,
  `src/Satelite.jsx` pantalla; se abre desde la ficha de una parcela CON límite). **No es
  el fondo del mapa**: el fondo es un mosaico sin fecha; esto es una pasada de Sentinel-2
  con día, hora y nubosidad, en cuadros de 10 m. Fuente: Planetary Computer, sin cuenta
  ni llave (catálogo + recorte hecho en su servidor: ~10 kB por fecha; `FUENTE`); el
  lector de imágenes (`geotiff`) se carga sólo al abrirlo. Reglas: cuenta sólo lo que cae
  dentro del límite y lejos de la orilla (`cuadrosDentro`); nube, sombra o sin dato **no
  cuenta y no se rellena** (`calcularIndice`); a la línea del tiempo sólo entran lecturas
  completas (`sirveParaSerie`); una fecha que se sale de sus vecinas es `dudosa`, no se
  borra; `compararFechas` dice cuánto cambió y **nunca por qué** (hay prueba contra
  palabras de diagnóstico). Se guarda sólo el resumen (`lectura_satelital`, id fijo por
  pasada, atado al límite); la imagen no. **Ninguna prueba toca el servicio real**:
  `pruebas/satelite_navegador.py` usa recortes de mentira (`pruebas/apoyo/`).
- **`src/ciclos.js`: el cultivo de una parcela DEPENDE DE LA FECHA.** Sale del
  ciclo (`siembras`) que la parcela tenía ese día (`cultivoEn`, `partesDe`),
  no de `parcela.cultivo`. Un ciclo terminado sigue contando en sus fechas;
  dos ciclos a la vez reparten (por superficie o parejo) con suma exacta, nunca
  se carga entero a los dos; lo que cae fuera de todo ciclo queda `sinCiclo`,
  a la vista, y no se reparte. Finanzas → «Resultado por cultivo»
  (`resultadoPorCultivo`) y el reporte por ciclo salen de ahí. **No vuelvas a
  agrupar costos por `parcela.cultivo`**: es el error del Excel (una ubicación
  = un cultivo para siempre). Una parcela sin ningún ciclo usa su cultivo
  anotado, y la pantalla lo dice.
- **Un gasto de «insumos» no es siempre una compra para el almacén**
  (`claseDeInsumo`, `resultado.js`): `destinoInsumo` = inventario · produccion ·
  general · otro; sin decir → **por clasificar** (ni gasto ni inventario; en el
  flujo sí). Se clasifica en Finanzas → Resultados.
- **`src/caja.js`: NO TODA SALIDA DE CAJA CHICA ES GASTO (Luis, 21 nov).** Cada salida dice qué fue (`clase`) y de eso
  depende a dónde se carga, usando lo que ya existía: `gasto_parcela` y `gasto_general` dejan un gasto ligado
  (`egresoDeCaja`, id fijo `eg-<movimiento>`, `cajachicaId`; el general SIN parcela → gastos generales);
  `inventario` deja un gasto de «insumos» con `destinoInsumo: inventario` (no es gasto hasta que se use);
  `prestamo` y `pago_personal` NO crean nada: se LIGAN (`eventoId`, `revisarLiga`: mismo importe, vigente, libre) a la
  entrega o al pago que vive en su pantalla; `traspaso` no cuenta; `otro` = por clasificar. **El fondo que entra a la
  caja es un traspaso: ni ingreso ni gasto.** El flujo lee `salidasDeCajaAlFlujo`: una salida se cuenta UNA vez — por
  su gasto, por su evento, o aquí como `caja_por_clasificar` / `caja_por_ligar`; nunca desaparece. Una salida de antes
  sin clase ni parcela es «por clasificar». Lo pendiente sale en Caja chica y en Finanzas → Resultados
  (`pendientesDeCaja`). **La caja no crea préstamos ni pagos**, y de un movimiento sólo se corrige el concepto.
- **Bonos y salario integrado**: `integra` es `si` | `no` | `revisar` (por
  defecto `revisar`; la app no lo decide por el nombre del bono). Decidirlo
  después es `bono_revision` (sensible, hoja 42), con fundamento.
- **Maquinaria**: la diferencia cuota−real se reparte por defecto a las parcelas
  que usaron la máquina, en proporción a la cuota. Si falta combustible,
  depreciación (o `sin_depreciacion`) o un precio, la cuenta está `incompleta`
  y **no hay diferencia a favor**: se conserva la cuota. El uso general del
  rancho no va a parcelas. Los ajustes de valuación de un vehículo se quedan
  en ese vehículo (`consumosConAjustes`).
- **Compras a medias** (`seguimientoDeCompras`): sin recibir, sin precio o con
  diferencias, con días, responsable y aviso al abrir (`compra_aviso_d`,
  `compra_escala_d`).
- **UNA SOLA ENTRADA** (`acceso.js`: `caminoDeEntrada`, `quienEntraConPin`,
  `entrarConCredencial`, `puertaDeAsistencia`): nadie escoge perfil; el PIN o
  el correo dicen quién es. **La credencial sola no abre sesión** (pide el
  PIN). Un PIN repetido no deja entrar a nadie. Checar desde la pantalla de
  entrada, sin sesión, sólo en un aparato ligado por un encargado.
- **`src/almacenEventos.js`**: los eventos NO viven en el cajón de 5 MB: viven
  en IndexedDB (`LLAVES.eventos`), uno por renglón (`useCajon`). De la nube se
  bajan aparte, sólo lo nuevo y por páginas (`leerEventosDesde`), cada 2 min.
- **`src/menu.js`**: encontrar las cosas. Cada pantalla tiene UN nombre y UN
  grupo (`FUNCIONES`, `GRUPOS`), cada perfil ve sólo las suyas (`PANTALLAS_DE`),
  y cada persona ancla su inicio y escoge su barra de abajo. Se guarda por
  persona en `LLAVES.menu` y, si entró con cuenta, en su renglón de la tabla
  `preferencias` (hoja 34: cada quien lee y escribe sólo el suyo); entre dos
  aparatos gana el acomodo más reciente (`mezclarPrefs`). No hay grupo "Hoy":
  lo de hoy no es lo mismo para el contador que para el capataz. Cada
  administrador dice a qué se dedica más (`ENFOQUES`) y eso cambia con qué abre
  y el orden de su menú — **nunca lo que puede hacer**. Esconder un grupo
  tampoco quita permiso. El inicio ya NO lleva una
  cuadrícula de tarjetas: lleva `<AccesosInicio/>`. **Una pantalla nueva se da
  de alta en `menu.js`** o nadie la encuentra; la prueba compara contra `App.jsx`.
  La app acomoda, no decide: lo que la persona ancló no lo mueve el uso.
- **`src/pdf.js`**: leer PDF. **Se carga con `import()` dinámico** — pesa ~365 kB
  y sale en su propio archivo, así que sólo lo baja quien abre un PDF. El
  tractorista que nada más captura diésel nunca lo descarga.
- **`src/lectorPapeles.js`**: la cascada de verdad (toca cámara, códigos y red).
  Ver más abajo.
- **Backend**: Supabase (PostgreSQL + auth). `src/supabase.js` (cliente),
  `src/dataApi.js` (lectura/escritura por tabla).
- **Excel**: `src/excelLoader.js` (plantillas, importación, pólizas CONTPAQi).
- **Estilos**: un único template string `const CSS` dentro de `App.jsx`. No hay
  Tailwind ni CSS externo.
- **Iconos**: SVG dibujados **dentro del propio código**, en `src/icons.jsx`. El
  mapa `ICONS` guarda el trazo y `EMOJI_MAP` traduce emoji → nombre; el componente
  `<Ic e="🏭"/>` sigue siendo la forma de usarlos. No hay fuente que descargar, así
  que funcionan sin señal desde el primer arranque. (Antes era una fuente
  auto-hospedada; `public/fonts/ms-icons.woff2` quedó de esa época y ya nadie la
  usa.) Si necesitas un icono que no está, agrégalo a `ICONS` — no metas un emoji
  suelto, porque `<Ic>` cae a una etiqueta genérica cuando no encuentra el nombre.
- **Tema claro/oscuro**: `aplicarTemaGuardado()` corre antes del primer render y
  `<ThemeBtn/>` lo cambia. Cualquier color nuevo va como variable CSS, nunca
  quemado, o se rompe en uno de los dos temas.
- **Despliegue**: GitHub (`luispachap/agrogestionpya`, rama
  `produccion/base-vigente`) → Vercel, proyecto `agrogestion-operacion`. Se
  publica SÓLO mandando esa rama a producción a propósito; Vercel omite todo lo
  demás (`main`, vistas previas). Luis ya no pega archivos en StackBlitz.

## Datos

- **Estado local**: `localStorage`, en un cajón propio por ESPACIO (un espacio =
  un proyecto de Supabase). Las llaves salen de `LLAVES` en `src/supabase.js`
  (`agro_v8:<espacio>`, `agro_cola_v8:<espacio>`…). **Nunca escribas una llave a
  mano**, y nunca `localStorage.clear()`: en el teléfono vive aparte lo de antes
  (`agro_v7` y su cola), que la app no lee, no sube y no borra.
- **Sincronización**: escribe local + encola a la nube. `TABLAS_NUBE` en `App.jsx`
  y `TABLAS` en `dataApi.js` **deben coincidir siempre**.
- **Columnas**: las tablas de Supabase tienen columnas fijas; todo campo extra
  viaja dentro de la columna JSON `datos`. Por eso se pueden agregar campos nuevos
  sin migración (ej. la ficha de agroquímicos de Fito).
- **55 colecciones que sincronizan** (62 tablas con las de reglas). Si agregas una colección nueva: regístrala en `INITIAL`,
  `TABLAS_NUBE`, `dataApi.TABLAS` y `COLUMNAS_REALES`, **y escribe su SQL**
  en `supabase/` siguiendo el patrón de `17-tabla-config-contpaqi.sql`
  (id/datos/actualizado), pero con las reglas de acceso de la hoja 24
  (`puede()`), no `tiene_perfil()`. La instalas tú (ver "Infraestructura
  propia"); si no, el dato se queda solo en el teléfono.
- `supabase/14-verificar-tablas.sql` comprueba que todas existan. Actualízalo
  cuando agregues una.

## Trazabilidad (el corazón del sistema)

Cadena de estibas: **barbecho → limpia → relimpia → calibre**. Cada estiba tiene
código (`AS-B/L/R/C-###`), saldo, y apunta a sus padres vía `consumos`.
`rastrearOrigen()` sube recursivamente hasta la parcela.

- `crearEstiba(data, add, upd, {fase, cajas, cultivo, parcelaId, consumos, ...})`.
- **`noDescontar: true`** registra el vínculo de trazabilidad sin restar saldo del
  padre. Se usa entre limpio y calibre porque **son cajas de distinto tamaño**
  (plástico vs cartón) y la relación no es 1:1. El saldo de limpio solo se ajusta
  con **conteo físico**.
- `saldoDe(e)` = `e.saldo ?? e.cajas`. Estado "consumida" cuando llega a 0.

## Corrida de ajo — el módulo crítico

Un solo componente `CorridaAjo` con cuatro pestañas: corrida en vivo, calidad,
categorías aparte, administrar. **No lo vuelvas a separar** — se unificó a
petición expresa de Luis porque control y operación son la misma faena.

**Calibres**: `CALIBRES_CORRIDA` = 5–11 (cuentan para el rate).
`CATEGORIAS_APARTE` = Corona, Grano, Deshecho/segunda, Pata de perro (no cuentan;
van a inventario). El calibre 12 no existe, se eliminó.

**El bug del Excel de Migue (resuelto, no lo reintroduzcas)**: su hoja calculaba
el consumo restando inventarios, así que al agregar limpio a media corrida el rate
se desplomaba a 0. Aquí el rate se mide como **cartón producido acumulado ÷
tiempo**. Agregar limpio mueve el ETA, nunca el rate. Hay prueba: 150 cajas, 20 en
5 min = 4.0/min; agregas 20 más → sigue 4.0.

**Conteo físico (método real de Migue)**: cada cierto tiempo cuenta las cajas de
limpio que quedan. Ese conteo recalibra la proporción cartón/plástico con datos
medidos, no estimados. Tres formas: botón manual, recordatorio cada N cajas
(configurable), y deducción al vaciar una tarima (con confirmación). Mientras no
haya conteo, la proporción se marca "~ estimado" en ámbar; con conteo, "✓ real".

**Pool de tarimas**: varias tarimas "en la mesa". Modo **preciso** (eliges de cuál
corres, traza perfecta) o **revoltura** (corres de todas; al cerrar calibre reparte
proporcional según saldo — la traza sigue llegando a parcela, distribuida). Alta
rápida para tarimas limpiadas durante la corrida.

**Ciclo de 15 minutos**: recordatorio de corte → sugerencia de muestreo de calidad
→ Migue ajusta el ritmo de la corredora (bajo/medio/alto), que queda registrado
junto a la calidad.

**Regla de diseño innegociable**: la app **informa, Migue manda**. Muestra la
tendencia ("la calidad bajó de 95% a 88%, ibas a ritmo alto") pero **nunca ordena**
"sube el ritmo". Su criterio de experto ve cosas que la app no. Si la app manda y
se equivoca, pierde la confianza de todos.

## Cierre de la versión 1.0 (21 nov) — lo que quedó y no se rompe

Estado, alcance y veredicto: `docs/ENTREGA-1.0.md`. Guía para operar, respaldo y la prueba de campo: `docs/OPERACION-1.0.md`.
**Funcionalidades nuevas congeladas** hasta que la 1.0 opere: sólo se corrige P0 y P1.

- **`pruebas/entrega_navegador.py` es LA prueba de entrega**: un día completo con cuentas contra una nube de imitación
  que guarda y devuelve (`pruebas/apoyo/nube_entera.py`): alta → checar → plan → reparto → cambio → incidencia →
  compra y aplicación → sin señal → cierre → pagos → salir, recargar, aparato nuevo → todas las pantallas de todos los
  perfiles → respaldo y restauración. Si cambias sincronización, sesión, almacén o pagos, corre ésta. En esa prueba el
  trabajador de servicio va bloqueado (Playwright no intercepta lo que él pide); lo suyo lo prueba `sinsenal_navegador.py`
  contra la versión compilada.
- **La cola reintenta sola** cada 30 s mientras haya algo (`CADA_CUANTO_REINTENTAR_MS`), y una falla de RED no gasta
  intentos (`esFallaDeRed`): sólo un rechazo de la base cuenta para apartar un registro.
- **Lo de otros aparatos se vuelve a bajar** cada 5 min con la app a la vista y al regresar a ella (`tocaBajar`), no sólo
  al entrar. Los eventos siguen cada 2 min.
- **`public/sw.js`**: guarda desde la instalación lo necesario para arrancar (lee las piezas de la portada); `/assets/`
  es caché primero; la portada es red con límite de 4 s; la portada se guarda AL FINAL, después de sus piezas. Si lo
  tocas, corre `sinsenal`.
- **Alta de personal**: `revisarAlta` (nombre, sueldo, PIN de 4 a 8 números y que no lo tenga nadie más; también al
  editar la ficha) y `sueldoDeAlta` (el sueldo vale desde el día del alta). **Mandar una tarea** no la repite (`yaMandada`).
- **Teléfono compartido**: la sesión con PIN de trabajador, cuadrilla o externo se cierra sola a los 5 min sin tocar
  (`debeCerrarse`); nunca la del encargado ni la de quien entró con cuenta. `cerrarSesion` no espera sin límite
  (`conLimite`): sin señal también se sale.
- **Respaldo**: lleva SÓLO lo capturado (`soloLoCapturado` sobre `rawData`), nunca lo calculado. Restaurar reemplaza el
  aparato Y vuelve a subir todo con `subirColeccion` (mismo id: no duplica). **Ya no existe «Reiniciar datos»** ni poner
  el inventario en cero: no los vuelvas a poner. Otra base = `herramientas/respaldo-a-otro-espacio.mjs`.
- **Producción = lo probado**: `node pruebas/base/paridad.mjs --consulta` da las huellas de la base de pruebas y la
  consulta de sólo lectura para producción. Deben coincidir las siete. Después de instalar una hoja, vuelve a compararlas.
- Ya no hay aviso de «PINs de fábrica»: no existen. No lo regreses.
- **Restaurar no reescribe la historia (hoja 53, instalada el 21 nov).** Cada sello de evento lleva una firma
  (`sello_firma`, `firma_de_sello`) hecha con una llave que ninguna cuenta lee (`sellos_llave`; tampoco la de
  servicio). Restaurar se ABRE con motivo (`abrir_restauracion`, superadministrador, una hora, queda en
  `restauraciones`) y sólo recupera el sello original si la firma coincide; lo restaurado queda marcado (`restaurado`,
  `restaurado_por`). La app manda el sello con `conSelloOriginal` y sube sólo lo que falta (`soloFaltantes`).
- **Respaldo automático: PREPARADO, SIN ESTRENAR** (`herramientas/respaldo/`, `docs/RESPALDO-AUTOMATICO.md`). Corre en
  un repositorio PRIVADO aparte (este es público) y toma de aquí sus herramientas. `respaldar.sh` sólo lee;
  `restaurar.sh` se niega contra producción y contra un proyecto con tablas, y comprueba con `huellas.sql`
  (estructura + cada tabla), `archivos.mjs comprobar` y `ataques.sql`. **No se declara resuelto hasta el ensayo real.**
  `huellas.sql` se genera de las consultas de `pruebas/base/paridad.mjs`: si cambian, se vuelve a generar.

## Cómo verificar tu trabajo

Después de **cada** cambio en `App.jsx`, en este orden:

1. `npm test` — las pruebas de `src/calculos.js`. Corren con el corredor que ya
   trae node; no hay nada que instalar. **Cada arreglo deja una prueba con nombre**,
   en español y en la lengua del rancho (`la_remision_nunca_imprime_100_centavos`,
   no `test_17`): dentro de seis meses ese nombre es lo único que va a explicar
   por qué la prueba existía.
2. `npm run build` — debe decir "✓ built" y transformar **224 módulos**, y el
   archivo `pdf-*.js` debe seguir saliendo APARTE del principal.
3. Revisa que no haya declaraciones duplicadas a nivel superior ni fragmentos JSX
   desbalanceados.
4. **Levanta la app y ábrela.** El build NO detecta un `ReferenceError`: compila
   feliz y la pantalla truena al abrirse. Ya pasó una vez con el panel del dueño.
   Si tocaste una pantalla, entra a esa pantalla.

## Cosas que se han roto antes

- **PINs de dirección**: el login validaba contra config local, pero la nube solo
  se baja después de iniciar sesión — huevo y gallina. Ahora baja
  `config_seguridad` fresca antes de validar. Patrón reusable: cualquier dato que
  controle el acceso hay que traerlo antes de la puerta, no después.
- **Iconos**: un fallback mostraba emojis "hasta que cargue la fuente", pero el
  navegador solo descarga una fuente si algo la está usando → nunca cargaba. Por
  eso ahora la fuente es local y se fuerza con `document.fonts.load()`.
- **Modo revoltura**: el limpio se registraba solo al *seleccionar* tarima, y en
  revoltura no se selecciona ninguna → el panel en vivo nunca aparecía. Ahora el
  limpio entra cuando la tarima entra al pool.
- **Zona horaria**: Supabase guarda en UTC. Zacatecas es UTC−6. Un timestamp de
  "4:30" es 10:30 de la mañana local. Ha causado falsas alarmas. **Para decidir qué
  día o qué mes es, usa `fechaLocal`/`mesLocal`/`sumarDias` de `calculos.js`; para
  guardar una marca de tiempo, UTC.** Nunca `toISOString()` para sacar un día: el
  panel del dueño cambiaba de mes a las 6 de la tarde y el resumen semanal encogía
  de 7 a 6 días, por eso mismo.
- **El empate lo ganaba la nube**: al sincronizar, lo local no llevaba marca de
  tiempo y la nube sí, así que una corrección hecha sin señal desaparecía de la
  pantalla al volver el internet. Ahora `add`/`upd` estampan `_actualizado` y en
  un empate gana lo local (`ganaAlSincronizar`). El dato nunca se había perdido
  —la cola lo guardaba— pero la persona veía que su corrección se borró sola, que
  es peor.
- **Un UPDATE sin WHERE truena en la base real y no en las pruebas**: Supabase
  le carga a las cuentas de la app una regla (`safeupdate`) que rechaza todo
  `UPDATE`/`DELETE` sin `WHERE`, también dentro de una función. La base de
  pruebas no la trae. Al primer superadministrador no lo dejó entrar con su
  código de arranque. Toda sentencia dice cuál renglón (`where id = 'unico'`),
  y `src/hojasSql.test.js` lo vigila.
- **Un dato que falta no es un cero**: `leerTodo()` convertía en lista vacía toda
  tabla que fallara al bajar, y la utilidad salía igual de verde. Ahora devuelve
  `_fallas` y `_topes` y la app lo dice en una banda arriba.

## Documentos imprimibles

Remisión de venta (formato fiscal que ya usaba Migue en Excel), etiquetas de
estiba y calibre, nómina. Todos llevan el logo. `numeroALetras()` convierte el
importe a letra con la gramática correcta: "UN PESO" singular, "VEINTIÚN MIL"
apocopado, "UN MILLÓN DE PESOS" con la preposición. Si la tocas, prueba esos casos.

## Gráficas

Componentes SVG propios (`GraficaBarras`, `GraficaBarrasPar`, `GraficaLinea`), sin
librerías, funcionan sin conexión. Están en: finanzas (ingresos vs gastos, costo
por cultivo), corrida (cartón/min por corte), calidad (% de bueno, defectos) y
rendimiento por parcela (kg y kg/ha). Aparecen solas cuando hay 2+ datos y se
ocultan si no hay — nunca gráficas vacías.

## Leer papeles: de gratis a caro

El rancho le compra a los mismos veinte proveedores todo el año, y el ticket de
agosto tiene el mismo formato que el de julio. Mandar cada papel a un modelo es
pagar por resolver un problema ya resuelto — **y mete variabilidad donde no la
había**: la misma línea puede leerse distinto dos veces. El orden es:

1. **El QR** de la factura impresa (`BarcodeDetector`, nativo). Da el folio
   fiscal. **Nunca le hagas OCR al total**: un 3 leído como 8 sale plausible y
   equivocado y nadie lo revisa. El UUID o valida o no valida.
2. **El XML del CFDI** (`DOMParser`, nativo). Trae todo exacto, gratis, sin señal.
3. **El patrón aprendido** de ese proveedor. Guarda **junto a qué palabra** estaba
   cada dato y **cuál** de los números era — nunca el valor. Por eso el ancla
   `TOTAL` no casa dentro de `SUBTOTAL`, y por eso en `IVA 16%  1,080.00` sabe que
   el que importa es el segundo número.
4. **La IA**, sólo para un formato que todavía no se conoce.
5. **"Por identificar"** si sigue sin saber. No adivina: una persona lo resuelve
   en diez segundos, contra tres horas en el cierre.

**Lo que esto NO hace, y hay que decirlo:** el patrón **no quita la llamada a la
IA cuando lo único que hay es una foto**. Para aplicar una regla hace falta texto,
y de una foto el texto sale de leerla; un OCR local pesa megas y `public/sw.js` es
red primero. Lo que el patrón sí ahorra en una foto es que la IA ya sólo
transcribe: cuál número es el total lo decide la regla, igual todos los meses. Un
papel que llega como archivo (XML, Excel, CSV) no pasa por la IA **nunca**.

Por eso, igual que con el banco: **pídele al proveedor el XML, no la foto.**

- **La llave de la IA NO puede vivir en el navegador.** Está en
  `supabase/functions/leer-papel/`, una Edge Function. Vite mete toda variable
  `VITE_*` dentro del archivo que Vercel le sirve a cualquiera.
- **Si la Edge Function no está instalada, la app no se rompe**: lo dice y ofrece
  capturar a mano. La foto se guarda siempre — nunca se pierde evidencia de un pago,
  aunque salga borrosa.
- **Sólo se aprende de lo que una persona confirmó.** Aprender de una lectura que
  nadie revisó es aprender de una suposición. Y de un XML **no se aprenden anclas**:
  ya viene estructurado, y `Moneda="MXN" Total="` sería un ancla envenenada para un
  ticket de papel.
- **La medida es cuántas sobrevivieron sin corregir**, no cuántas se propusieron:
  esa sube sola con proponer más, aunque se proponga mal (`tasaSobrevivencia`). Sin
  revisiones no hay tasa — un 100 % sobre cero revisiones es una mentira.

## Para qué existe este sistema

No es contabilidad ni es fiscal. Es **control interno en un negocio familiar**:
que no se pierda dinero, que nadie mueva algo sin dejar rastro, y que el dueño
se entere **a tiempo**. En una familia el activo real es la confianza, así que
el trabajo del sistema es que todos vean los mismos números sin tener que
creerle a nadie — y **nunca decidir por la persona**.

De ahí salen las tres de `src/vigilancia.js`:

- **¿Alcanza para el sábado?** Una palabra: *alcanza*, *falta*, o **NO SÉ TU
  SALDO** — con la letra chica pegada: de dónde salió cada saldo y de qué fecha
  es. Si falta el saldo de una bolsa, si el que hay tiene más de 15 días, o si no
  hay ninguna bolsa registrada, **no contesta "alcanza"**. Un saldo de hace dos
  meses sigue siendo mejor que ninguno, pero no se disfraza de actual. Y nunca
  dice "no compres".
- **Lo que dejó de aparecer.** La métrica que importa no es "falló", es "NO
  APARECIÓ": una captura que truena se ve sola, la que dejó de hacerse no. El
  tractor que lleva 24 días sin reportar sale aquí. **No supone por qué** —puede
  estar descompuesto, prestado, o alguien dejó de anotar—, sólo dice cuántos días
  lleva. Y "nunca se ha capturado" va aparte de "dejó de aparecer": son problemas
  distintos.
- **Contra el mismo mes del año pasado**, no contra el mes pasado. Un rancho es
  estacional: en agosto siempre cae. Comparar contra julio produce alarmas falsas,
  y **las alarmas falsas enseñan a ignorar las alarmas**. Si no hay datos del año
  pasado, no se compara contra el mes pasado como premio de consolación: se dice
  que todavía no hay con qué comparar.

## Un papel entra por donde sea, y siempre se valida igual

Excel, CSV, **PDF** y **foto**. Todos acaban en la misma forma
(`{encabezados, filas}`) y pasan por la **misma validación aritmética** — y eso
es lo que hace segura la foto: si la IA leyó mal un dígito, la cadena de saldos
se rompe y el estado no entra. La aritmética atrapa lo que el ojo no.

- **PDF con capa de texto** (el del portal del banco, el del contador): se lee
  **exacto, gratis y sin IA**. Es el caso más común.
- **Las columnas salen de la GEOMETRÍA, no de contar espacios.** El PDF trae la
  posición X de cada celda: ésa es la información de columnas de verdad
  (`columnasPorPosicion`). Contarle los espacios a un texto ya colapsado es
  adivinar algo que el archivo decía exacto — y así funciona igual con los
  importes alineados a la derecha, que es como los pone cualquier banco.
- **PDF escaneado** (una foto metida en un PDF): se dice que lo es y se ofrece
  leerlo como foto. No se devuelve un archivo vacío en silencio.
- Lo que decide si un PDF es legible **no es cuántos renglones trae** sino si se
  encuentran las columnas: un estado de un mes flojo trae cinco movimientos y es
  perfectamente bueno.

## El ganado

Antes no había nada — "ganado" en el código eran los "bonos ganados" de la
nómina. `src/ganado.js` trae el padrón, el cuadre del hato, la báscula, la
jeringa y los potreros. Dos reglas mandan ahí:

- **El tiempo de retiro es seguridad**, igual que la reentrada en las parcelas:
  vender un animal antes de que pase el retiro de un medicamento le llega al
  consumidor. Si NO se capturó el retiro, la respuesta **no es "ya se puede
  vender": es "no sé"**.
- **El hato se cuadra, pero NO se ajusta.** Si el conteo del potrero no coincide
  con el padrón, la diferencia se queda con su nombre. Un animal que falta es
  una pregunta, no un número que se corrige. Y cada baja lleva su motivo: la
  mortandad también se anota.

## Varios RFC, una sola empresa — el eje

Fiscalmente son personas distintas. Económicamente es **un solo negocio**. Hasta
que existió `src/socios.js`, la utilidad que enseñaba la app era la de un negocio
imaginario donde todo el dinero es del mismo dueño.

- **Titular** = una persona o un RFC. **Bolsa** = una cuenta, una tarjeta o un
  efectivo, y cada bolsa tiene **un** dueño.
- Migue paga al proveedor con su tarjeta → gasto del rancho, y **el rancho le
  queda debiendo a Migue**. Un cliente deposita con Rodolfo → ingreso del rancho,
  y **Rodolfo tiene dinero del rancho en su bolsa**. Eso es `cuentaCorriente`, y
  **es la función que evita pleitos entre hermanos**.
- **La app NO decide qué es del rancho y qué es personal.** `proponerDestino`
  propone a partir de cómo se marcó antes y **dice en qué se basa** ("así se
  marcó 340 veces"); si al mismo proveedor se le ha marcado de las dos formas,
  **no propone**: depende del caso, y ahí es donde se equivocaría.
- **Lo personal no se borra: se marca y se excluye**, para que el estado de
  cuenta siga cuadrando contra el banco.
- **Un traspaso entre bolsas propias no es ingreso ni gasto** — contarlo así
  infla el año por los dos lados.
- **El dinero sin bolsa NO se reparte entre los socios**: se dice cuánto es y que
  esos saldos están incompletos. Repartir lo que no se sabe es exactamente cómo
  se ensucia la cuenta entre hermanos.
- La utilidad **nunca se enseña sola**: lleva pegado cuánto quedó fuera por
  personal y cuántos movimientos nadie ha marcado todavía.
- Se deja dicho **a nombre de qué RFC** quedó cada comprobante. **No se calculan
  impuestos**: esto es control interno.

## El estado de cuenta del banco se valida solo

Se sube el Excel o CSV que el banco da y la app lo **comprueba antes de creerle
nada**:

    saldo inicial + Σ abonos − Σ cargos = saldo final
    saldo anterior + abono − cargo      = saldo del renglón

La segunda es la valiosa: la primera dice que *algo* está mal, la segunda dice
**cuál renglón**. Si no cuadra al centavo, el archivo entra marcado **NO
CONFIABLE** y no alimenta ningún reporte. Es preferible pedir otro archivo que
conciliar contra cifras inventadas.

**Dos trampas reales que ya mordieron y tienen prueba:**

- **La librería de Excel lee las fechas a la americana.** `"12/08/2026"` lo
  convierte en **8 de diciembre**, no en 12 de agosto, y sin avisar — un estado
  de agosto acabaría fechado en diciembre. Por eso un **CSV se lee como texto**
  (`leerCsvCrudo`), nunca por XLSX. En un `.xlsx` no hay riesgo: ahí la fecha es
  un número serial sin ambigüedad, y `aFecha` lo convierte.
- **Un renglón que no se lee se cae en silencio.** Y si el saldo inicial se toma
  del primer renglón que sobrevivió, lo que queda **encadena perfecto** y el
  archivo parece bueno. Por eso `leerMovimientos` devuelve `{movimientos,
  descartadas}` y **cualquier descarte vuelve el archivo no confiable**.

**Conciliar** es la última pieza: cada movimiento del banco contra lo que ya está
capturado. Y ahí se cierra la pregunta que de verdad importa — no "¿cuáles tienen
factura?", que es la pregunta chica, sino que **ninguno se quede sin nombre**. Un
movimiento queda *explicado*, *explicado sin comprobante*, o **SIN EXPLICACIÓN**;
y "sin explicación" quiere decir que falta información, **no que falte dinero**.
Un gasto sin factura no es un problema a esconder: es un gasto no deducible que
hay que registrar como tal, porque lo grave no es que exista, es que nadie sepa
que existe.

Otras reglas: de la cuenta se guardan **sólo los últimos cuatro dígitos**; el
mismo estado (banco+cuenta+periodo) no se carga dos veces; **no se piden claves
del banco** ni se guarda ninguna; los movimientos del banco **no se editan ni se
borran** — el banco es la verdad; y la conciliación **propone con el criterio en
palabras** ("importe exacto + el nombre en el concepto + 3 días") y espera un sí,
porque dos pagos del mismo importe también cuadran perfecto.

## El horómetro y el diésel ya se capturaban

Los dos datos llevaban años guardándose y nadie los cruzaba: el horómetro se
tecleaba y ahí moría. `src/maquinaria.js` los junta, y `<AvisoHorometro>` lo enseña
debajo del campo, en la misma pantalla del tractorista.

Reglas que no se rompen ahí:
- **No acusa.** Dice "el tractor 3 en barbecho viene en 14.2 L/h; su promedio de
  las últimas 9 labores de barbecho es 10.8" y se calla. Nunca la palabra robo.
- **No bloquea.** La labor se guarda aunque el horómetro no cuadre. Si la app
  impide capturar, el gasto no desaparece: desaparece el registro.
- **No corrige la lectura mala.** La marca y la deja visible: el patrón de quién
  captura mal también es información.
- **No estima lo que no sabe.** Con menos de 3 labores no da promedio; con una
  lectura de hace más de 30 días dice "de esta máquina no sé sus horas".
- **No reparte un faltante de tanque entre las máquinas.** Cuadrar repartiendo es
  exactamente la forma en que se esconde un faltante.

## Nada de dinero se borra

Ingresos, egresos, préstamos, caja chica y créditos **no tienen botón de borrar**:
se **cancelan**, con motivo obligatorio y con quién. El registro se queda tachado
y visible, y deja de contar en los totales.

Por qué: en una familia donde nadie desconfía de nadie, borrar parece cómodo hasta
el día en que hay que reconstruir un mes y la mitad de los renglones ya no existe.
Un abono de $30,000 borrado "porque estaba mal capturado" y el proveedor que cobra
otra vez: sin el registro no hay forma de probar el primer pago.

Cómo está armado:
- `marcarCancelado`, `estaCancelado` y `vivos` en `calculos.js`.
- `cancelar(sec, id, etiqueta)` y `reactivar(sec, id)` en `AppInner`.
- `<BotonCancelar>` reemplaza al bote de basura; `<SelloCancelado>` es el renglón
  que explica quién, cuándo y por qué.
- **Toda suma de dinero pasa por `vivos(...)`.** Si agregas un total nuevo sobre
  ingresos, egresos, préstamos, caja chica o créditos y se te olvida, vas a estar
  contando dinero cancelado. Las LISTAS sí muestran lo cancelado, tachado; los
  TOTALES no lo cuentan.

El dinero se opera en centavos enteros (`sumarDinero`, `multiplicarDinero`,
`repartirDinero`), y `repartirDinero` le da el sobrante a la última parte para que
la suma cuadre exacta. `fmt` enseña centavos sólo cuando los hay: así las pantallas
siguen limpias pero un descuadre de centavos se ve.

## El almacén: el vale no bloquea, y el conteo es a ciegas

- **La salida carga el COSTO PROMEDIO**, no el último precio. Urea a $580 en
  marzo y a $940 en agosto: salen 40 bultos y se cargan a $868, que es el
  promedio de lo que de verdad hay. Si el insumo no tiene costo, la salida se
  registra igual pero **no le carga nada al destino** y lo dice — un costo
  inventado se arrastra a todas las parcelas del año.
- **El vale NUNCA bloquea.** Almacén a las seis de la mañana, la camioneta
  esperando: el producto ya salió, y negar el registro no lo devuelve al
  estante — sólo logra que nadie capture y que el sistema se vuelva mentira. Se
  avisa y se guarda.
- **El saldo SÍ puede quedar en negativo.** `setInv` ya no lo recorta en cero:
  recortarlo es la misma trampa que prorratear un faltante para que cuadre —
  hace que los libros se vean bien y borra el dato que servía. Un −30 dice algo
  concreto: o entró mercancía que nadie capturó, o salió más de lo anotado.
- **Una merma sin causa no se registra.** "No se sabe" es una causa válida y
  honesta —y se cuenta aparte, porque es la que hay que bajar—; dejarlo en
  blanco no lo es.
- **El conteo es A CIEGAS**: la pantalla NO enseña el saldo del sistema hasta
  después de capturar lo contado. Un conteo en que el capturista ve el número
  de la pantalla no es un conteo, es una copia. Y el saldo **no se ajusta
  solo**: la diferencia se vuelve un ajuste, y el ajuste lleva causa.

## La bitácora es de sólo inserción

`auditoria` **no tiene política de update ni de delete** en Supabase. Sin
política, Postgres las niega: nadie —tampoco el admin— puede modificarla ni
borrarla. Una auditoría que se puede editar no es una auditoría, es una
sugerencia.

Ahí se anota quién canceló, reactivó o borró qué, con el motivo y con una copia
de lo que decía el registro (sin la foto, que ya vive en el registro mismo). Se
escribe con `anotarEnBitacora`, y se ve en la pantalla **Bitácora** — porque una
bitácora que nadie puede leer tampoco sirve.

Y el SQL 22 **quita el permiso de borrado** en las tablas de dinero (ingresos,
egresos, préstamos, caja chica, créditos, estados de cuenta). La app ya no las
borraba, pero eso sólo tapaba la puerta de la app; ésta cierra la de abajo. Las
demás tablas se dejan como estaban a propósito: borrar un catálogo mal capturado
es normal y no esconde nada.

## Pendiente
- **Lectura con IA**: la función `leer-papel` ya está instalada y cerrada a
  quien no tiene perfil, pero sin llave de IA (es un gasto: lo autoriza Luis).
  Mientras, contesta "no está configurada" y la app ofrece capturar a mano.
- **Salidas del almacén con el costo promedio**: la ENTRADA ya mueve el costo
  promedio ponderado (`costoPromedio`) — urea a $580 en marzo más 40 bultos a
  $940 en agosto quedan en 50 a $868, que es la respuesta a "¿cargó $23,200 o
  $37,600?". Falta que las SALIDAS a parcela carguen ese promedio, y las mermas
  con nombre.
- **Reentrada y carencia ya avisan** (`ventanasDeSeguridad`): alerta roja de "no
  entrar", ámbar de "no cortar", y una tercera, azul y **aparte**, para los
  productos sin etiqueta capturada — "no sé" no es una alarma de peligro, es una
  de dato faltante, y confundirlas enseña a ignorar las dos. En el inventario se
  ve producto por producto. **Es seguridad de personas, no un dato más**, y por
  eso un producto sin reentrada capturada NUNCA dice "ya se puede entrar".
  Lo que falta: que el aviso llegue también al trabajador antes de mandarlo, no
  sólo al admin en el tablero.

**Y una regla de esa parte:** un papel se aplica **UNA sola vez**. La marca vive en
el propio registro (`lectura.aplicado`), no en una lista aparte, para que no haya
forma de que se desincronicen. Dos aplicaciones del mismo ticket duplican el gasto,
y un gasto duplicado se descubre tarde y mal.
- Lo que sigue después está en `ARRANQUE-CLAUDE.md` (sección 9) y en
  `LO-QUE-FALTA-CONSTRUIR.md`: titulares y bolsas, lectura de estados de cuenta,
  cuenta corriente entre socios, el ganado.

## Arranque limpio: lo de antes no entra

AgroGestión nunca operó de verdad; lo guardado en la base anterior y en los
teléfonos son pruebas. La operación arranca SIN registros de antes
(`docs/ARRANQUE-LIMPIO.md`). Reglas que no se rompen:

- **Dos candados.** En la app, el cajón por espacio (`src/espacio.js`). En la
  base, la hoja 31: rechaza todo registro que no traiga la marca `_espacio` de
  su espacio, aunque quien lo suba tenga permiso. `marcarTocado` pone la marca.
- **`INITIAL` va vacío.** Nada de fábrica: ni rancho, ni parcelas, ni gente.
- **Sólo catálogos validados** entran de antes, por `herramientas/catalogos.mjs`
  (hoja de Excel → sí/no de Luis y Migue → carga con autorización). Sin PIN, sin
  existencias, sin costos, con id nuevo. Nunca un movimiento.
- **Un respaldo de antes no se restaura** (`revisarRespaldo`). Lo de antes sólo
  se puede descargar.
- Inventario inicial = conteo físico con fecha, lugar y responsable. Saldos
  iniciales = fecha de corte, responsable y evidencia. La fecha de inicio se
  declara una vez (`declarar_inicio`). Las reglas están en `src/arranque.js`.
- **Los datos de prueba no tocan producción**, y una vista previa nunca lleva
  las llaves del proyecto de producción.
- `respaldos/` no se sube al repositorio: trae nombres de personas.

## Infraestructura propia y plan gratuito

**Dónde vive (desde el 19 nov 2026):** Supabase, organización "AgroGestion",
proyecto `cidgbfddrzoilvkqhszg` — es PRODUCCIÓN y es el único: no hay proyecto
de pruebas. Vercel, proyecto `agrogestion-operacion` →
https://agrogestion-operacion.vercel.app, publicado desde `produccion/base-vigente`
(el proyecto de Vercel "agrogestion" y app.agroselectos.com son lo viejo: no se
tocan sin que Luis lo diga). Reglas de ahí:

- **Nunca dejes datos de prueba en el proyecto real.** Para probar con sesión,
  un bloque `do $$ … raise exception … $$` que se deshace solo; para pantallas,
  la nube de mentira de `pruebas/*_navegador.py`.
- Una hoja nueva se instala con `apply_migration` y va también a
  `supabase/orden.json`. Después: `get_advisors` y `pruebas/real_sin_sesion.py`.
- Las cuentas se dan de alta desde la app (hoja 32: invitación por correo; el
  código de arranque es de un solo uso y sólo para el primer superadministrador). Nunca crees cuentas por SQL ni manejes contraseñas de nadie.
- La pantalla **Arranque** (Admin) lleva cuentas, conteo inicial, saldos
  iniciales y la fecha de inicio.

AgroGestión vive en su propio proyecto de Supabase (plan gratuito: 500 MB de
base, 1 GB de archivos), separado de ATALAYA y del despacho. `docs/RUTA.md` es
el plan y el estado. La base se arma desde cero con `supabase/orden.json`.

- **Una foto o un PDF nunca va dentro de un registro.** `add`/`upd` los sacan
  solos (`sacarArchivos`), los guardan en el teléfono (IndexedDB) y suben al
  almacén privado `comprobantes`; el registro lleva `archivo:<huella>.jpg`.
  Para enseñarla, `<Foto src=…/>` — **nunca `<img>` con un campo guardado**.
  Para mandarla a leer, `contenidoDeArchivo()`.
- **Borrar deja lápida** (`borrar_registro`, hoja 30). No hay borrado directo en
  ninguna tabla. La mezcla con la nube vive en `src/sincroniza.js`.
- **La gente de campo sube por la cuenta de su encargado** (teléfono ligado,
  `LLAVES.campo`). Nunca una cuenta técnica compartida, y nunca se liga la
  cuenta de un superadministrador.
- **La IA se llama una vez por documento** (por huella) y con tope mensual
  (`limites`, `uso_ia`). `uso_ia` sólo la escribe la función del servidor.
- **El medidor** (`consumo()`, `estadoDeConsumo`) nunca dice "bien" si no pudo
  medir.
- `sh pruebas/todo.sh` corre todo. `src/nombres.test.js` revisa que ningún
  nombre se use sin importar: la compilación no lo detecta y ya tronó dos veces.
- Si agregas una tabla: además de lo de siempre, va en `supabase/orden.json` y
  con sus renglones en `permisos_rol`.

## Permisos: la pantalla no es la puerta

Lo que una pantalla esconde no está protegido: cualquiera con la llave pública
puede llamar directo a la base. Los permisos de verdad viven en
`supabase/24-permisos-por-rol.sql` (tabla `permisos_rol` + `puede()`), y se
prueban atacando una base aislada: `npm run test:base`. Reglas que no se rompen:
nadie se da perfil ni se asciende solo; el dinero no se borra y la bitácora no
se toca **ni siendo superadministrador**; nunca queda el rancho sin
superadministrador. Si agregas una tabla, agrégale sus renglones en
`permisos_rol` — lo que no está ahí, está negado. `pruebas/recorrido_navegador.py`
abre todas las pantallas de todos los roles (corre contra `npx vite`).
No se congelan sueldos viejos con el valor de hoy: `sueldoVigente` dice de dónde
salió cada sueldo y marca lo estimado.

## Secretos

Nunca pongas credenciales en el código ni las pidas por chat. El cliente sólo lee
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, públicas por diseño. **Toda variable
`VITE_*` acaba en el JavaScript público**: jamás una contraseña ahí
(`src/secretos.test.js` lo vigila). Tampoco datos personales en `INITIAL`.

## Estado real y por dónde seguir

`docs/TABLERO.md` es la fuente de verdad del avance. Antes de cambiar acceso,
sesión o sincronización lee `docs/auditoria/02-CONTENCION-P0.md`. Las reglas de
quién entra viven en `src/acceso.js` (puro, probado). Nada se publica sin
autorización de Luis. Luis y Migue son superadministradores con cuenta propia.
