# Respaldo automático de AgroGestión

**Estado (22 nov 2026): PREPARADO Y ENSAYADO EN LOCAL. SIN ESTRENAR CONTRA SUPABASE.**
Todavía no existe un respaldo real de producción ni una restauración en un proyecto aislado de Supabase.
**Mientras eso no pase, el riesgo sigue abierto y el respaldo no se considera terminado.**

## Lo que te toca a ti, Luis (tres pasos, unos 10 minutos, nada por chat)

1. **Crea un repositorio privado.** En github.com → «New repository» → nombre `agrogestion-respaldos` → **Private**
   → marca «Add a README» → Create repository.
2. **Ponle tres secretos.** En ese repositorio: Settings → Secrets and variables → Actions → «New repository secret».

   | Nombre (tal cual) | Qué va | De dónde sale |
   |---|---|---|
   | `CLAVE_RESPALDO` | Una frase larga que tú inventas (cinco o seis palabras) | De tu cabeza. **Apúntala en papel.** Sin ella el respaldo no se abre y nadie la puede recuperar. Que la conozca otra persona de confianza |
   | `BASE_URL` | La dirección de conexión de la base, con su contraseña | Panel de Supabase → botón **Connect** → «Session pooler» → copiar, y cambiar `[YOUR-PASSWORD]` por la contraseña de la base. Si no la recuerdas: Database → Settings → «Reset database password» |
   | `LLAVE_SERVICIO` | La llave secreta del proyecto | Panel de Supabase → Settings → API Keys → la que empieza con `sb_secret_` |

3. **Avísame** («ya está el repositorio»). Yo subo la configuración y corro el primer respaldo.

**Para el ensayo** (cuando el primer respaldo ya exista), dos pasos más:

4. Crea un **segundo proyecto** en Supabase, gratuito, con un nombre que diga ENSAYO. Vacío, sin tocarle nada.
5. En el mismo repositorio, dos secretos más: `DESTINO_BASE_URL` y `DESTINO_LLAVE_SERVICIO` (lo mismo que arriba, pero
   del proyecto ENSAYO), y avísame con la clave de ese proyecto (lo que va antes de `.supabase.co`; no es secreto).

Si al avisarme no puedo entrar al repositorio nuevo, te pediré un paso más: darle acceso a Claude a ese repositorio
en la configuración de GitHub. No hay nada más que configurar.

## Qué hace

Cada noche (3:17 de la mañana) GitHub saca solo una copia completa y la guarda **cifrada** en ese repositorio
privado. No cuesta: GitHub da 2,000 minutos al mes a los repositorios privados y esto usa unos 3 por noche.
De paso, esa visita diaria evita que el plan gratuito de Supabase pause la base por falta de uso.

Se conservan los últimos 30 días y el respaldo del día primero de cada mes.

## Qué se recupera y qué no

| Qué | ¿Se recupera? | Cómo se comprobó |
|---|---|---|
| Todos los datos de todas las tablas | **Sí** | Cada tabla: mismos renglones, mismo contenido (ensayo local) |
| Dinero: gastos, ingresos, caja, créditos con sus abonos, lo cancelado con su motivo | **Sí** | Comparado renglón por renglón |
| **Autoría**: quién capturó cada evento, quién lo autorizó o rechazó, con qué perfil y cuándo | **Sí, sin cambios** | Comparado evento por evento; nada queda a nombre de quien restaura |
| La firma de cada sello y la llave con que la base firma | **Sí** | En la copia, las firmas se siguen comprobando |
| La bitácora | **Sí** | Comparada completa |
| Las cuentas (correo y contraseña cifrada): cada quien entra con la misma contraseña | **Sí** | Comparadas |
| Perfiles, permisos por perfil y permisos otorgados (con quién los otorgó) | **Sí** | Comparados |
| Reglas de acceso, candados, funciones, operaciones sensibles | **Sí** | Las siete huellas de siempre, más dos nuevas |
| Los permisos que se **quitaron** (funciones y tablas cerradas) | **Sí, con un paso propio** | Una copia normal NO los trae: ver «Lo que destapó el ensayo» |
| Fotos, comprobantes y archivos de conversaciones | **Sí** | Cada archivo se vuelve a bajar de la copia y se compara byte por byte |
| Archivos borrados en producción | **Sí, se conservan** | El respaldo nunca borra un archivo |
| El nombre del espacio y la fecha de inicio declarada | **Sí** | Comparados; la copia sigue rechazando registros de otro espacio |

**Lo que NO se recupera del respaldo** y hay que volver a poner a mano en un proyecto nuevo:

- **Las sesiones abiertas.** Todos tienen que volver a entrar con su correo y contraseña (la contraseña es la misma).
- **Los secretos de las funciones del servidor**: la llave de IA y su espacio de trabajo. Se vuelven a capturar.
- **Las funciones del servidor** (lectura con IA, avisos): no van en el respaldo; están en el repositorio de la app
  y se vuelven a desplegar.
- **La configuración del correo** de invitaciones y de recuperación de contraseña, y las direcciones permitidas.
- **Las suscripciones de avisos al teléfono**: la dirección a la que avisa la base apunta al proyecto de antes; hay
  que cambiarla, y cada teléfono vuelve a aceptar los avisos.
- **Quién subió cada archivo al almacén** (el dato interno del almacén): los archivos vuelven, pero subidos por la
  restauración. Quién registró el comprobante sigue en el registro que lo usa.
- **Lo capturado después del último respaldo** (hasta un día): no está en el respaldo. Sigue en los teléfonos que
  lo capturaron: lo que tenían pendiente sube solo, y lo demás se recupera con «Elegir archivo de respaldo».
