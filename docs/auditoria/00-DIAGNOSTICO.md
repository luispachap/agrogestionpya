# AgroGestión P&A — Diagnóstico técnico y plan de ejecución (Fase 1)

Fecha: 18 de noviembre de 2026 · Rama: `produccion/fase-1-auditoria` · Autor: Claude

> **Corrección (18 nov, más tarde):** la sección 0 y la base de este diagnóstico quedaron superadas. La versión más completa es la publicada, no la «recuperada». Ver `03-VERSIONES.md` y `../TABLERO.md`.

**Veredicto: AgroGestión no puede usarse hoy para operar el rancho.** No es un tema
de pantallas (hay 65 y la mayoría responde), sino de cimientos: los datos se pierden
o se pisan entre teléfonos, cualquiera puede entrar como administrador, y la base de
datos central está apagada. Todo tiene arreglo sin reescribir la app.

Cada hallazgo marcado «confirmado» se reproduce con
`node docs/auditoria/evidencia/reproducir.mjs` (14/14 al cierre de este documento).
Lo que no pude comprobar lo digo expresamente.

---

## 0. Lo primero: hay tres versiones distintas de la app

| Dónde | Qué contiene | Fecha |
|---|---|---|
| Este repositorio (`agrogestionpya`, rama `main`) | Versión vieja: 7,921 líneas, sin nube, sin corrida de ajo, sin trazabilidad | 22 may 2026 |
| Lo publicado en app.agroselectos.com | Sale de **otro** repositorio, `luispachap/vitejs-vite-3ymxjehp` (proyecto de Vercel del mismo nombre) | 8 sep 2026 |
| La versión más reciente trabajada (iconos locales, login nuevo) | 14,759 líneas. No estaba en ningún repositorio; solo en archivos sueltos | sep 2026 |

Decisión tomada: esta rama parte de la **versión más reciente**, para no perder nada
(regla 2). `main` no se tocó. Consecuencia: los archivos `supabase.js`, `sw.js` e
`index.html` de esta rama fueron reconstruidos en su momento y **no son idénticos** a
los que están publicados; antes de publicar hay que compararlos contra el repositorio
`vitejs-vite-3ymxjehp`, al que no tengo acceso en esta sesión (pregunta H-1).

## C. Riesgos que impiden usar el sistema hoy

| # | Riesgo | Evidencia |
|---|---|---|
| C-0 | **La base de datos central está apagada.** El proyecto de Supabase «AgroGestion» está en estado `INACTIVE` (pausado por inactividad). Hoy la app publicada guarda solo en cada teléfono. | Consulta al panel de Supabase, 18 nov. No la reactivé: es decisión de infraestructura. Por lo mismo **no pude verificar** las reglas de seguridad reales de la base; las evalué desde los scripts `supabase/*.sql`. |
| C-1 | **Cualquiera entra como administrador.** Los PIN de fábrica (admin, dirección, finanzas) están escritos en el código público y funcionan en cualquier teléfono que no haya bajado la configuración de la nube — hoy, todos. | E7. Abrir la app en modo incógnito → rol Admin → PIN de fábrica. |
| C-2 | **La cuenta técnica habría quedado pública.** Vercel tiene configuradas `VITE_SUPABASE_APP_EMAIL` y `VITE_SUPABASE_APP_PASSWORD`. Toda variable `VITE_` se copia al JavaScript que descarga cualquier visitante. Revisé el archivo publicado: hoy **no** contiene la contraseña, pero el código de esta rama la habría incrustado al publicarse. | Corregido en esta rama (`src/supabase.js`). Pendiente de Luis: borrar esas dos variables en Vercel y cambiar esa contraseña (H-2). |
| C-3 | **La sesión se puede falsificar.** El rol se guarda en el almacenamiento del navegador. Para roles de campo se acepta tal cual; para roles con dinero basta agregar `cuenta:true` si el teléfono tiene cualquier sesión abierta. | E8, E9. |
| C-4 | **Los permisos solo existen en la pantalla.** En la base, toda cuenta válida puede leer, cambiar y borrar las 40 tablas (política única `tiene_perfil()`). Un agrónomo puede borrar la nómina desde el navegador. Además los PIN de trabajadores viajan en texto claro a todos los teléfonos y el PIN de dirección se recupera en milisegundos. | `supabase/2-seguridad.sql`; `dataApi.js` (columna `pin`); E6 (13 ms). |
| C-5 | **Quien entra con PIN no sube nada a la nube.** El inicio de la cuenta técnica nunca se ejecuta. Los registros se quedan en el teléfono, la app lo reintenta 5 veces y los aparta. Esto explica el «sale sincronizando pero no se sincroniza». | E11. |
| C-6 | **Se pierden y se pisan datos al sincronizar.** (a) Una edición hecha sin señal es reemplazada por la versión vieja de la nube. (b) Lo borrado en un teléfono revive en los demás. (c) La «orden de recarga» borra lo que aún no se subía. (d) Si el almacenamiento del teléfono se llena, se deja de guardar sin avisar. | E1, E2, E12, E10. |
| C-7 | **Nunca se ha probado con una operación real.** El respaldo más reciente que existe (27 may) tiene 9 actividades y 2 asistencias. Ningún módulo ha visto una semana real del rancho. | `respaldo-agroselectos-2026-05-27.json`. |

