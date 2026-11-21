# Tablero de avance — AgroGestión P&A

Actualizado: 19 nov 2026 · Rama de trabajo: `produccion/base-vigente` · Rama de emergencia: `emergencia/p0-contencion`

**El plan y el estado de la infraestructura nueva están en `docs/RUTA.md`.** Este tablero lleva el detalle por asunto.

**Cómo leer las columnas.** *En rama* = el código está escrito y subido. *Probado* = hay una prueba automática (con datos de mentira).
*Desplegado* = está en app.agroselectos.com. *Validado* = se comprobó con la operación real del rancho.

**Hoy (19 nov):** la versión nueva está **instalada y abre** en https://agrogestion-operacion.vercel.app, conectada al proyecto nuevo de Supabase. **No está validada**: falta que Luis y Migue entren con sus cuentas y la usen en sus teléfonos. app.agroselectos.com sigue con la versión vieja, sin tocar.

En las tablas de abajo, "Desplegado: No" quiere decir "no en app.agroselectos.com". En el sitio nuevo está todo lo que dice "En rama: Sí".

## Operación integral (etapa abierta el 19 nov) — modelo y orden en `EVENTOS.md`

**ESTADO (19 nov, noche):** la hoja 37 (lo sensible lo autoriza la base) quedó INSTALADA en la base real y la app nueva PUBLICADA. Se repitieron contra la base real 10 ataques dentro de un bloque que se deshace solo (no quedó ningún dato): pago de un encargado → rechazado; sello escrito a mano → ignorado; darse permiso solo → negado; pago en cero → rechazado; cancelar un pago ajeno → no pasa y queda anotado; con el permiso de cerrar se cierra y NO se paga. Sin sesión, la base no entrega ni acepta nada de lo nuevo. **Falta la prueba con personas y cuentas reales** (un encargado con su teléfono) antes de usar pagos con dinero.

**ESTADO (19 nov, cierre del día):** hojas 38 y 39 INSTALADAS y la app PUBLICADA (commit `4e557d5`). Contra la base real, en un bloque que se deshace solo (quedaron 0 eventos, 0 préstamos, 1 perfil): un encargado SOLICITA un préstamo y pasa; autorizarlo, entregarlo, abonar, dar de baja o pagar una baja → rechazado; sello escrito a mano → ignorado; darse permiso solo y escribir en la tabla vieja de préstamos → negado; con sólo el permiso de autorizar préstamos autoriza (no en $0) y NO entrega ni abona; el superadministrador sí, y un importe negativo se rechaza. **Nada de esto se ha probado con personas reales.**

**Próxima entrega operativa:** bajas (partes proporcionales al terminar la relación de trabajo) y que dar un préstamo también pida permiso, si Luis lo decide. Antes de usar con dinero: validar en el rancho almacén, pagos, prestaciones y los permisos por cuenta.