- **Lo que un teléfono capturó sin señal y nunca subió**, si ese teléfono se pierde.

## Lo que destapó el ensayo local (y ya está corregido)

**Una copia normal de la base no restaura los permisos que se quitaron.** Un proyecto nuevo de Supabase le da de
entrada a toda cuenta permiso de llamar cualquier función; la copia sólo dice «además dale permiso a…». Restaurada
tal cual, la base quedaba con **todas sus funciones abiertas**, incluida la que firma los sellos de autorización.
La restauración lo detectó sola (las huellas no coincidieron) y se negó a darse por buena.

Corregido: el respaldo guarda aparte quién puede llamar cada función y tocar cada tabla, y la restauración lo vuelve
a aplicar al final. Las comprobaciones ahora incluyen esos permisos y tres intentos de llamar funciones cerradas.

## El ensayo local (hecho el 22 nov): qué demuestra y qué no

`sh pruebas/respaldo_local/ensayo.sh` — 26 comprobaciones, todas pasan. Dos servidores de base de datos de
verdad en esta máquina: en uno, un rancho inventado capturado por las puertas reales (cada cuenta con su sesión, la
base sella y firma); el respaldo de la noche tal cual; la restauración en el otro, vacío.

Demuestra: que el respaldo sale cifrado y completo; que no imprime llaves; que la restauración se niega contra
producción, contra una base con tablas, contra el origen y con otra clave; que datos, autoría, permisos, cuentas y
archivos vuelven idénticos; que los intentos no autorizados se rechazan en la copia; y que la copia opera.

**No demuestra** (por eso no sustituye el ensayo real): que la herramienta oficial de Supabase saque la copia igual
que su imitación local; que un proyecto nuevo de Supabase acepte la restauración sin tropiezos (versión de la base,
extensiones, papeles propios de la plataforma); ni que el almacén real de archivos se comporte como la imitación.

## El ensayo real (sin esto no se declara resuelto)

1. Con el primer respaldo ya guardado, se corre «Restaurar un respaldo en otro proyecto» contra el proyecto ENSAYO.
   Se niega a correr contra producción y contra un proyecto que ya tenga tablas.
2. La restauración comprueba sola y deja un informe: datos de cada tabla, estructura y permisos (nueve huellas),
   cuentas, cada archivo byte por byte, y 36 intentos no autorizados.
3. Se comprueba aparte la autoría, igual que en el ensayo local.
4. Se apunta una copia de la app al proyecto ENSAYO con el nombre de espacio de producción
   (`VITE_ESPACIO_HEREDADO`) y se usa: entrar con la cuenta, ver lo restaurado, capturar algo.
5. Se anota aquí lo que salió, y lo que no se pudo recuperar. El proyecto ENSAYO se pausa o se borra (lo decide Luis).

## Qué hacer si se pierde producción

1. Crear un proyecto nuevo en Supabase y poner sus dos secretos `DESTINO_…`.
2. Correr «Restaurar un respaldo en otro proyecto» con el día que se quiera. Tiene que terminar en verde.
3. Volver a desplegar las funciones del servidor y capturar sus secretos; cambiar la dirección de los avisos.
4. En Vercel: la dirección y la llave pública del proyecto nuevo, **y `VITE_ESPACIO_HEREDADO` con el nombre del
   proyecto de antes**. Así la app trabaja sobre la copia sin reescribir ni un registro ni una firma, y los
   teléfonos conservan lo que tenían guardado y pendiente. Publicar.
5. Todos vuelven a entrar. Lo pendiente de cada teléfono sube solo.

`VITE_ESPACIO_HEREDADO` sólo se pone en una recuperación de producción. Nunca en una vista previa ni en pruebas.

## Cómo sabré que dejó de funcionar

- GitHub le manda un correo al dueño del repositorio cuando la tarea de la noche falla.
- El archivo `ULTIMO.md` del repositorio de respaldos dice el día del último respaldo y cuántas tablas, renglones,
  cuentas y archivos llevó. Si esa fecha no es la de hoy o la de ayer, algo pasó.
- Un respaldo incompleto **no se guarda**: si falta la tabla de cuentas, la de perfiles, las huellas o los
  permisos, la tarea falla en vez de guardar medio respaldo. Y antes de guardar comprueba que lo cifrado se abre.

## Seguridad

- Las llaves viven sólo en los secretos de GitHub. Las herramientas no las imprimen; si algo falla, el mensaje
  sale sin direcciones ni claves (hay prueba, y el ensayo lo revisa).
- El respaldo sólo **lee** de producción.
- Lo guardado va cifrado (AES-256). En el repositorio no se ve el contenido de la base ni el de las fotos, ni
  siquiera el nombre de cada archivo.
- La copia lleva dentro las llaves internas de la base (la que firma los sellos y la de los avisos): por eso va
  cifrada y por eso el repositorio es privado.
- Va en un repositorio aparte porque el de la app es **público** y su rama principal no se toca.

## Límites conocidos

- GitHub guarda la historia: un respaldo «quitado» por viejo sigue ocupando espacio dentro del repositorio. Con el
  tamaño actual de la base no importa; se revisa cuando pase de 500 MB.
- Si las fotos crecen mucho (más de 1 GB), habrá que mover los archivos a otro lugar. Hoy no hay ninguna.
- Si la solución gratuita no pasa el ensayo real, la alternativa es el plan de pago de Supabase (US$25 al mes), que
  trae copia diaria con 7 días. No se propone mientras ésta no falle.