## B. Hallazgos técnicos por severidad

**Críticos** — C-0 a C-6 (arriba).

**Altos**

| # | Hallazgo | Evidencia |
|---|---|---|
| A-1 | Alta de externos sin control: escribir cualquier nombre crea un trabajador externo con sueldo de $683 y le da acceso. | `LoginScreen`, rama `externo`. |
| A-2 | Toda la base vive en una sola entrada de `localStorage` (límite ≈5 MB por teléfono) y se reescribe completa en cada cambio. Con una temporada real se llena y se vuelve lenta. | `useLS("agro_v7")`; E10. |
| A-3 | No hay «exactamente una vez»: si una subida falla a medias se reintenta sin identificador de operación; los saldos (inventario, estibas, producto terminado) se guardan como número final, así que dos teléfonos se pisan. | `setInv`, `crearEstiba`, `guardarRegistro`. |
| A-4 | Inventario, estibas y terminados sin bitácora de movimientos confiable: el saldo es un número editable, no la suma de entradas y salidas. | `AdminInventario`, `Estibas`. |
| A-5 | Costos de mano de obra frágiles: 1 hora capturada carga el día completo; cambiar un sueldo reescribe el pasado; borrar a un trabajador (un toque, sin confirmar) borra su costo histórico. | E3, E4, E5, E13. |
| A-6 | La asistencia es una casilla presente/falta que cualquiera con acceso cambia sin dejar rastro. No sirve como registro de jornada. | `PaseLista.togglePresente`. |
| A-7 | Restaurar un respaldo reemplaza todo en el teléfono sin subirlo; el «reinicio» vacía tablas en la nube con una palabra escrita como única protección. No hay respaldos automáticos. | `RespaldoDatos`. |
| A-8 | Sin bitácora auditable: ningún registro guarda quién lo modificó ni su valor anterior. | 0 apariciones de campos de auditoría. |

**Medios**

| # | Hallazgo |
|---|---|
| M-1 | Un archivo de 14,759 líneas con 73 componentes y el estado global pasado a mano. Sin pruebas, sin revisión automática de código, sin integración continua. |
| M-2 | Dependencias: `xlsx 0.18.5` con 2 vulnerabilidades altas sin parche en npm (hay que tomarla del sitio del autor o cambiar de librería); `vite`/`postcss`/`nanoid` con avisos que se corrigen con `npm audit fix`. 8 avisos en total. |
| M-3 | La nómina paga por días con actividad capturada, no por días asistidos: quien asistió y no capturó actividad no cobra en el cálculo. |
| M-4 | Códigos de estiba con 3 caracteres al azar (29,791 combinaciones por mes y fase): pueden repetirse. Identificadores basados en la hora del teléfono. |
| M-5 | La plantilla de Excel para dar de alta cuentas trae una contraseña de ejemplo; si se usó tal cual, hay cuentas con contraseña conocida. No pude verificarlo con la base apagada. |
| M-6 | El asistente de IA no funciona fuera del prototipo (no tiene credencial) y, de funcionar, mandaría ingresos y utilidades a un servicio externo. |
| M-7 | **El repositorio de GitHub es público** y el código incluye nombre completo, sueldo y PIN de 11 trabajadores reales (desde mayo, en `main`). Sube a severidad alta por tratarse de datos personales y laborales. |
| M-8 | El modo sin conexión guarda en caché cualquier respuesta, incluidas las de la base, y nunca limpia versiones viejas. |
| M-9 | Fechas: la hora del servidor es UTC y varias comparaciones usan la del teléfono; un reloj mal puesto altera el orden de los registros. |