| Asunto | En rama | Probado | Publicado | Validado en el rancho |
|---|---|---|---|---|
| Modelo de eventos: una operación, múltiples consecuencias | Sí | Sí (9 reglas + 9 ataques a la base; los candados también en la base real) | Sí | No |
| Credencial con QR por trabajador, imprimible; reemitir invalida la anterior | Sí | Sí | Sí | **Falta: imprimir y leer una de verdad** |
| Checador: entrada y salida con QR o PIN, sin repetir | Sí | Sí, con cámara simulada | Sí | **Falta: en la tableta de la nave, con fila de gente** |
| Llegada directa a campo, autorizada por encargado | Sí | Sí | Sí | Falta |
| Checar sin internet | Sí | Sí (simulado) | Sí | **Falta: en la nave sin señal y que suba después** |
| Jornada del día y correcciones con motivo (cancelar, cambiar hora, era salida, marca que faltó) | Sí | Sí | Sí | Falta |
| El pase de lista toma la presencia del checador sin capturarla otra vez | Sí | Sí | Sí | Falta |
| Menú por grupos, accesos anclados, enfoque por administrador | Sí | Sí | Sí | Falta la opinión de Migue |
| El acomodo sigue a la persona entre aparatos | Sí | Sí | Sí | Falta con dos aparatos reales |
| Equipos de trabajo: asignar a parcela y actividad con una captura, cambios en el día, "ya acabaron", pago por tarea | Sí | Sí (reloj simulado: un día completo) | Sí | **Falta: con gente y parcelas reales** |
| Mano de obra: quién, dónde, cuánto tiempo, haciendo qué y cuánto costó, con el rastro de cada importe | Sí | Sí | Sí | Falta |
| Destajo con lo que hizo cada quien (parejo sólo si se pide) | Sí | Sí | Sí | Falta |
| Tiempo sin asignar "por aclarar", con causa e historia | Sí | Sí | Sí | Falta |
| Lenguaje unificado: sin jornal, labor ni faena en ninguna pantalla | Sí | Sí (recorrido de todas las pantallas) | Sí | Que lo lean ustedes |
| Cuadrillas eventuales: quién vino, responsable, pago por persona, destajo individual | Sí | Sí | Sí | **Falta: con una cuadrilla real** |
| Transporte de cuadrillas: flete externo repartido (criterio configurable), vehículo propio sin importe, sin transporte | Sí | Sí | Sí | Falta |
| Salida termina la asignación; "continuar actividad anterior" | Sí | Sí | Sí | Falta |
| Tiempo: trabajado, por aclarar e improductivo como cuentas separadas | Sí | Sí | Sí | Falta |
| Horas adicionales registradas y acumuladas (sin cambiar el pago) | Sí | Sí | Sí | Falta; reconocerlas para pago no está hecho |
| Una sola fuente por día: la cuadrilla (o el trabajador) capturada por la pantalla anterior Y por la nueva cuesta una vez | Sí | Sí (reglas + navegador) | Sí | Falta |
| Cuadrillas sólo en su pantalla: retiradas del registro de actividades del administrador y del registro masivo | Sí | Sí | Sí | **Falta: que el encargado diga si le falta algo** |
| Cuadrilla: precio por el trabajo, hectáreas, nota y registrar un día anterior | Sí | Sí | Sí | Falta |
| Operador: su rato en el camión se le carga al vehículo con lo que ya gana | Sí | Sí | Sí | **Falta: un día real con traslado** |
| Lo que costó cada vehículo: operador + combustible y materiales del almacén + taller pagado + depreciación | Sí | Sí | Sí | Falta |
| A qué benefició cada vehículo: reparto a parcelas por personas transportadas (o por viaje, horas, km, parejo), sin crear otro gasto | Sí | Sí (reglas; en pantalla sólo el caso simple) | Sí | **Falta: un mes real para ver si el reparto tiene sentido** |
| La existencia se calcula de movimientos: compras, conteos, entregas, devoluciones, transferencias y mermas | Sí | Sí (dos aparatos sin señal, en distinto orden y con reintento) | Sí | **Falta: dos teléfonos de verdad sin señal** |
| Insumo anotado en una actividad y cerrado en Entregas: cuenta una vez | Sí | Sí (tres órdenes de llegada) | Sí | **Falta: con un trabajador real** |
| Conteo por bodega, absoluto ("había tanto") | Sí | Sí | Sí | Falta |
| Falta de existencia: se registra y queda discrepancia pendiente, sin inventar ajustes | Sí | Sí | Sí | Falta |
| Plazos de lo entregado (24 h / 72 h; herramientas 7 y 15 días), "sigue en uso" con fecha | Sí | Sí | Sí | Falta. Son avisos al abrir la app, no mensajes al teléfono |
| Baja de herramienta con causa, valor y evidencia; la decisión con el trabajador va aparte | Sí | Sí | Sí | Falta |
| El aviso de "cuándo se acaba" y las alertas de mínimo ven los movimientos nuevos | Sí | Sí | Sí | Falta |
| Costo promedio calculado de las compras (no depende de qué teléfono subió al último); compra tardía = ajuste posterior a la vista, sin tocar el costo original | Sí | Sí (reglas, en dos órdenes) | Sí | **Falta: una compra real capturada tarde** |
| Tres fechas por movimiento; la hora de recepción la pone el servidor; el desfase de cada teléfono se mide y se corrige a la vista | Sí | Sí (reglas y base aislada) | Sí; hoja 36 instalada | **Falta: un teléfono real con la hora mal puesta** |
| Permisos y descansos autorizados (se pagan), faltas (no se pagan) y justificación posterior con historial | Sí | Sí | Sí | **Falta: una semana real** |
| Calendario de asistencia por trabajador (quién no viene los sábados), separado del pago semanal | Sí | Sí | Sí | Falta |
| Salida anticipada: sin descuento automático; queda por revisar y un administrador decide con motivo | Sí | Sí | Sí | **Falta: un caso real** |
| Lo que corresponde, lo entregado y lo pendiente por trabajador; pago con medio y comprobante | Sí | Sí | Sí | Falta |
| Cuadrillas: cuenta del responsable, entrega y saldo; temporales independientes con pago directo | Sí | Sí | Sí | Falta |
| Recibo interno (planta, temporal) y constancia de entrega (cuadrilla), con versiones; se guarda como PDF desde Imprimir | Sí | Sí | Sí | **Falta: imprimir uno y que lo firmen** |
| Horas adicionales por trabajador, semana, mes y año; reconocerlas es una decisión aparte | Sí | Sí las reglas; en pantalla sólo que abre | Sí | Falta |
| Costo directo y costo completo en los reportes de siembra y de temporada, con desglose, explicación de cada importe y pendientes | Sí | Sí | Sí | **Falta: que Luis y Migue lean un reporte real** |
| Almacén: entregar no es gastar; queda a cargo de quien lo recibe | Sí | Sí | Sí | **Falta: una semana de entregas reales** |
| Cierre de lo entregado: se usó (ahí nace el costo), regresó, se quedó con otro, se rompió o perdió | Sí | Sí | Sí | Falta |
| Herramientas prestadas: quién la trae, devolución y baja con causa | Sí | Sí | Sí | Falta |
| Combustible directo a un vehículo, al costo promedio | Sí | Sí | Sí | Falta |
| Conciliación del día: sólo lo que sigue fuera; "sigue con él" | Sí | Sí | Sí | Falta |
| Código QR por artículo para escogerlo sin buscar | Sí | Sí el código y su lectura como texto; **la cámara sobre una etiqueta impresa, no** | Sí | **Falta: imprimir y leer una** |
| Mover a otro lugar (otra bodega) sin que sea gasto | Sí | Sí | Sí | Falta. El conteo a ciegas todavía es sólo del almacén principal |
| Faltas y permisos con causa; horas extraordinarias reconocidas, bonos, aguinaldo, vacaciones | No | — | — | Hay políticas por definir (`COSTEO.md`) |
| Pagos, pendientes por trabajador y recibos internos en PDF | No | — | — | — |
| Provisiones de prestaciones e indirectos distribuidos | No | — | — | Hay políticas por definir |
| Esa mano de obra entra sola a los reportes de costo que ya existían | Sí | Sí | Sí | Falta |
| Tableta cerrada en el checador (con clave para abrir) | Sí | Sí | Sí | **Falta: en la tableta de la nave** |
| Los minutos de "lectura repetida" se cambian desde la app | Sí | Sí | Sí | — |
| Los eventos viven fuera del cajón de 5 MB y se baja sólo lo nuevo | Sí | Sí (local); **la bajada por partes sólo simulada** | Sí | **Falta: con semanas de marcas reales** |
| Medio día, horas extra, séptimo día y otras reglas de pago | No | — | — | Hay que definirlas |
| Capturar la modalidad de pago en la ficha del trabajador (hoy sólo por día, salvo que se cargue de otra forma) | No | — | — | — |
| Costos reales por parcela, cultivo, actividad y temporada | No | — | — | — |

**Problemas y riesgos abiertos**

