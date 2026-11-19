# Ruta de implementación — AgroGestión con infraestructura propia

19 nov 2026 · Decisión de Luis: AgroGestión deja de depender de la organización
anterior de Supabase (bloqueada hasta el 19 de diciembre por ATALAYA) y se monta
en un proyecto nuevo, aislado, en el plan gratuito. Nada se contrata.

**Cómo leer el estado.** *En rama* = código escrito y subido. *Probado* = hay una
prueba automática que lo comprueba (con datos de mentira). *Montado* = corriendo
en el proyecto nuevo de Supabase. *Validado* = comprobado por Luis y Migue en sus
teléfonos. **Hoy nada está montado ni validado: el proyecto nuevo aún no existe.**

## Cambio de estrategia del 19 de noviembre: arranque limpio

AgroGestión nunca operó de verdad; lo guardado son pruebas. La operación nueva
empieza **sin registros de antes**: sólo catálogos aprobados por Luis y Migue,
inventario por conteo físico, saldos con evidencia y una fecha oficial de
inicio. Lo anterior se conserva intacto y aparte. Detalle: `ARRANQUE-LIMPIO.md`.

Lo que eso cambió en el plan:

- **Ya no se importa nada** de la base anterior ni de los teléfonos. La base
  anterior deja de ser requisito.
- **Los teléfonos ya no pueden llenar la base nueva con lo que traen.** Era un
  hueco real del plan anterior; está cerrado con dos candados (uno en la app,
  otro en la base) y probado en navegador real.
- **La app ya no trae nada de fábrica.** El rancho y las 24 parcelas escritos
  en el código pasaron a la hoja de revisión.
- **Las pruebas no se hacen en producción** (ver "Decisiones").

## Lo que me detiene

En la cuenta de Supabase sólo existe **una organización ("P&A")**, la bloqueada.
Crear otra sólo se puede desde el panel. No creé nada dentro de "P&A".

**Luis:** supabase.com → *New organization* → "AgroGestion", plan **Free**. Si
Supabase no lo permite por la restricción de facturación, ésa es la respuesta:
no se intenta por otro lado.

## Estado

| # | Asunto | En rama | Probado | Montado | Validado |
|---|---|---|---|---|---|
| 1 | Organización y proyecto nuevos, aislados | — | — | **No: falta el paso de Luis** | No |
| 2 | Base reconstruible desde cero (25 hojas, 54 tablas) y que nace vacía | Sí | Sí | No | No |
| 3 | Lo viejo no entra: cajón propio por espacio + candado en la base | Sí | Sí (navegador real + ataques a la base) | No | No |
| 4 | Lo viejo se conserva: nada se borra, se puede descargar | Sí | Sí | — | No |
| 5 | Catálogos sólo validados (herramienta y hoja de revisión) | Sí | Sí, de punta a punta con datos de mentira | — | No |
| 6 | Sin PIN, cuentas ni permisos de antes | Sí | Sí | No | No |
| 7 | Inventario inicial por conteo físico | Regla escrita; **falta conectarla a la pantalla** | La regla, sí | No | No |
| 8 | Saldos iniciales con corte, responsable y evidencia | Regla escrita; **falta la pantalla** | La regla, sí | No | No |
| 9 | Fecha oficial de inicio | En la base; **falta el botón en la app** | Sí | No | No |
| 10 | Datos de prueba fuera de producción | Depende de la decisión de abajo | — | — | — |
| — | Fotos fuera de la base, medidor, IA con tope, campo por encargado, lápidas, sueldos | Sí | Sí | No | No |
| — | Función de lectura con IA en el servidor | Sí | **No** (necesita el proyecto) | No | No |

## Decisiones que necesito

1. **Dónde se prueba.** El plan gratuito da dos proyectos activos por persona y
   Luis ya usa uno (el despacho): no caben pruebas y producción a la vez.
   Propongo crear primero el de **pruebas**, validar en teléfonos, eliminarlo y
   crear el de **producción** limpio. Alternativa: que Migue cree el de pruebas
   con su cuenta. Detalle en `ARRANQUE-LIMPIO.md`, sección 6.
2. **La fecha de inicio de operaciones.**
3. **Quién aprueba los catálogos** y de qué fuentes (qué respaldos existen).

## Necesita autorización, y no se ha hecho

- Crear proyectos en Supabase (cuando exista la organización; costo $0).
- Eliminar el proyecto de pruebas al terminar.
- Cargar los catálogos aprobados.
- Publicar a producción.
- Cualquier llave o gasto de IA.

## Qué cambia en la app (ya en la rama `produccion/base-vigente`)

- **Fotos y PDF.** Al guardar cualquier registro, la foto sale de él: se guarda
  en el teléfono (donde caben cientos, no veinte) y sube aparte al almacén
  privado. El registro sólo lleva la referencia. La misma foto dos veces ocupa
  una sola vez. Funciona para todas las pantallas que toman foto, no sólo el buzón.