## A. Inventario funcional

65 pantallas y flujos, 39 colecciones de datos, 8 roles. «Val.» = número de validaciones
visibles en el código. **Solo las filas con estado distinto de «Pendiente» fueron
examinadas línea por línea**; las demás están inventariadas (qué leen, qué escriben,
quién las ve) pero no las doy por buenas (regla 1). Examinarlas es la primera tarea de
la Etapa 1.

| Pantalla | Qué pretende | Roles | Escribe en | Val. | Estado real | Hallazgos |
|---|---|---|---|---|---|---|
| AppInner | Núcleo: sesión, sincronización, guardado | interno | solo lectura | 0 | ROTA (pérdida de datos) | C-5, C-6, A-2, A-3 |
| LoginScreen | Entrada por rol con PIN o correo | interno | config_seguridad, externos | 16 | ROTA (seguridad) | C-1, C-3, C-4, A-1 |
| AprobacionExternos | — | Admin, Encargado | actividades | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| AdminHome | — | Admin | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| AdminParcelas | — | Admin | parcelas, ranchos | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| AdminInventario | Insumos, existencias, entradas | Admin | entradas_inv, entradas_inv*, inventario, inventario* | 0 | INCOMPLETA: existencia es un número que se sobrescribe; sin bodegas | A-4 |
| AdminEquipo | Altas/bajas de trabajadores, cuadrillas, maquinaria | Admin | bonificaciones, cuadrillas, encargados, externos, incidencias, maquinaria, trabajadores | 1 | PELIGROSA: borrar trabajador sin confirmar y borra su costo histórico | A-5 |
| TrabReg | Registro diario del trabajador | Trab | actividades, entradas_inv*, inventario* | 0 | FUNCIONA EN LOCAL; no sube a la nube si entró con PIN | C-5 |
| TrabHistorial | — | Admin, Trab | tareas | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| TrabReporte | — | Admin, Agronomo, Cuad, Externo, Trab | incidencias | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| CuadrillaReg | Registro de cuadrilla | Cuad | actividades, entradas_inv*, inventario* | 0 | FUNCIONA EN LOCAL; no sube a la nube si entró con PIN | C-5 |
| CuadHistorial | — | Cuad | tareas | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| AiPanel | Asistente de IA sobre los datos del rancho | interno | solo lectura | 0 | ROTA: no tiene credencial; además enviaría finanzas a un tercero | M-6 |
| AdminReportes | — | Admin, Dueno | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| AdminContabilidad | — | Admin, Finanzas | compras, egresos, entradas_inv*, ingresos, inventario* | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| ExternoReg | Registro de externos | Externo | actividades, entradas_inv*, inventario* | 0 | INSEGURA: cualquiera escribe un nombre y queda dado de alta con sueldo | A-1 |
| ExternoHistorial | — | Externo | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| TrabCompras | — | Admin, Cuad, Trab | compras | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| AdminMovimientos | — | Admin | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| MovimientoDetalle | — | interno | cosechas | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| EncargadoHome | — | Encargado | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| EncargadoTareas | — | Admin, Encargado | incidencias, tareas | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| EncargadoPersonal | — | Admin, Encargado | cuadrillas, prestamos | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| EncargadoCaja | — | Admin, Encargado | cajachica, egresos | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| AdminProveedores | — | Admin | creditos, proveedores | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| CreditoDetalle | — | interno | creditos, ingresos | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| RegistroActividadAdmin | — | Admin, Encargado | actividades, entradas_inv*, inventario* | 3 | Pendiente de examen a fondo (solo inventariada) | — |
| GestionCosechas | — | Admin, Encargado | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| CosechaDetalle | — | interno | cosechas, envios_bodega, inventario | 10 | Pendiente de examen a fondo (solo inventariada) | — |
| GestionCiclos | — | Admin | ciclos | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| ResumenSemanal | — | Admin, Dueno | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| CalendarioCultivos | — | Admin | parcelas, siembras | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| PanelParcelas | — | Admin, Agronomo, Dueno | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| RespaldoDatos | Descargar/restaurar respaldo, reinicio de datos | Admin | solo lectura | 0 | PELIGROSA: restaurar reemplaza todo sin subir a la nube; reinicio borra tablas en la nube | A-7 |
| RegistroMasivo | — | Admin, Encargado | actividades | 4 | Pendiente de examen a fondo (solo inventariada) | — |
| AgronomoHome | — | Agronomo | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| GestionAplicaciones | Bitácora de aplicaciones con ficha del producto | Admin, Agronomo | aplicaciones, egresos, entradas_inv*, inventario* | 4 | FUNCIONA EN LOCAL; sin control de sobrantes | A-4 |
| AgronomoIndicaciones | — | Admin, Agronomo | tareas | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| AgronomoCompras | — | Admin, Agronomo | egresos, entradas_inv, inventario | 4 | Pendiente de examen a fondo (solo inventariada) | — |
| PanelFinanciero | — | Admin, Dueno | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| DuenoHome | — | Dueno | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| FinanzasHome | — | Finanzas | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| ProyeccionSemanal | — | Admin, Finanzas | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| GestionDeudas | — | Admin, Finanzas | creditos | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| SubirCatalogos | Carga de catálogos por Excel y alta de cuentas | Admin | solo lectura | 3 | SIN PROBAR con catálogos reales; plantilla trae contraseña de ejemplo | M-5 |
| CompletarIndicacionModal | — | interno | solo lectura | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| SolicitudesCompra | — | Admin, Agronomo, Encargado, Finanzas, Trab | solicitudes_compra | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| ConfirmarCompraModal | — | interno | solo lectura | 3 | Pendiente de examen a fondo (solo inventariada) | — |
| BitacoraParcela | — | interno | bitacora | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| ReportarAvanceModal | — | interno | avances_fase | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| PanelOperacion | — | Admin, Agronomo, Dueno, Encargado, Finanzas | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| AdminMasFunciones | — | Admin | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| GestionVariedades | — | Admin, Agronomo | cultivos | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| ReporteVariedades | — | Admin, Agronomo | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| ExportarContPAQi | Pólizas para CONTPAQi | Admin, Finanzas | config_contpaqi | 2 | SIN PROBAR contra CONTPAQi real | — |
| EmbarqueAjo | Embarques y remisión de venta | Admin, Finanzas | embarques, estibas | 3 | SIN PROBAR con un embarque real | A-4 |
| InventarioTerminado | — | Admin, Finanzas | creditos, embarques, ingresos | 1 | Pendiente de examen a fondo (solo inventariada) | — |
| Consignaciones | — | Admin, Finanzas | solo lectura | 2 | Pendiente de examen a fondo (solo inventariada) | — |
| CorridaAjo | Corrida de ajo en vivo, calidad, aparte, administrar | Admin, Encargado, Finanzas | control_corrida, corridas, estibas, inventario | 8 | INCOMPLETA: lógica probada con números, nunca con una corrida real; el monitoreo en vivo vive en memoria | A-4 |
| Estibas | Trazabilidad por estiba (barbecho→calibre) | Admin, Encargado, Finanzas | estibas | 8 | INCOMPLETA: saldos se pisan entre teléfonos; códigos al azar pueden repetirse | A-4, M-4 |
| NominaSemanal | Nómina semanal con retención y préstamos | Admin, Finanzas | prestamos | 1 | INCOMPLETA: paga por días con actividad capturada, no por asistencia | A-5, M-3 |
| PaseLista | Pase de lista semanal y captura de faltantes | Admin, Encargado, Finanzas, Trab | actividades, asistencia | 3 | INCOMPLETA: marca presente/falta, sin hora de entrada/salida ni rastro de cambios | A-6 |
| ReporteComercializacion | — | Admin, Finanzas | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| RendimientoParcelas | — | Admin, Agronomo, Finanzas | solo lectura | 0 | Pendiente de examen a fondo (solo inventariada) | — |
| PanelSeguridad | PINs de dirección y orden de recarga remota | Admin | config_seguridad | 0 | ROTA (seguridad) | C-4, C-6 |
Cálculos identificados: costo de mano de obra, costo por actividad, reporte por parcela
/ cultivo / siembra / temporada, flujo de efectivo, saldo de créditos, proyección
semanal, nómina, rendimiento por hectárea, ritmo y proporción de la corrida, reparto
en revoltura, importe con letra. Solo los de la corrida, el reparto y el importe con
letra tienen pruebas con números; ninguno tiene prueba automática.