- **El cálculo recorre todos los eventos cada vez.** Con unos meses de marcas va bien; con años habrá que cerrar periodos y guardar su resumen. No urge, pero está anotado.
- **Los días de permiso o descanso pagado no están en el costo de ninguna parcela.** Se le pagan al trabajador, pero ese dinero hoy sólo se ve en Pagos al personal: falta decidir a dónde se carga (es un costo indirecto de personal).
- **Retención y abono a préstamo** siguen como estaban en la nómina; el abono al préstamo queda ligado al pago sólo si se registra el pago después de aplicarlo.
- **El "PDF" del recibo se genera con Imprimir → Guardar como PDF** del teléfono o la computadora; la app no guarda el archivo PDF, guarda el contenido del recibo y sus versiones.
- **Los encargados** siguen calculándose de las actividades registradas (no checan); sus ausencias no se llevan todavía.
- **Un teléfono que NUNCA ha tenido señal desde que se instaló no sabe cuánto difiere su hora.** Sus movimientos entran con la hora que diga hasta que el servidor los recibe; ahí se acota (no pudo pasar después de recibido), pero un reloj ATRASADO en un teléfono así no se puede detectar. Se señalan como "hora sin comprobar".
- **Las dos cifras están en el reporte de cada siembra y de cada temporada.** Las listas y tarjetas chicas (inicio, panel de parcelas, alertas de costo por hectárea) siguen enseñando el costo directo.
- **"Ajustes posteriores" cubre hoy la valuación de insumos y lo indirecto capturado tarde.** Todavía no hay cierre de mes que congele una copia de cada reporte: lo "original" se reconstruye de las fechas de captura.
- **Los avisos de entregas vencidas no llegan como mensaje**: salen al abrir la app, al que lo trae, al encargado y (al segundo plazo) al administrador.
- **El reparto del costo de vehículos es una vista, no entra todavía a los reportes de costo por parcela de siempre** (ésos siguen enseñando el costo directo). El costo completo por parcela se ve en Mano de obra.
- **La tableta cerrada no impide salirse del navegador**: eso lo cierra el propio aparato (en Android, "fijar pantalla"). La app ya no deja ir a otras pantallas.
- **La entrada de la cuadrilla con su PIN sigue existiendo** (es la única captura que hace la propia cuadrilla). Ya no puede duplicar: no guarda un día que el encargado ya registró, y si aun así llegan dos (sin señal, en aparatos distintos) la cuenta toma sólo el de Cuadrillas. Se retira cuando el encargado confirme que la pantalla nueva le basta. Lo único que la anterior hace y la nueva no: que la cuadrilla se registre sola, y anotar la cosecha en la misma captura (la cosecha va en Cosechas).
- **Actividad tecleada a mano para quien ya checó ese día:** ya no duplica; manda el checador y lo tecleado no cuenta su mano de obra.
- **Dos personas con el mismo PIN** no pueden checar con PIN (el checador lo dice). Hay que revisar los PIN al dar de alta a la gente.
- Una prueba de la base falló dos veces de forma intermitente y no se ha podido repetir; la corrida completa ya guarda el detalle.

| Prestaciones (aguinaldo, vacaciones, prima): se generan solas desde la fecha de ingreso; determinar y pagar no las cargan otra vez; condiciones por persona y mínimos de ley | Sí | Sí (13 reglas + navegador) | Sí | **Falta: capturar fechas de ingreso reales y comparar un aguinaldo contra el cálculo de siempre** |
| Costo de personal que no es de una parcela (permisos, descansos, esperas, día de un encargado): indirecto, con causa y regla por concepto; lo que no se puede repartir queda pendiente | Sí | Sí | Sí | Falta |
| Encargados: asistencia por calendario (por periodos), ausencias registrables, checador opcional | Sí | Sí | Sí | **Falta: decidir a quién se le activa** |
| Cierre de la semana con versiones, reapertura con motivo, diferencias posteriores a la vista, y confirmación de pagos aparte | Sí | Sí | Sí | Falta: cerrar una semana real |
| Abono a préstamo ligado a su semana sin importar el orden; recibo interno guardado también como PDF; tarjetas chicas dicen «costo directo»; horas adicionales probadas con una jornada de 10 h | Sí | Sí | Sí | Falta |

| **Lo sensible lo autoriza la base** (hoja 37): pagos, abonos, recibos, cierres, prestaciones, saldos iniciales, decisiones de un día y reglas se validan al llegar con la cuenta de la sesión; permisos por cuenta y por operación; sin señal queda «por validar» y no cuenta | Sí | Sí: 11 ataques directos a la base de prueba + 15 casos en navegador con una nube que valida igual + 7 reglas | Sí (hoja instalada; 10 ataques repetidos contra la base real, deshechos) | **Falta con cuentas y teléfonos reales** |
| Abonos a préstamos como movimientos (saldo calculado, sin sobrescrituras, idempotentes, con historial) | Sí | Sí | Sí | Falta |
| Saldos iniciales de prestaciones con fecha de corte, fundamento, responsable y evidencia; nunca al costo | Sí | Sí | Sí | Falta: capturar los reales |
| Cierre de mes: foto de costos por parcela (directo, indirecto, completo, pendiente), ajustes posteriores a la vista, reapertura con motivo y versiones; pide el permiso «cerrar el mes» | Sí | Sí (4 reglas + 9 en navegador) | Sí | Falta: cerrar un mes real |
| Cierre de mes con gastos generales: producción, pendiente de distribuir, lo que no es de producción, gastos generales por categoría (sin repartir a parcelas) y total del rancho sin duplicar; las compras para el almacén se dicen aparte | Sí | Sí (5 reglas + 11 en navegador) | Sí | Falta: cerrar un mes real |
| Préstamos por etapas: solicitud (encargado) → autorización (permiso propio) → entrega del dinero → abonos → saldo. La deuda nace con la entrega | Sí | Sí (5 reglas + 2 ataques a la base de prueba + 7 en navegador) | Sí (hoja 39) | **Falta con cuentas reales** |
| Bajas del personal: finiquito o liquidación según la causa; la app propone cada concepto y marca lo que hay que revisar; una persona confirma; no repite lo ya generado; pagos, documentos y PDF del cálculo | Sí | Sí (8 reglas + 11 en navegador) | Sí | **Falta revisarlo con quien lleve lo laboral y con un caso real** |
| Maquinaria: cuota aplicada contra costo real, sin sumarlos; diferencia con tratamiento; conciliación por máquina en el cierre | Sí | Sí (5 reglas + escenario + 2 en navegador) | Sí | **Falta: una máquina real con su diésel, taller y depreciación** |
| Insumos al consumirse; Resultados, inventario y flujo como tres cifras | Sí | Sí (5 reglas + escenario + navegador) | Sí | Falta: un mes real |
| Bonos en Pagos al personal (otorgar = costo, pagar = dinero); pantalla vieja retirada, registros conservados | Sí | Sí (7 reglas + 8 en navegador + base) | Sí (hoja 41) | **Falta con cuentas reales** |
| Compras del personal: aprobar → recibir → valuar; sin precio queda pendiente de valoración | Sí | Sí (9 reglas + 7 en navegador) | Sí | **Falta: una compra real con su ticket** |
| Salario integrado por partes: percepciones fijas y variables en la ficha, con periodo y vigencia; lo que falta deja el cálculo como piso «por revisar» | Sí | Sí (7 reglas + 4 en navegador) | Sí | **Falta: capturar las percepciones reales de cada persona** |
| Alerta del salario mínimo que falta (año en curso, o en diciembre el siguiente); captura con evidencia oficial obligatoria | Sí | Sí (8 reglas + 7 en navegador) | Sí | Falta: la primera captura real en diciembre |
| Conciliación mensual de prestaciones y bajas: generado, ajuste, pago y saldo, con el porqué de cada importe y comprobación contra los costos | Sí | Sí (6 reglas + 3 en navegador) | Sí | Falta: un cierre real |
| Revisión integral: una sola utilidad y un solo flujo; lo que no tiene parcela entra al cierre; pase de lista en Pagos (`docs/REVISION-INTEGRAL.md`) | Sí | Sí (14 cruces en navegador + reglas) | Sí | **Falta: el recorrido con Migue** |
| Catálogo oficial de salarios mínimos (general y frontera norte), 2019 a 2026, con su publicación en el DOF; el cálculo usa el vigente en su fecha; se actualiza con permiso y deja historial | Sí | Sí (6 reglas + 1 ataque a la base de prueba + 5 en navegador) | Sí (hoja 40) | Falta: capturar el de 2027 cuando se publique (diciembre) |
| Bajas, corrección del 19 nov (noche): indemnizaciones con salario integrado; veinte días por año fuera de entrada en un despido; prima de antigüedad con el mínimo del día de la baja; su costo es gasto laboral general | Sí | Sí (11 reglas + 26 en navegador) | Sí | **Falta revisarlo con quien lleve lo laboral y con un caso real** |
| Quien cobra por destajo: base por promedio de lo ganado; sin datos queda «pendiente de revisión», no en cero | Sí | Sí | Sí | Falta |
| Pago por calendario: lo activa un administrador, por persona, con fecha de inicio | Sí | Sí | Sí | Falta |