- **Lo borrado ya no revive.** Borrar deja una lápida; los demás teléfonos la ven
  y lo quitan. Nada se borra de verdad: un superadministrador puede restaurarlo.
- **Teléfono de campo.** Al salir, el encargado elige si su cuenta queda ligada.
  Si sí: su gente captura con PIN y sube; sus pantallas quedan cerradas con
  contraseña. Cada renglón guarda quién lo capturó (la persona) y, puesta por la
  base, qué cuenta lo subió.
- **La cola espera.** Sin cuenta ligada, las capturas ya no se "queman" en cinco
  intentos: esperan, y la app dice cuántas hay sin subir y por qué.
- **Medidor.** Base, fotos e IA contra sus topes; avisa en ámbar al 85 % y en
  rojo al 95 %, cuando el almacén deja de aceptar fotos nuevas (se quedan en el
  teléfono, no se pierden).
- **IA.** Antes de llamar: XML → proveedor conocido → ¿ya se leyó esta misma
  foto? Sólo entonces la IA, y con tope mensual de 150 lecturas (ajustable).
- **Sueldos.** Cada cambio de sueldo queda anotado con su fecha. El costo de un
  día usa el sueldo que consta para ese día; si no consta, lo dice ("estimado")
  y lo suma aparte. Lo devengado y lo repartido a parcelas son dos cuentas
  separadas que siempre suman igual.

## Dos fallos que encontraron las pruebas nuevas (corregidos)

1. **Mío, de la entrega anterior:** al guardar una actividad, la app usaba una
   función que no había importado. Compilaba, pero tronaba al capturar. No
   llegó a publicarse. Ahora hay una prueba que revisa todo el código buscando
   exactamente eso.
2. **Ya estaba en lo publicado:** subir un estado de cuenta como *foto* truena
   por la misma causa. Corregido en la rama; en app.agroselectos.com sigue así.

## Montaje (lo hago yo en cuanto exista la organización)

Primero en el proyecto **de pruebas**; después, igual, en el de producción.

1. Crear el proyecto — plan gratuito, costo $0.
2. Aplicar las 25 hojas en el orden de `supabase/orden.json`.
3. **Sellar el espacio** y comprobar que no hay ni un registro de operación.
4. Correr contra el proyecto real los mismos ataques de `pruebas/base/`.
5. Revisar los avisos de seguridad del propio Supabase.
6. Cuentas nuevas de Luis y Migue → superadministradores; **Luis** apaga el
   registro libre de cuentas.
7. Vista previa apuntando a ese proyecto → `PRUEBA-EN-TELEFONOS.md`.
8. Arranque: `ARRANQUE-LIMPIO.md`, sección 5. Cambio: `CAMBIO-DE-PRODUCCION.md`.

## Lo que sigue abierto

- **Los permisos de cada rol** salieron de leer el código. Hay que repasarlos con
  Migue usando la app de verdad; la prueba en teléfonos es el momento.
- **Notas de voz:** siguen dentro del registro (el almacén sólo acepta fotos y
  PDF). Son pocas y cortas; se mueven después si el medidor lo pide.
- **La pantalla de importar catálogos desde Excel** sigue ahí para superadministradores; se brinca la hoja de revisión. Regla: no usarla en el arranque.
- **Respaldo automático:** el plan gratuito no lo trae. Queda el respaldo manual
  desde la app y el que yo puedo sacar con autorización. La restauración hay que
  ensayarla una vez en el proyecto nuevo antes del cambio.
- **Funciones `oir-audio` y `revisar-parcela`:** todavía sin candado de cuenta ni
  presupuesto. No se instalan en el proyecto nuevo hasta tenerlo.
- **PIN de trabajadores** legibles en pantalla y en la base.
- **Costo por día o por hora (D-4):** las dos cuentas ya están separadas y
  probadas; falta que ustedes digan cuál se usa para cada persona.
- **El buzón con tickets reales** sigue sin medirse: necesita el proyecto, la
  función y una llave de IA.

## Cómo correr todas las pruebas

`sh pruebas/todo.sh` — 661 de reglas, 40 contra la base, compilación, y 61 pasos
en navegador real (acceso, 131 pantallas por rol, fotos, captura de campo y
arranque limpio). Ninguna prueba ni candado anterior se quitó.

## Lo que viene después

La especificación ampliada de la reunión de administración (asistencia, QR,
inventarios, herramientas, combustible, insumos, mano de obra, seguimiento
agronómico, finanzas, tierras y agua). **No se ha implementado nada de eso**:
espero los requisitos y las prioridades. Lo único que adelanté, porque lo pide
el arranque, son las reglas del conteo inicial, los saldos iniciales y la fecha
de inicio.