## D. Arquitectura objetivo

**Recomendación: modernización progresiva sobre lo que ya hay (React + Supabase +
Vercel). No reescribir.** La lógica de negocio (corrida, trazabilidad, costos) es lo
valioso y está en funciones separables; lo roto es la capa de identidad, guardado y
sincronización, que es reemplazable por debajo sin tocar las pantallas.

| Necesidad | Hoy | Objetivo |
|---|---|---|
| Identidad | PIN comparado en el teléfono | Una cuenta por persona en Supabase. Dirección y encargados: correo + contraseña. Trabajadores: PIN validado **en el servidor** (función de base), con bloqueo por intentos. |
| Permisos | Solo en pantalla | Reglas por rol en la base (lectura y escritura por tabla); el teléfono nunca decide. |
| Guardado local | Una entrada de 5 MB | IndexedDB: una tabla por colección + bandeja de salida. |
| Sincronización | Sobrescribir fila completa | Bandeja de salida con identificador único por operación (el servidor ignora repetidos = exactamente una vez); descarga incremental por fecha; borrado lógico (marca, no desaparece). |
| Saldos | Número editable | Movimientos que se suman (inventario, estibas, terminados): dos teléfonos nunca se pisan. |
| Auditoría | No hay | Tabla de bitácora llenada por la base en cada cambio: quién, cuándo, antes y después. |
| Respaldos | Manual | Respaldo diario automático + prueba de restauración mensual documentada. |
| Código | Un archivo | Módulos por dominio extraídos de uno en uno, con pruebas antes de mover. |