**Lo que NO quedó cerrado (riesgos a la vista):**
- El cierre de mes toma lo que tiene fecha de ese mes. Lo que no tiene parcela ni vehículo sale como «gastos generales», aparte y sin repartir: repartirlo pide una política que decide Luis.
- **Bajas:** el salario integrado que arma la app sólo incluye aguinaldo y prima vacacional. Si alguien recibe otras percepciones fijas (bonos, despensa, habitación, comisiones) hay que sumarlas a mano: la app no las conoce y lo avisa. En relaciones por temporada u obra determinada no propone la indemnización del art. 50 fracción I. No es asesoría legal.
- **Salarios mínimos:** los de 2022 y 2024 se cotejaron con una reproducción de la tabla de la CONASAMI (la publicación en el DOF sí está confirmada); los demás, con el texto de la resolución. La página de gob.mx/conasami no dejó leerse desde aquí.
- **Decidido por Luis (19 nov, 20:38):** no se contrata Supabase Pro; los gastos generales no se reparten a parcelas; las bajas son gasto laboral general.
- **Protección contra contraseñas filtradas (Supabase): NO activada.** Es función del plan de pago; activarla es un gasto y lo decide Luis.
- `rls_auto_enable`: es una función interna de Supabase (enciende la protección por renglón en tablas nuevas). No exponía datos; se le quitó el permiso de ser llamada desde fuera (hoja 38).
- La base comprueba QUIÉN y con QUÉ permiso; no recalcula cuánto le corresponde a cada quien (eso vive en la app). De un pago sólo revisa que el importe sea un número mayor que cero.
- El sello vive en cada aparato tal como lo bajó: quien altere su propio teléfono sólo se engaña a sí mismo, los demás leen el de la base.
- Con base, quien entra con PIN de administrador en un aparato cuya cuenta no tiene el permiso NO puede pagar, cerrar ni cambiar reglas. Es lo pedido, pero cambia la costumbre: esas operaciones se hacen con cuenta propia.
- **Cambio de costumbre:** abonar a un préstamo ahora pide el permiso de pagos; antes lo hacía cualquier encargado. Dar el préstamo sigue como estaba (no se tocó): revisar si también debe pedir permiso.
- Los permisos los asigna sólo un superadministrador (hoy, Luis y Migue).
- La base de destajo usa lo registrado en AgroGestión; lo ganado antes del sistema no está, así que al principio todo saldrá «por revisar». Se puede poner una base en la ficha, con evidencia.
- Las prestaciones cuentan desde la fecha de corte que se declare (`prest_corte`); sin declararla, desde el primer día con registros.
- No hay finiquitos ni partes proporcionales al dar de baja; no se calculan impuestos, cuotas ni salario integrado.
- El PDF del recibo es de puro texto (sin logo).

## Instalación en la infraestructura nueva

| Asunto | Hecho | Comprobado en el proyecto real |
|---|---|---|
| Base montada (29 hojas, 62 tablas), sellada y vacía | Sí | Sí |
| 6 ataques sin sesión + 34 con sesión | Sí | Sí, sin dejar rastro |
| Sitio publicado y conectado | Sí | Sí (18 de 18 en navegador real) |
| Alta de cuentas sin consola (código de arranque de un uso + invitación) | Sí | El procedimiento completo, sí (sin dejar rastro). **Falta: que entren ustedes** |
| El correo de confirmación lleva al sitio | Sí | Sí |
| `main` no puede publicar encima del sitio | Sí | Sí |
| Pantalla de Arranque: cuentas, conteo, saldos, inicio | Sí | **Falta: con datos reales** |
| Función de lectura con IA instalada y cerrada a extraños | Sí | El candado sí; **leer, no (falta llave)** |
| Sincronización entre dos teléfonos reales | — | **Falta** |
| Ensayo de respaldo y restauración | — | **Falta** |

## Arranque limpio (nuevo, 19 nov) — detalle en `ARRANQUE-LIMPIO.md`

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| Lo guardado en los teléfonos no entra a la operación nueva | Sí | Sí (navegador real) | No | No |
| Segundo candado: la base rechaza lo que no es de su espacio | Sí | Sí | No | No |
| Un respaldo de antes no se puede restaurar | Sí | Sí | No | No |
| Lo de antes no se borra y se puede descargar | Sí | Sí | No | No |
| La app ya no trae rancho ni parcelas de fábrica | Sí | Sí | No | No |
| La base nace sin un solo registro de operación | Sí | Sí | No | No |
| Catálogos: hoja de revisión y carga sólo de lo aprobado | Sí | Sí | — | No |
| Fecha oficial de inicio, una sola vez | Sí (pantalla Arranque) | Sí | No | No |
| Conteo inicial con fecha, lugar y responsable | Sí (pantalla Arranque) | Sí | No | No |
| Saldos iniciales con corte, responsable y evidencia | Sí (pantalla Arranque) | Sí | No | No |
| Pruebas sin ensuciar producción | Sí: transacciones que se deshacen; lo de ustedes, marcado y cancelado | Sí | — | — |

