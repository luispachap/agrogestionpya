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

## 19 nov, madrugada: instalado en la infraestructura nueva

**Dónde se abre:** https://agrogestion-operacion.vercel.app · Guía: `PRIMEROS-PASOS.md`

| Qué | Estado | Cómo se comprobó |
|---|---|---|
| Base en el proyecto nuevo (`cidgbfddrzoilvkqhszg`, organización AgroGestion) | **Montada** con las 27 hojas; 60 tablas, todas con candado | Cada hoja se instaló sólo si su huella coincidía con la probada |
| Arranca vacía | **Sí**: 0 cuentas, 0 registros, 0 archivos | Conteo directo en la base, después de todas las pruebas |
| Sellada con su espacio | **Sí** | Consulta directa |
| Ataques sin sesión, desde internet | **6 de 6 negados** | `pruebas/real_sin_sesion.py` contra el proyecto real |
| Ataques con sesión (34: ascensos, borrado de dinero y bitácora, datos viejos, otro espacio…) | **34 de 34 como se esperaba** | En el proyecto real, dentro de una transacción que se deshizo completa |
| Revisor de seguridad de Supabase | Sin errores. Corregí su aviso (funciones invocables desde afuera) | `get_advisors` antes y después |
| Sitio publicado | **Abre**, conectado a la base nueva | `pruebas/real_sitio.py`: 18 de 18, en dos tamaños de teléfono |
| Un teléfono con pruebas viejas abre el sitio real | No las muestra, no las sube, no las toca | Misma prueba |
| Función de lectura con IA | **Instalada**; rechaza a quien no tiene perfil | Llamada real: 403. **Leer de verdad no se ha probado: falta la llave de IA** |
| Alta de cuentas sin consola | En la app | Navegador real contra nube de mentira (19 de 19). **Con cuentas reales: falta que Luis y Migue entren** |
| Pantalla de Arranque (cuentas, conteo, saldos, inicio) | En la app | Misma prueba |

### Decisiones que tomé y por qué

- **Sitio nuevo en vez de cambiar app.agroselectos.com.** Ya existía un proyecto
  de Vercel llamado "agrogestion" con los dominios agroselectos.com; no lo
  toqué. Creé "agrogestion-operacion". Cambiar el dominio de siempre es un
  paso aparte, reversible, que haré cuando lo digan.
- **Un solo proyecto de Supabase, y es el de producción.** El plan gratuito no
  deja tener otro para pruebas. Por eso las pruebas con sesión contra el
  proyecto real se hicieron en una transacción que se deshace, y no dejé
  ninguna cuenta ni registro de prueba. Las pruebas de pantallas siguen
  corriendo aparte, con nube de mentira.
- **Cuentas por invitación y código de arranque**, en vez de darlas de alta yo
  desde el panel: así nadie me pasa contraseñas y Luis no opera consola.
- **Las hojas se instalaron bajándolas del repositorio con su huella**, no
  copiándolas a mano: lo instalado es exactamente lo probado.

### Lo que no pude hacer

- **Borrar la herramienta `http` de la base** (la usé para instalar): Supabase
  pide una confirmación que mi conexión cancela sola. Queda instalada; sólo la
  puede usar el dueño de la base. Se puede quitar desde el panel → Database →
  Extensions.
- **Apagar el registro libre de cuentas y poner la dirección del sitio** en la
  configuración de correos: no tengo herramienta para eso. No es un hueco —una
  cuenta sin invitación no ve ni toca nada, y está probado— pero conviene:
  Supabase → Authentication → URL Configuration → Site URL =
  `https://agrogestion-operacion.vercel.app`.

### Ojo con Vercel

El sitio nuevo publica lo que yo le mando de la rama `produccion/base-vigente`.
Si alguien empuja algo a la rama `main`, Vercel lo publicaría encima (y `main`
es la versión de mayo). Nadie debe tocar `main`.

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
2. Aplicar las 27 hojas en el orden de `supabase/orden.json`.
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