Alternativas evaluadas: **(1) Reescribir desde cero** — descartada: meses sin sistema,
se vuelve a arriesgar la lógica ya afinada con Migue, y no resuelve nada que la
modernización no resuelva. **(2) Firebase** — sincronización sin conexión de fábrica,
pero obliga a migrar base y permisos y complica los reportes contables y la integración
con ATALAYA (que conviene en SQL). **(3) Motor de sincronización de terceros
(PowerSync/ElectricSQL)** — resuelve la sincronización, pero agrega un servicio de pago
y una dependencia más; se reconsidera solo si la bandeja de salida propia no pasa las
pruebas de la Etapa 2.

## E. Plan de intervención por etapas

| Etapa | Qué se hace | Depende de | Criterio para darla por terminada |
|---|---|---|---|
| 0. Ordenar la casa | Un solo repositorio fuente; reactivar la base; quitar variables peligrosas; respaldo inicial | H-1, H-2, H-3 | La app publicada sale de este repositorio y la base responde |
| 1. Red de seguridad | Pruebas automáticas de los cálculos; terminar el examen de las pantallas «Pendiente»; revisión automática en cada cambio | 0 | Cada cálculo económico tiene prueba; inventario sin filas «Pendiente» |
| 2. Cimientos de datos | IndexedDB, bandeja de salida, borrado lógico, movimientos para saldos | 1 | Pasan las pruebas de corte de señal y duplicados (matriz F) |
| 3. Identidad y permisos | Cuentas por persona, PIN en servidor, reglas por rol, bitácora | 0, 2 | Ninguna de las pruebas de ataque E6–E9 se reproduce |
| 4. Registro de jornada 2027 | Checador (entrada/salida), correcciones sin borrar el original, exportación | 2, 3 | Ver sección «Jornada» |
| 5-bis. Incorporación Inteligente | Bandeja de documentos, lectura y propuesta con niveles A/B/C. Primero la prueba vertical del ticket. Diseño en `01-INCORPORACION-INTELIGENTE.md` | 0, 2, 3 | La prueba vertical cumple sus metas con el lote sintético |
| 5. Módulos de la junta | Bodegas y sobrantes, bitácora por turnos, expediente legal | 2, 3 | Validados con Migue y Fito en campo |
| 6. Tablero de Migue | Inicio que responde las 8 preguntas de la Fase 3 | 1–5 | Migue las contesta en menos de un minuto |
| 7. Operación paralela | 4 semanas junto al Excel y papel actuales | todo | Coincidencia total con los controles manuales |