## Infraestructura propia (nuevo)

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| Base reconstruible desde cero (25 hojas, 54 tablas) | Sí | Sí | No | No |
| Fotos y PDF fuera de los registros, almacén privado, sin duplicados | Sí | Sí (navegador real + base) | No | No |
| Lo borrado deja lápida y no revive | Sí | Sí | No | No |
| Captura de campo por la cuenta del encargado | Sí | Sí (navegador real, nube de mentira) | No | No |
| La cola espera cuenta en vez de quemar intentos | Sí | Sí | No | No |
| Medidor de base, fotos e IA con avisos y freno | Sí | Sí | No | No |
| IA una vez por documento, con tope mensual | Sí | En el teléfono y la tabla, sí; **la función del servidor, no** | No | No |
| Cambios de sueldo anotados; costo "estimado" aparte | Sí | Sí | No | No |
| Devengado y distribución separados | Sí (aún no alimenta reportes) | Sí | No | No |

## Seguridad

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| PIN de fábrica de dirección eliminado | Sí | Sí (navegador real) | No | No |
| Sesión falsificable en el teléfono | Sí | Sí (navegador real) | No | No |
| Cuenta técnica y su contraseña fuera del código | Sí | Sí | No | **Falta rotar la contraseña (Luis)** |
| Datos personales fuera del código | Sí | Sí | No | Repos siguen públicos (Luis) |
| Aviso cuando el teléfono no guarda | Sí | **Sí (nuevo)** | No | No |
| Confirmación al borrar trabajador + bitácora | Sí | **Sí (nuevo)** | No | No |
| Recargar ya no borra lo pendiente | Sí | Sí | No | No |
| Permisos por rol en la base (hoja 24) | **Sí (nuevo)** | **Sí, 16 ataques en base aislada** | No | No |
| Luis y Migue superadministradores con cuenta propia | **Sí (nuevo)** | Sí | No | No |
| Función de lectura con IA cerrada a extraños | **Sí (nuevo)** | **No** | No | No |
| Funciones `oir-audio` y `revisar-parcela` abiertas a extraños | No | — | — | — |
| Quien entra por PIN no tiene cuenta en la base | Sí: sube por la cuenta del encargado | Sí | No | No |
| PIN de trabajadores legibles en pantalla y en la base | No | — | — | — |

## Operación

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| Los 8 roles abren sus 131 pantallas sin tronar | — | **Sí (nuevo)** | — | No |
| Un aumento de sueldo ya no reescribe el costo pasado | **Sí (nuevo)** | Sí | No | No |
| Dar de baja a alguien ya no borra lo que costó | **Sí (nuevo, de hoy en adelante)** | Sí | No | No |
| Aviso de ticket duplicado en el buzón | **Sí (nuevo)** | Sí | No | No |
| Regla de costo por hora vs. por día (dos reglas conviven) | No — decide Luis y Migue (D-4) | — | — | — |
| Lo borrado en un teléfono revive en otro | Sí (lápidas) | Sí | No | No |
| Fotos de tickets llenan la memoria del teléfono | Sí (salen del registro) | Sí | No | No |
| Subir un estado de cuenta como foto truena (ya estaba en lo publicado) | Sí | Sí | No | No |

## Pruebas ejecutadas (todas con datos de mentira, ninguna contra la base real)

| Batería | Resultado |
|---|---|
| Reglas, cálculos y nombres sin definir (`npm test`) | 893 de 893 |
| La base armada desde cero y atacada directo (`npm run test:base`) | 76 de 76 (11 son los ataques a lo sensible) |
| Navegador, alta de cuentas y Arranque (`cuentas`) | 22 de 22 |
| **Proyecto real**, sin sesión, desde internet (`real_sin_sesion`) | 6 de 6 |
| **Proyecto real**, 34 ataques con sesión (transacción deshecha) | 34 de 34 |
| **Sitio publicado**, navegador real (`real_sitio`) | 18 de 18 |
| Navegador, versión compilada (`humo`) | 9 de 9 (lo publicado hoy: 4 de 9) |
| Navegador, recorrido por rol (`recorrido`) | 17 de 17 |
| Navegador, fotos fuera de los registros (`archivos`) | 9 de 9 |
| Navegador, captura de campo (`campo`) | 13 de 13 |
| Navegador, arranque limpio (`arranque`) | 13 de 13 |
| Navegador, prestaciones, encargados y cierre de la semana (`prestaciones`) | 49 de 49 |
| Navegador, lo sensible contra una nube que valida como la base (`sensibles`) | 15 de 15 |
| Navegador, cierre de mes (`mes`) | 11 de 11 |
| Navegador, préstamos por etapas, salarios mínimos y bajas (`bajas`) | 26 de 26 |
| Compilación | correcta, 125 módulos, lector de PDF aparte |

Todo junto: `sh pruebas/todo.sh`.

## Auditoría

| Documento | Tema | Estado |
|---|---|---|
| `auditoria/00` a `03` | Diagnóstico, diseño de incorporación, contención, versiones | Hecho |
| `auditoria/04` | Permisos en la base | Hecho |
| `auditoria/05` | Buzón de papeles | Hecho |
| `auditoria/06` | Mano de obra | Hecho |
| `PUBLICACION-EMERGENCIA-P0.md` (rama de emergencia) | Qué se publica, orden y reversa | Listo, esperando autorización |
| `RUTA.md` | Plan con infraestructura propia y estado de las diez instrucciones | Vigente |
| `ARRANQUE-LIMPIO.md` | Qué entra, puertas de contaminación, catálogos, con qué se abre | Vigente |
| `DATOS-DE-LA-BASE-ANTERIOR.md` | Lo de antes se conserva y no se importa | Vigente |
| `PRUEBA-EN-TELEFONOS.md` | Lo que prueban Luis y Migue | Listo |
| `CAMBIO-DE-PRODUCCION.md` | El cambio y la reversa | Preparado, sin ejecutar |
| Pantallas nuevas (17) | Todas abren sin error. Revisadas a fondo: sólo el buzón | **Faltan 16 por revisar a fondo** |

## Pendiente de Luis y Migue

