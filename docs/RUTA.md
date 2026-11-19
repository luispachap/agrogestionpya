# Ruta de implementación — AgroGestión con infraestructura propia

19 nov 2026 · Decisión de Luis: AgroGestión deja de depender de la organización
anterior de Supabase (bloqueada hasta el 19 de diciembre por ATALAYA) y se monta
en un proyecto nuevo, aislado, en el plan gratuito. Nada se contrata.

**Cómo leer el estado.** *En rama* = código escrito y subido. *Probado* = hay una
prueba automática que lo comprueba (con datos de mentira). *Montado* = corriendo
en el proyecto nuevo de Supabase. *Validado* = comprobado por Luis y Migue en sus
teléfonos. **Hoy nada está montado ni validado: el proyecto nuevo aún no existe.**

## El único paso que me detiene

En la cuenta de Supabase sólo existe **una organización ("P&A")**, que es la
bloqueada. Un proyecto "aislado" necesita una **organización nueva**, y crear
organizaciones sólo se puede desde el panel — yo no tengo esa herramienta. No
creé el proyecto dentro de "P&A": no quedaría aislado de ATALAYA, y sería
brincarse la restricción.

**Luis:** supabase.com → menú de organizaciones → *New organization* → nombre
"AgroGestion", plan **Free**. Si Supabase no lo permite por la restricción de
facturación, ésa es la respuesta: no se intenta por otro lado, y lo vemos.
En cuanto exista, todo lo de la sección "Montaje" lo hago yo (≈ una sesión).

## Las diez instrucciones

| # | Instrucción | En rama | Probado | Montado | Validado |
|---|---|---|---|---|---|
| 1 | Proyecto nuevo y aislado | Verificado: no se puede sin organización nueva | — | **No — falta el paso de Luis** | No |
| 2 | Reconstruir la base desde las hojas | Sí (`supabase/orden.json`, 24 hojas) | Sí: se arma desde cero, trae las 54 tablas que usa la app, todas con candado | No | No |
| 3 | Datos anteriores: no se pierden ni se pisan | Sí (`docs/DATOS-DE-LA-BASE-ANTERIOR.md`) | — | — | — |
| 4 | Fotos y PDF fuera de la base | Sí (hoja 26, `archivos.js`) | Sí: navegador real + ataques a la base | No | No |
| 5 | Medidor, avisos y freno de saturación | Sí (hoja 27, banda en la app) | Sí | No | No |
| 6 | IA una vez por documento, con presupuesto propio | Sí (hoja 28, función `leer-papel`) | La parte del teléfono y la tabla, sí. **La función del servidor, no** (necesita el proyecto) | No | No |
| 7 | Campo por la cuenta del encargado, sin cuenta compartida | Sí (hoja 29, teléfono ligado) | Sí: navegador real contra una nube de mentira que rechaza como la de verdad | No | No |
| 8 | Historial económico sin inventar sueldos | Sí (`calculos.js`) | Sí | — | No |
| 9 | Probar todo en el proyecto nuevo y en teléfonos | Guía lista (`docs/PRUEBA-EN-TELEFONOS.md`) | — | No | No |
| 10 | Cambio de producción preparado, sin ejecutar | Sí (`docs/CAMBIO-DE-PRODUCCION.md`) | — | — | — |

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

1. Crear el proyecto en la organización nueva — plan gratuito, costo $0.
2. Aplicar las 24 hojas en el orden de `supabase/orden.json`.
3. Correr contra el proyecto real los mismos ataques de `pruebas/base/`.
4. Revisar los avisos de seguridad del propio Supabase.
5. Instalar la función `leer-papel` (queda apagada hasta que haya llave de IA).
6. **Luis y Migue** crean su cuenta con su correo; yo los nombro
   superadministradores; **Luis** apaga el registro libre de cuentas.
7. Publicar una **vista previa** (no producción) apuntando al proyecto nuevo.
8. Prueba en teléfonos (`docs/PRUEBA-EN-TELEFONOS.md`).
9. Con tu autorización: `docs/CAMBIO-DE-PRODUCCION.md`.

## Lo que sigue abierto

- **Los permisos de cada rol** salieron de leer el código. Hay que repasarlos con
  Migue usando la app de verdad; la prueba en teléfonos es el momento.
- **Notas de voz:** siguen dentro del registro (el almacén sólo acepta fotos y
  PDF). Son pocas y cortas; se mueven después si el medidor lo pide.
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

`sh pruebas/todo.sh` — 639 de reglas, 32 contra la base, compilación, y 48 pasos
en navegador real (acceso, 131 pantallas por rol, fotos, captura de campo).