La partición del archivo grande se hace dentro de las etapas 1–3, un dominio a la vez
(primero cálculos puros, luego datos, al final pantallas), compilando y probando en
cada paso.

### Registro electrónico de jornada (Fase 4): qué es ley y qué no

- **Publicado (DOF, 1 may 2026):** art. 132 fracc. XXXIV LFT — registro electrónico de la jornada de cada trabajador con hora de inicio y de término, disponible para la autoridad; multa de 250 a 5,000 UMA (art. 994 IV Bis); exigible desde el **1 de enero de 2027**. Puede hacer prueba plena si fue acordado entre las partes.
- **Pendiente:** las disposiciones generales de la STPS (a quién aplica, excepciones, requisitos técnicos). Al 10 de noviembre de 2026 **no se habían publicado**. La «adopción gradual por tamaño de empresa» es una declaración de un funcionario, no una regla. Confirmé esto en fuentes secundarias, no directamente en el DOF: hay que verificarlo ahí antes de cerrar el diseño.
- **No exigido por la ley:** GPS, huella, reconocimiento facial.
- **Diseño:** eventos que solo se agregan (entrada, salida, descanso) con quién los capturó y en qué teléfono; las correcciones son eventos nuevos con motivo, nunca se edita el original; reglas de turno y tolerancias en configuración, no en código, para absorber lo que publique la STPS. Asistencia, horas trabajadas, productividad y pago se calculan por separado a partir de esos eventos.

### Integración con ATALAYA (Fase 5): quién es dueño de cada dato

| Dato | Dueño | Dirección |
|---|---|---|
| Trabajadores (identidad fiscal, alta IMSS, sueldo contractual) | ATALAYA | → AgroGestión |
| Jornadas, incidencias, actividades, costos de mano de obra por parcela | AgroGestión | → ATALAYA |
| Propuesta de nómina | AgroGestión propone, ATALAYA calcula y timbra | → ATALAYA |
| Compras y gastos (operativo) / pólizas y CFDI (fiscal) | AgroGestión / ATALAYA | → ATALAYA |
| Parcelas, cultivos, centros de costo | AgroGestión (catálogo), ATALAYA (clave contable) | ambos, con tabla de equivalencias |
| Inventarios | AgroGestión (existencias), ATALAYA (valuación) | → ATALAYA |

No diseñé contratos detallados: no he visto el repositorio de ATALAYA (H-6). Regla
fija desde ahora: cada registro lleva identificador estable y fecha de cambio, y el
intercambio es por lotes repetibles sin duplicar.

## F. Matriz de pruebas y criterios de aceptación