| # | Qué | Urgencia |
|---|---|---|
| 1 | Luis entra con el código de arranque e invita a Migue (`PRIMEROS-PASOS.md`) | **Ahora: es lo que falta para usarla** |
| 2 | Dar de alta lo básico o aprobar la hoja de catálogos | Para empezar a capturar |
| 3 | Conteo físico, saldos iniciales y declarar la fecha de inicio (pantalla Arranque) | Para empezar a operar |
| 4 | Decir cuándo se cambia app.agroselectos.com a la versión nueva | Cuando la hayan probado |
| 5 | Quién va por día, por hora o a destajo (D-4) | Antes de confiar en los costos |
| 6 | Llave y presupuesto de IA, si quieren leer tickets por foto | Cuando quieran |
| 7 | Hacer privado el repositorio viejo; borrar las dos variables viejas en Vercel | Alta |

## Decisiones ya tomadas por Luis

- `produccion/base-vigente` es la base de desarrollo.
- Luis y Migue: superadministradores con el mismo nivel, cada uno con su cuenta. Sin aprobación de un tercero ni topes de monto.
- Ni los superadministradores borran historial en silencio.
- No se despliega ni se conectan datos reales sin autorización.
- AgroGestión tendrá infraestructura propia en Supabase gratuito, sin depender de ATALAYA. Nada se contrata sin autorización.
- La gente de campo captura desde el teléfono de un encargado con cuenta; sin cuenta técnica compartida.
- No se congelan sueldos históricos con valores de hoy.
- **Arranque limpio:** la operación nueva empieza sin registros de antes. Sólo catálogos validados por Luis y Migue; inventario por conteo físico; saldos con evidencia; fecha oficial de inicio. Lo anterior se conserva intacto y no es requisito. Los datos de prueba no tocan producción.

## Versiones (nada se ha eliminado)

`main` intacta (versión de mayo). `produccion/fase-1-auditoria` conservada como registro. El sistema del despacho **no** está en este repositorio; sigue donde estaba, sin tocar.


## 20 nov 2026 (tarde) — Nueva etapa integral

| Etapa | Estado | Probado con |
|---|---|---|
| Costos: maquinaria (diferencia a parcelas, cuenta incompleta, uso no productivo), ajustes de valuación con su destino, insumos por clasificar, bonos por revisar, compras a medias | Publicado | pruebas de cálculo y `decisiones_navegador.py` (25 casos) |
| Importación de documentos por montones (XML, Excel, CSV, PDF con texto, Word), bandeja, histórico | Publicado, primera versión | `importacion.test.js` (19) e `importar_navegador.py` (19) |
| Entrada única, credencial + PIN, checar aparte de abrir sesión | Publicado | `acceso.test.js` y `entrada_navegador.py` (17) |
| Dominio app.agroselectos.com | Sirve la versión vigente con HTTPS | comprobado contra el archivo publicado |
| Capacitación y piloto | Entregados: presentación (.pptx) y guías por rol (.docx) | capturas reales con datos de ejemplo |

**Sin validar en el rancho** (nada de lo anterior se ha usado en un día real): cámara del checador en la tableta de la nave, cargas grandes de documentos reales, el piloto.

**Pendiente de una acción de Luis en un panel** (no en el registrador del dominio):
1. Vercel: quitar `app.agroselectos.com` del proyecto viejo `vitejs-vite-3ymxjehp` (Settings → Domains → Remove) para poder darlo de alta como dominio propio de `agrogestion-operacion`. Mientras tanto el dominio se apunta a mano a cada publicación.
2. Supabase → Authentication → URL Configuration: poner `https://app.agroselectos.com` como Site URL y dejar `https://agrogestion-operacion.vercel.app` en Redirect URLs, para que el correo de confirmación regrese al dominio definitivo.

**Operación hablada (21 nov, mañana) — visión y plan en `OPERACION-HABLADA.md`:** revisado en el código qué
existe (chat, dictado, planeación, checador, bitácora, aplicaciones). **Hecho y publicado:** el camino común de lo
que entra hablado (entender → preparar → validar → autorizar → ejecutar) conectado a «Dile a la app»; el avance
de trabajo en la unidad que se dice (sin pago ni porcentaje); y «El día» recuerda lo pendiente. Probado con
pruebas de cálculo y en navegador con gente y parcelas inventadas. **Sin validar:** que Migue lo diga con sus
palabras. **Sin hacer:** pasar el chat al camino común; plan → checador; memoria de decisiones de Fito; vista de
la reunión; préstamos, aplicaciones y almacén hablados; IA para entender; WhatsApp (investigado, no activado).

## Compromisos abiertos que el mapa NO desplaza (recordado por Luis el 21 nov)

El desarrollo geoespacial va en paralelo. Esto sigue siendo lo primero:

| Compromiso | Cómo está | Qué falta |
|---|---|---|
| Checador | Hecho y publicado (QR o PIN, tableta cerrada) | **Usarlo en la tableta de la nave, con fila de gente** |
| Operación diaria (reparto, cuadrillas, entregas del almacén, pagos al personal) | Hecho y publicado | **Un día real de punta a punta con Migue** |
| WhatsApp | Una puerta más para operar AgroGestión (Luis, 21 nov). Requisitos y costos investigados. **Preparación técnica hecha en paralelo (21 nov, tarde)**: lector, entrada del servidor y buzón escritos y probados con datos de mentira | **Nada instalado ni activado, ningún mensaje real.** Para encender: cuenta de Meta, número y autorización de gasto (`OPERACION-HABLADA.md` 5.1) |
| Acuerdos de la junta: inventario por bodega con responsable · bitácora de campo por turnos · expediente legal y documental por rancho/parcela · checador | Bodegas y checador: hechos. Bitácora por turnos y expediente legal: **sin construir** | Construir los dos que faltan |
| Piloto | Presentación y guías entregadas | **Dos semanas en paralelo sin fallas, cero pérdidas al sincronizar, respaldo restaurado** |

**Satélite para análisis, etapa 2 (21 nov, mañana):** desde la ficha de una parcela con límite: pasadas de
Sentinel-2 del ciclo, vigor (NDVI), humedad (NDMI) y color real por fecha, línea del tiempo y comparación entre dos
fechas, con nubosidad, cuadros usados y advertencias. Fuente gratuita sin cuenta (Planetary Computer); ~10 kB por
fecha. **Probado:** cuenta con pruebas; pantalla en navegador con imágenes de mentira; y de punta a punta contra el
servicio REAL con una parcela FICTICIA sobre un lugar cualquiera (13 fechas en 4 s). **Sin validar:** con una
parcela real del rancho y con alguien que conozca cómo estaba esa parcela en esas fechas. **Sin revisar:** las
condiciones de uso del servicio. **Sin hacer:** respaldo por AWS, comparar parcelas, avisos, drones.

