# Tablero de avance — AgroGestión P&A

Actualizado: 19 nov 2026 · Rama de trabajo: `produccion/base-vigente` · Rama de emergencia: `emergencia/p0-contencion`

**El plan y el estado de la infraestructura nueva están en `docs/RUTA.md`.** Este tablero lleva el detalle por asunto.

**Cómo leer las columnas.** *En rama* = el código está escrito y subido. *Probado* = hay una prueba automática (con datos de mentira).
*Desplegado* = está en app.agroselectos.com. *Validado* = se comprobó con la operación real del rancho.

**Hoy (19 nov):** la versión nueva está **instalada y abre** en https://agrogestion-operacion.vercel.app, conectada al proyecto nuevo de Supabase. **No está validada**: falta que Luis y Migue entren con sus cuentas y la usen en sus teléfonos. app.agroselectos.com sigue con la versión vieja, sin tocar.

En las tablas de abajo, "Desplegado: No" quiere decir "no en app.agroselectos.com". En el sitio nuevo está todo lo que dice "En rama: Sí".

## Operación integral (etapa abierta el 19 nov) — modelo y orden en `EVENTOS.md`

**Próxima entrega operativa:** almacén por movimientos (retiro ≠ consumo, herramientas, combustible, conciliación del día).

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
| Costo real del vehículo propio ligado a los viajes de cuadrilla | No | — | — | Depende del almacén (combustible) |
| Faltas y permisos con causa; horas extraordinarias reconocidas, bonos, aguinaldo, vacaciones | No | — | — | Hay políticas por definir (`COSTEO.md`) |
| Pagos, pendientes por trabajador y recibos internos en PDF | No | — | — | — |
| Provisiones de prestaciones e indirectos distribuidos | No | — | — | Hay políticas por definir |
| Esa mano de obra entra sola a los reportes de costo que ya existían | Sí | Sí | Sí | Falta |
| Tableta cerrada en el checador (con clave para abrir) | Sí | Sí | Sí | **Falta: en la tableta de la nave** |
| Los minutos de "lectura repetida" se cambian desde la app | Sí | Sí | Sí | — |
| Los eventos viven fuera del cajón de 5 MB y se baja sólo lo nuevo | Sí | Sí (local); **la bajada por partes sólo simulada** | Sí | **Falta: con semanas de marcas reales** |
| Medio día, horas extra, séptimo día y otras reglas de pago | No | — | — | Hay que definirlas |
| Capturar la modalidad de pago en la ficha del trabajador (hoy sólo por día, salvo que se cargue de otra forma) | No | — | — | — |
| Almacén por movimientos, herramientas, combustible, conciliación del día | No | — | — | — |
| Costos reales por parcela, cultivo, actividad y temporada | No | — | — | — |

**Problemas y riesgos abiertos**

- **El cálculo recorre todos los eventos cada vez.** Con unos meses de marcas va bien; con años habrá que cerrar periodos y guardar su resumen. No urge, pero está anotado.
- **Las existencias del almacén se pisan entre aparatos** (número guardado, no suma de movimientos). Se corrige en la entrega del almacén.
- **La tableta cerrada no impide salirse del navegador**: eso lo cierra el propio aparato (en Android, "fijar pantalla"). La app ya no deja ir a otras pantallas.
- **La pantalla anterior de cuadrillas (la cuadrilla entra con su PIN) sigue existiendo.** Si se usa esa y la nueva para el mismo día, el costo se duplica. Hay que escoger una; propongo retirar la anterior cuando validen la nueva.
- **Si alguien teclea una actividad a mano para quien ya fue mandado con su cuadrilla, el costo se duplica.** La app lo avisa en Mano de obra, pero no lo impide.
- **Dos personas con el mismo PIN** no pueden checar con PIN (el checador lo dice). Hay que revisar los PIN al dar de alta a la gente.
- Una prueba de la base falló dos veces de forma intermitente y no se ha podido repetir; la corrida completa ya guarda el detalle.

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
| Reglas, cálculos y nombres sin definir (`npm test`) | 664 de 664 |
| La base armada desde cero y atacada directo (`npm run test:base`) | 49 de 49 |
| Navegador, alta de cuentas y Arranque (`cuentas`) | 22 de 22 |
| **Proyecto real**, sin sesión, desde internet (`real_sin_sesion`) | 6 de 6 |
| **Proyecto real**, 34 ataques con sesión (transacción deshecha) | 34 de 34 |
| **Sitio publicado**, navegador real (`real_sitio`) | 18 de 18 |
| Navegador, versión compilada (`humo`) | 9 de 9 (lo publicado hoy: 4 de 9) |
| Navegador, recorrido por rol (`recorrido`) | 17 de 17 |
| Navegador, fotos fuera de los registros (`archivos`) | 9 de 9 |
| Navegador, captura de campo (`campo`) | 13 de 13 |
| Navegador, arranque limpio (`arranque`) | 13 de 13 |
| Compilación | correcta, 106 módulos, lector de PDF aparte |

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