| # | Escenario | Se acepta si |
|---|---|---|
| 1 | Reglas de negocio: costo por parcela, nómina, ritmo de corrida, reparto, importe con letra | Resultado igual al cálculo manual de Migue en 10 casos reales por regla |
| 2 | Integración: actividad con insumo descuenta inventario y aparece en el costo | Un solo movimiento, mismo importe en los tres lugares |
| 3 | Permisos: cada rol intenta leer y escribir cada tabla directo contra la base | Solo pasa lo que su rol permite; E6–E9 dejan de reproducirse |
| 4 | Persistencia: capturar, cerrar la app a la fuerza, reabrir | Ningún registro perdido en 50 repeticiones |
| 5 | Señal intermitente: una cuadrilla registra sin internet, se corta la app a media subida, vuelve la señal | El registro queda en la nube **exactamente una vez** y el costo no se duplica |
| 6 | Dos teléfonos sin señal descuentan del mismo insumo | El saldo final es la suma correcta de ambos |
| 7 | Edición sin señal de un registro que otro teléfono también cambió | No se pierde ninguna de las dos; el conflicto queda visible |
| 8 | Flujo completo por rol (8 roles) en un celular de gama baja | Sin errores; cada pantalla abre en menos de 2 s con una temporada de datos |
| 9 | Jornada: entrada sin señal, corrección posterior | El evento original se conserva; la exportación muestra ambos |
| 10 | Respaldo y restauración | La base restaurada coincide registro por registro con el respaldo |

## G. Infraestructura y costo mensual

| Concepto | Hoy | Para operar | Por qué |
|---|---|---|---|
| Base de datos (Supabase) | Gratis — **se pausa sola por inactividad y no trae respaldos** | Plan Pro, ≈ US$25/mes | Respaldos diarios y no se apaga. Es el único gasto que considero indispensable. |
| Publicación (Vercel) | Gratis | Gratis mientras alcance; el plan gratuito es para uso no comercial, el Pro ronda US$20/mes | Decisión de Luis (H-4) |
| Dominio | Ya pagado | Igual | — |
| Sincronización de terceros | — | US$0 (se construye) | Solo si falla la Etapa 2 |

Total esperado: **≈ US$25/mes** (hasta ≈ US$45 con Vercel Pro). Precios de memoria:
confirmar en las páginas de cada servicio antes de contratar.

## H. Decisiones que necesito de ti

0. **Hacer privado el repositorio hoy** (GitHub → Settings → Danger Zone → Change visibility). Es público y contiene datos personales de los trabajadores y este mismo diagnóstico.
1. **¿Cuál es el repositorio fuente?** Lo publicado sale de `vitejs-vite-3ymxjehp`. Propongo que `agrogestionpya` sea el único y Vercel apunte aquí. Necesito acceso a aquel para comparar archivos antes.
2. **Borrar en Vercel** `VITE_SUPABASE_APP_EMAIL` y `VITE_SUPABASE_APP_PASSWORD` y cambiar la contraseña de esa cuenta.
3. **Reactivar la base y pasar a plan de pago** (≈ US$25/mes). Sin esto no hay etapa 0.
4. **Vercel:** ¿seguimos en el plan gratuito?
5. **Jornada:** ¿cada trabajador checa en su teléfono o el encargado checa a su cuadrilla? ¿Los eventuales y las cuadrillas con flete entran al registro?
6. **ATALAYA:** acceso a su repositorio para diseñar el intercambio.
7. **Reglas de costo:** ¿1 hora capturada debe costar el día completo? ¿El sueldo que cuenta es el vigente el día trabajado? (hoy no).
8. **Nómina:** ¿se paga por asistencia o por actividad capturada?
9. **Asistente de IA:** ¿se retira, o se rehace con una credencial protegida y aceptando que los datos salen a un tercero?

## Qué se cambió en esta rama

Solo correcciones seguras y reversibles: (1) se incorporó la versión más reciente como
base; (2) se desactivó la cuenta técnica en `src/supabase.js` para que ninguna
contraseña pueda terminar en el archivo público; (3) se corrigieron `.env.example` y
`CLAUDE.md`; (4) se agregó este diagnóstico y su evidencia reproducible. Compila
(75 módulos). No se publicó nada, no se tocó `main`, no se tocó ningún dato real.

Fuentes de la sección de jornada: [IDC Online](https://idconline.mx/laboral/2026/07/10/asistencia-digital-requisitos-para-que-sea-prueba-plena) · [EY Law Flash](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-mx/technical/tax/documents/ey-law-flash-reduccion-jornada-laboral.pdf) · [Aurora Inbox, 10 nov 2026](https://www.aurorainbox.com/?p=39186)