**Mapa del rancho, etapa 1 (21 nov, mañana):** pantalla «Mapa del rancho» con imagen de satélite, límites reales
de parcelas y ranchos (trazados, caminados con el teléfono o importados de KML/GeoJSON), superficie medida, color
por cultivo del ciclo vigente y ficha de la parcela con lo que el sistema ya sabe. El dron ya usa esos límites.
Probado con pruebas de cálculo y en navegador con un rancho INVENTADO. Investigado y escrito en `docs/MAPA.md`:
proveedores y costos del fondo, Sentinel-2 gratis y directo desde el navegador (comprobado que el catálogo
público contesta y deja leer por pedazos), y qué se puede y qué no con drones. **Sin validar:** trazar una
parcela real en campo. **Sin hacer:** satélite por fecha (etapa 2), ortomosaicos (etapa 3), KMZ y shapefile.

**Rumbo (Luis, 21 nov, 5 am):** el análisis del Excel de 2024 queda CERRADO. No es el modelo de AgroGestión: es
un documento histórico más. Lo que sigue es el rancho de hoy; la importación histórica es una capacidad adicional.

**Trazabilidad del histórico y prueba controlada (21 nov, madrugada):** cerradas las decisiones de Luis (RA51 =
Rancho 51 y «R51 · El 51» como otra forma de escribirlo; Bod con dos posibilidades; ajo de campo/postcosecha como
clasificación histórica; mB sólo sugerencia; el domingo no se pasa al lunes; vigencia de claves por fechas;
ubicación → parcela «por decir»). Lo incorporado guarda lo que se entendió ese día: corregir un catálogo no lo
reescribe. Un día por dos papeles se avisa, se coteja y cuenta una vez. Prueba controlada con el Excel verdadero
(2 semanas) y la lectura verdadera de la libreta del domingo, en la máquina de trabajo: resultados en
`docs/EXCEL-RAYAS-2024.md` §9. **Límite encontrado:** la libreta es de domingo y el Excel no tiene domingos: no hubo
ningún día en común, se comparó contra días vecinos. **Sin hacer:** nómina/efectivo como componentes (sólo
descrito); incorporar las 12 semanas a producción (lo hace Luis desde la app). **Sin validar por una persona:**
todo lo anterior desde la sesión de Luis.

**Excel de rayas 2024 (21 nov):** ingeniería inversa y matriz contra AgroGestión en `docs/EXCEL-RAYAS-2024.md`.
Implementado: lectura de sus catálogos como referencias históricas (con procedencia, varias por clave, se sugieren
y una persona confirma) y de sus 12 semanas como rayas históricas (1,339 días-persona; sin importes ni sueldos); y el
cultivo de una parcela por FECHA (`src/ciclos.js`) en Finanzas y en el reporte por ciclo. Probado con pruebas
automáticas y pasando el archivo real por la pantalla en la máquina de trabajo (no se incorporó a producción).
**Sin hacer:** que Luis lo importe y confirme las claves; ligar cada ubicación del Excel a una parcela real; las
«rayas ajenos» (cuadrillas) del Excel no se leen. **Sin medir:** qué tanto tarda el recálculo con un año de datos.

**Rayas, aclaraciones del rancho (20 nov, 8 pm):** cinco cosas por renglón (trabajador, fecha, actividad,
ubicación, cultivo). «Ajo» es cultivo, no A07. «Gen» = General (no es lugar). RA50/51/53 = Ranchos 50s; SF1–4 = San
Felipe (grupos). El número al lado es importe TENTATIVO (no suma, no es pago). Segunda lectura real de la libreta
del domingo con Haiku: 24/24 renglones; A07 en 15, los 15 con Bod y con el cultivo aparte (leído «9jo» → Ajo);
RA51, SF4 y Gen bien; 420 y 420 como tentativos y el 200 sin asignar por no estar claro de quién es; «mB» sin
saber qué es; mes de la fecha sin leer. 0.0039 USD. Gastado en total: 0.022 de 4 USD. Sesión: comprobado que la
función arranca, contesta al navegador de la app, se niega sin sesión, tiene sus cinco variables, y que la cuenta
que existe tiene permiso (`puede_interpretar`) — **falta que una persona lo haga desde la app; no está validado.**

**Rayas con claves (20 nov, noche):** catálogo de claves que se llena solo (`src/claves.js`): A + número =
actividad; Bod y SF1–SF4 = ubicación (dicho por Luis). Ninguna actividad tiene significado todavía: se preguntan
conforme salen. Una raya entra siempre al histórico (quién · día · actividad · ubicación), con el código original;
no crea pagos ni actividades. Probado con pruebas automáticas (personas inventadas) y con UNA lectura real de la
foto de la libreta del domingo que mandó Luis: 24 de 24 renglones, claves copiadas tal cual («SF4» lo leyó «5f4»: la
app ya lo toma como SF4), 3 «falta», el mes de la fecha no se alcanzó a leer (lo pone una persona) y la columna de
marcas no se tomó por dinero. Costo: 0.0027 USD la hoja. **Sin validar:** que Luis o Migue lo hagan desde la app con
sus fotos originales, y el significado de cada clave A (nadie lo ha contestado).

**Lectura con IA en la importación (20 nov, noche) — comprobada con la API real, con documentos ficticios:**
ticket en foto con el nivel económico (Haiku 5.5): todos los datos correctos, 0.0008 USD; el mismo ticket otra
vez: salió de la memoria, 0 USD; hoja de raya desordenada: reconoció las columnas, 0.0005 USD; el ticket con el
nivel superior (Sonnet 5.5): 0.0112 USD (unas 14 veces más). El formato estructurado se aceptó a la primera. Con
el tope agotado la función se niega SIN llamar a la IA. Gasto total de la prueba: 0.013 USD de 4. Ningún
movimiento del rancho se creó. Necesitó el secreto `ANTHROPIC_WORKSPACE_ID`. **Sin comprobar:** la entrada con
la sesión de una persona desde la app (se probó el motor por una puerta temporal, ya apagada) y documentos
REALES del rancho (fotos de teléfono, letra a mano).

**Chat por el camino común, plan al checar y preparación de WhatsApp (21 nov, tarde):**

- **Chat de adentro**: al confirmar revisa el permiso de quien firma y deja de qué mensaje salió cada registro. Si
  no se puede, no queda firmado. De paso se corrigió un error real: una incidencia o una necesidad dichas se
  guardaban con otra forma que la que leen sus pantallas, y la pantalla de inicio tronaba al haber una.
- **Plan del día**: «Plan mandado» de hoy y de mañana en «El día» → Reparto; se cambia o se quita con rastro.
- **Checador**: al checar la entrada dice a qué va cada quien según el plan de ese día. Sólo informa.
- **WhatsApp**: preparado y apagado (ver arriba).
- **Probado:** 1,130 pruebas de cuenta; `pruebas/plan_navegador.py` 14/14 en navegador con gente y parcelas
  inventadas; `pruebas/funcion_whatsapp.test.mjs` 7/7 con Meta y base de mentira; recorrido 25/25, checador 22/22,
  lo dicho 15/15. **Sin validar:** nada de esto lo ha usado todavía Miguel, un encargado ni un trabajador.
- **Por confirmar con Miguel y Fito:** lista en `OPERACION-HABLADA.md` §7.

**Mensajería institucional y conversación que continúa (21 nov, 8–9 h) — detalle en `MENSAJERIA.md`:**

- El chat pasó a ser mensajería de trabajo: conversación general, directas y grupos (por persona o por puesto),
  con texto, audio, fotos y documentos, y las reglas a la vista.
- AgroGestión lee lo que se dicen ENTRE personas y propone; relaciona mensajes de distintas personas en una sola
  operación (compra + «se pagó de caja chica»), liga observación con pendiente y lo programado con lo ejecutado.
- Lo que falta se pregunta y se contesta en corto («20 pesos el kilo»), en la mensajería y en «Dile a la app».
- Un préstamo dicho nace como solicitud. Un teléfono conocido no basta para confirmar lo que mueve dinero.
- Base: hoja 45 instalada (agrónomo y finanzas ya escriben mensajes; dirección lee).
- Teléfono ligado a la cuenta: diseñado y probado en la base aislada; NO instalado.
- **Probado:** 1,152 pruebas de cuenta; 93 contra la base aislada; `pruebas/mensajes_navegador.py` 17/17; plan
  14/14, lo dicho 16/16, recorrido 25/25, checador 22/22. **Sin validar con nadie del rancho.**
- **Falta (lo más importante primero):** candado por conversación en la base; personal de campo; compra →
  caja chica → almacén en una confirmación; aplicaciones (Fito); IA para entender (gasto por autorizar).
- **Siguen abiertos:** checador en la nave, día real con Migue, piloto, bitácora agronómica (Fito), bitácora por
  turnos, expediente legal, reunión de la mañana y autorizaciones (Miguel). WhatsApp y pagos: sin activar.

**Candado en la base, tres niveles de acceso y memoria con origen (21 nov, 9 h) — `MENSAJERIA.md` §2 bis y §8:**
hoja 46 instalada (una conversación sólo la leen sus participantes; ni el superadministrador por serlo; consulta
excepcional y evidencia con permiso propio, motivo y bitácora). Pestaña «Memoria» con «¿De dónde salió?» y no
leídos. **Probado:** 1,156 pruebas de cuenta, 95 contra la base aislada, navegador 23/23. **Falta antes del piloto:**
avisos con la app cerrada, archivos con candado por conversación y dar de alta las cuentas. Dirección estratégica
(Agroselectos = empresa, AgroGestión = sistema; mensajería interna como medio principal; WhatsApp opcional).

**Bloqueadores del piloto de mensajería (21 nov, 9:30–10 h):**
- **Archivos por conversación: cerrado** (hoja 48, instalada; 7 pruebas atacando la base aislada).
- **Avisos al teléfono: construidos e instalados** (hoja 47 + función `avisar` desplegada; la base llama a la función
  en producción y contesta bien). 8 pruebas de la función, 5 de la base, 4 del aparato. **Falta la prueba en un
  Android real** (`AVISOS.md` §6): sin ella NO está validado.
- Pendientes de avisos: resumen de la víspera, vencidos, observaciones agronómicas, quien entra con PIN.

**Jornada: cambio de plan a media mañana (21 nov, 16 h) — `JORNADA.md`:** recorrido de siete trabajadores, máquina
descompuesta y cuatro reasignados, en pantallas reales (`pruebas/reasignacion_navegador.py` 20/20) y en cuentas
(`recorrido_*`). La jornada ya enseña los cambios de plan con quién, hora y motivo; lo trabajado en el lugar original
no sale como «fuera del plan»; al cambiar se puede decir la tarea nueva; lo no terminado puede pasar a mañana, lo
hecho y lo cambiado no. **Probado:** 1,179 pruebas de cuenta. **Sin validar con Miguel.** Los seis criterios de Luis
(quién confirma la tarea, asistencia de encargados y cuadrillas, revisión de Dirección, hora de cierre) NO están
construidos: esperan esa validación.

**Organización y órdenes delegables (21 nov, 17 h) — `ORGANIZACION.md`: SÓLO DISEÑO.** Diagnóstico de compatibilidad,
diseño de datos y permisos, recorrido de ocho escenas y plan en seis etapas. Nada construido ni instalado. Espera la
autorización de Luis y, para los permisos, la confirmación de Dirección.

**Organización, etapa 1 (21 nov, 18 h) — `ORGANIZACION.md` §7: CONSTRUIDA.** Pantalla «Organización» (administrador):
áreas, equipos, responsables, equipo habitual, apoyo temporal, historial y «cómo estaba el día tal». Estructura
provisional disponible con un botón (no creada en producción). Sin cambios de permisos. **Probado:** 1,190 pruebas de
cuenta; `pruebas/organizacion_navegador.py` 18/18. **Sin validar con Miguel, Fito ni Dirección.**
**Motor de especialidades y recomendaciones — `ESPECIALIDADES.md`: SÓLO DISEÑO.** Hallazgo: la base de producción no
tiene historial (0 trabajadores, 0 actividades), así que no hay con qué sugerir hasta que haya operación registrada.

**Organización protegida en la base y catálogo de actividades (21 nov, 19 h):** hoja 52 (capturar la organización pide
un permiso propio, sólo otorgado; 8 pruebas atacando la base aislada; no se le dio a nadie). Catálogo único de
actividades con requisitos legal · interno · experiencia (`ESPECIALIDADES.md` §13); nada restringe todavía. **Probado:**
1,200 pruebas de cuenta, 116 contra la base aislada, navegador 24/24. Recomendaciones apagadas. Sin validar en campo.
